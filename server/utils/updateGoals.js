const Goal = require("../models/Goal");
const Exercise = require("../models/Exercise");
const Workout = require("../models/workout");

/* ── small date helpers ── */
const startOfWeek = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun … 6=Sat
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const startOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const workoutVolume = (w) =>
  (w.workoutSets || []).reduce((sum, s) => sum + s.reps * s.weight, 0);

const computeCurrentStreak = (workouts) => {
  if (!workouts.length) return 0;

  const dateStrings = new Set(
    workouts.map((w) => {
      const d = new Date(w.date || w.createdAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })
  );

  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let streak = 0;

  while (true) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (!dateStrings.has(key)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

const applyStatus = (goal) => {
  goal.status = goal.current >= goal.target ? "Completed" : "In Progress";
};

/**
 * recalculateGlobalAutoGoals
 * ---------------------------
 * Recomputes the three "whole-account" AUTO goal types (Weekly Workout,
 * Monthly Volume, Current Streak) from the live workout history. These
 * aren't tied to a single exercise and aren't monotonic (they can go
 * down as easily as up), so unlike the PR bump-logic below, they're
 * fully recalculated every time this runs.
 *
 * Exported so recalculateGoals.js (used on workout delete) can reuse
 * the exact same logic instead of duplicating it.
 */
const recalculateGlobalAutoGoals = async (userId) => {
  try {
    const [weeklyGoals, monthlyGoals, streakGoals] = await Promise.all([
      Goal.find({ user: userId, type: "Weekly Workout" }),
      Goal.find({ user: userId, type: "Monthly Volume" }),
      Goal.find({ user: userId, type: "Current Streak" }),
    ]);

    if (weeklyGoals.length) {
      const monday = startOfWeek();
      const weeklyCount = await Workout.countDocuments({
        user: userId,
        date: { $gte: monday },
      });

      await Promise.all(
        weeklyGoals.map(async (goal) => {
          goal.current = weeklyCount;
          applyStatus(goal);
          await goal.save();
        })
      );
    }

    if (monthlyGoals.length) {
      const firstOfMonth = startOfMonth();
      const monthWorkouts = await Workout.find({
        user: userId,
        date: { $gte: firstOfMonth },
      });
      const monthlyVolume = monthWorkouts.reduce(
        (sum, w) => sum + workoutVolume(w),
        0
      );

      await Promise.all(
        monthlyGoals.map(async (goal) => {
          goal.current = monthlyVolume;
          applyStatus(goal);
          await goal.save();
        })
      );
    }

    if (streakGoals.length) {
      const allWorkouts = await Workout.find({ user: userId }).select(
        "date createdAt"
      );
      const streak = computeCurrentStreak(allWorkouts);

      await Promise.all(
        streakGoals.map(async (goal) => {
          goal.current = streak;
          applyStatus(goal);
          await goal.save();
        })
      );
    }
  } catch (error) {
    console.log(error);
  }
};

/**
 * updateGoalsForWorkout
 * ---------------------
 * Called right after a workout is created/updated. Bumps any matching
 * "Strength PR" goal for that exercise up (never down — a delete is
 * what's allowed to lower it, handled in recalculateGoals.js), then
 * refreshes the global AUTO goals (weekly/monthly/streak) from the
 * full workout history.
 *
 * @param {ObjectId|string} userId
 * @param {ObjectId|string} exerciseId
 * @param {Array<{weight:number, reps:number}>} workoutSets - normalized numbers
 */
const updateGoalsForWorkout = async (userId, exerciseId, workoutSets) => {
  try {
    if (Array.isArray(workoutSets) && workoutSets.length) {
      const maxWeight = Math.max(...workoutSets.map((s) => s.weight));

      // Goal.exercise stores the exercise NAME (string), while
      // Workout.exercise stores an Exercise ObjectId — resolve the name first.
      const exerciseDoc = await Exercise.findById(exerciseId);

      if (exerciseDoc) {
        const prGoals = await Goal.find({
          user: userId,
          type: "Strength PR",
          exercise: {
            $regex: new RegExp(
              `^${exerciseDoc.name.trim()}$`,
              "i"
            ),
          },
        });

        await Promise.all(
          prGoals.map(async (goal) => {
            if (maxWeight > goal.current) {
              goal.current = maxWeight;
              applyStatus(goal);
              await goal.save();
            }
          })
        );
      }
    }

    await recalculateGlobalAutoGoals(userId);
  } catch (error) {
    // Never let a goal-update failure break workout creation.
    console.log(error);
  }
};

module.exports = { updateGoalsForWorkout, recalculateGlobalAutoGoals };