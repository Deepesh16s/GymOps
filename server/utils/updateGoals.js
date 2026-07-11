const Goal = require("../models/Goal");
const Workout = require("../models/workout");

const startOfWeek = () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
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

// Finds the workout documents belonging to the single most-recently-finished
// session (max createdAt among workouts that carry a sessionId). Returns []
// if no session-tagged workouts exist yet (e.g. brand new user, or all
// workouts predate Phase 7's session metadata).
const getLatestSessionWorkouts = async (userId) => {
  const latest = await Workout.findOne({
    user: userId,
    sessionId: { $exists: true, $nin: [null, ""] },
  }).sort({ createdAt: -1 });

  if (!latest) return [];

  return Workout.find({ user: userId, sessionId: latest.sessionId });
};

const recalculateGlobalAutoGoals = async (userId) => {
  try {
    const [
      weeklySessionGoals,
      monthlySessionGoals,
      weeklyVolumeGoals,
      monthlyVolumeGoals,
      sessionExerciseGoals,
      sessionVolumeGoals,
      sessionDurationGoals,
      streakGoals,
    ] = await Promise.all([
      Goal.find({ user: userId, type: "Weekly Workout Sessions" }),
      Goal.find({ user: userId, type: "Monthly Workout Sessions" }),
      Goal.find({ user: userId, type: "Weekly Volume Goal" }),
      Goal.find({ user: userId, type: "Monthly Volume Goal" }),
      Goal.find({ user: userId, type: "Session Exercise Goal" }),
      Goal.find({ user: userId, type: "Session Volume Goal" }),
      Goal.find({ user: userId, type: "Session Duration Goal" }),
      Goal.find({ user: userId, type: "Current Streak" }),
    ]);

    if (weeklySessionGoals.length) {
      const monday = startOfWeek();
      const weekWorkouts = await Workout.find({
        user: userId,
        date: { $gte: monday },
        sessionId: { $exists: true, $nin: [null, ""] },
      }).select("sessionId");

      const distinctCount = new Set(weekWorkouts.map((w) => w.sessionId)).size;

      await Promise.all(
        weeklySessionGoals.map(async (goal) => {
          goal.current = distinctCount;
          applyStatus(goal);
          await goal.save();
        })
      );
    }

    if (monthlySessionGoals.length) {
      const firstOfMonth = startOfMonth();
      const monthWorkouts = await Workout.find({
        user: userId,
        date: { $gte: firstOfMonth },
        sessionId: { $exists: true, $nin: [null, ""] },
      }).select("sessionId");

      const distinctCount = new Set(monthWorkouts.map((w) => w.sessionId)).size;

      await Promise.all(
        monthlySessionGoals.map(async (goal) => {
          goal.current = distinctCount;
          applyStatus(goal);
          await goal.save();
        })
      );
    }

    // Weekly/Monthly Volume goals count ALL workouts in the window,
    // regardless of whether they carry a sessionId — legacy workouts
    // still contributed volume and shouldn't be excluded.
    if (weeklyVolumeGoals.length) {
      const monday = startOfWeek();
      const weekWorkouts = await Workout.find({
        user: userId,
        date: { $gte: monday },
      });
      const weeklyVolume = weekWorkouts.reduce(
        (sum, w) => sum + workoutVolume(w),
        0
      );

      await Promise.all(
        weeklyVolumeGoals.map(async (goal) => {
          goal.current = weeklyVolume;
          applyStatus(goal);
          await goal.save();
        })
      );
    }

    if (monthlyVolumeGoals.length) {
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
        monthlyVolumeGoals.map(async (goal) => {
          goal.current = monthlyVolume;
          applyStatus(goal);
          await goal.save();
        })
      );
    }

    // Session-scoped goals all read from the same "latest session" query,
    // per the product decision: these measure the MOST RECENTLY FINISHED
    // session, not a lifetime best (that's a future PR/achievements feature).
    if (
      sessionExerciseGoals.length ||
      sessionVolumeGoals.length ||
      sessionDurationGoals.length
    ) {
      const latestSessionWorkouts = await getLatestSessionWorkouts(userId);

      const exerciseCount = latestSessionWorkouts.length;
      const sessionVolume = latestSessionWorkouts.reduce(
        (sum, w) => sum + workoutVolume(w),
        0
      );
      const sessionDuration = latestSessionWorkouts[0]?.sessionDuration ?? 0;

      await Promise.all([
        ...sessionExerciseGoals.map(async (goal) => {
          goal.current = exerciseCount;
          applyStatus(goal);
          await goal.save();
        }),
        ...sessionVolumeGoals.map(async (goal) => {
          goal.current = sessionVolume;
          applyStatus(goal);
          await goal.save();
        }),
        ...sessionDurationGoals.map(async (goal) => {
          goal.current = sessionDuration;
          applyStatus(goal);
          await goal.save();
        }),
      ]);
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

const updateGoalsForWorkout = async (userId, exerciseId, workoutSets) => {
  try {
    if (Array.isArray(workoutSets) && workoutSets.length) {
      const maxWeight = Math.max(...workoutSets.map((s) => s.weight));

      const prGoals = await Goal.find({
        user: userId,
        type: "Strength PR",
        exercise: exerciseId,
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

    await recalculateGlobalAutoGoals(userId);
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  updateGoalsForWorkout,
  recalculateGlobalAutoGoals,
  getLatestSessionWorkouts,
};