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

module.exports = recalculateGoalsForExercise;