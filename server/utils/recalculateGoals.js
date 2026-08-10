
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

    await recalculateGlobalAutoGoals(userId);
  } catch (error) {
    console.log(error);
  }
};

module.exports = recalculateGoalsForExercise;
module.exports.recalculateGoalsForExercise = recalculateGoalsForExercise;
module.exports.recalculateGoalsForExercises = recalculateGoalsForExercises;