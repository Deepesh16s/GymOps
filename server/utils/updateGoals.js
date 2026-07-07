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

module.exports = { updateGoalsForWorkout, recalculateGlobalAutoGoals };