// Full-recompute path, used after a workout is deleted. Distinct from
// updateGoals.js's incremental "only bump if higher" logic: on delete, a
// PR's max weight can only go DOWN, so it must be recomputed from scratch
// rather than compared against the stored current value.

const Goal = require("../models/Goal");
const Workout = require("../models/workout");
const { GOAL_TYPES } = require("../constants/goalTypes");
const { recalculateGlobalAutoGoals } = require("./updateGoals");
const metrics = require("./goalMetrics");

const buildStatus = (current, target) => (current >= target ? "Completed" : "In Progress");

const recalculateGoalsForExercise = async (userId, exerciseId) => {
  try {
    if (exerciseId) {
      const prGoals = await Goal.find({
        user: userId,
        type: GOAL_TYPES.STRENGTH_PR,
        exercise: exerciseId,
      });

      if (prGoals.length) {
        const workouts = await Workout.find({ user: userId, exercise: exerciseId }).select("workoutSets");

        const maxWeight = metrics.getMaxWeight(workouts);

        const ops = prGoals.map((goal) => ({
          updateOne: {
            filter: { _id: goal._id },
            update: {
              $set: {
                current: maxWeight,
                status: buildStatus(maxWeight, goal.target),
                lastUpdated: new Date(),
              },
            },
          },
        }));

        await Goal.bulkWrite(ops);
      }
    }

    await recalculateGlobalAutoGoals(userId);
  } catch (error) {
    console.log(error);
  }
};

// Batch full-recompute path, used after an entire SESSION is deleted
// (workoutController.deleteWorkoutSession). Mirrors the shape of
// recalculateGoalsForExercise above, but does it once for every exercise
// in the session instead of once PER exercise, to avoid:
//   - N redundant Goal.find/Workout.find/bulkWrite round trips for PR goals
//   - N redundant recalculateGlobalAutoGoals() calls, which is especially
//     wasteful since that function's result doesn't depend on which
//     exercise triggered it — it's the same global computation every time.
//
// Same fire-and-forget error handling as recalculateGoalsForExercise:
// logged, never thrown, so a goal recalculation failure never blocks the
// session deletion itself from succeeding.
const recalculateGoalsForExercises = async (userId, exerciseIds) => {
  try {
    const uniqueIds = [...new Set((exerciseIds || []).filter(Boolean).map(String))];

    if (uniqueIds.length) {
      const prGoals = await Goal.find({
        user: userId,
        type: GOAL_TYPES.STRENGTH_PR,
        exercise: { $in: uniqueIds },
      });

      if (prGoals.length) {
        // ONE query for every remaining workout across every exercise in
        // the deleted session, then grouped in memory — same principle as
        // updateGoals.js's buildWeightsByExercise, just for a full
        // recompute (post-delete) instead of an incremental bump.
        const workouts = await Workout.find({
          user: userId,
          exercise: { $in: uniqueIds },
        }).select("workoutSets exercise");

        const workoutsByExercise = new Map();
        workouts.forEach((w) => {
          const key = String(w.exercise);
          if (!workoutsByExercise.has(key)) workoutsByExercise.set(key, []);
          workoutsByExercise.get(key).push(w);
        });

        const ops = prGoals.map((goal) => {
          const exerciseWorkouts = workoutsByExercise.get(String(goal.exercise)) || [];
          const maxWeight = metrics.getMaxWeight(exerciseWorkouts);

          return {
            updateOne: {
              filter: { _id: goal._id },
              update: {
                $set: {
                  current: maxWeight,
                  status: buildStatus(maxWeight, goal.target),
                  lastUpdated: new Date(),
                },
              },
            },
          };
        });

        if (ops.length) {
          await Goal.bulkWrite(ops);
        }
      }
    }

    // Called exactly once for the whole session, not once per exercise.
    await recalculateGlobalAutoGoals(userId);
  } catch (error) {
    console.log(error);
  }
};

module.exports = recalculateGoalsForExercise;
module.exports.recalculateGoalsForExercise = recalculateGoalsForExercise;
module.exports.recalculateGoalsForExercises = recalculateGoalsForExercises;