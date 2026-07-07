const Goal = require("../models/Goal");
const Workout = require("../models/workout");
const { recalculateGlobalAutoGoals } = require("./updateGoals");

const applyStatus = (goal) => {
  goal.status = goal.current >= goal.target ? "Completed" : "In Progress";
};

/**
 * recalculateGoalsForExercise
 * ----------------------------
 * Called after a workout is DELETED. Fully recalculates the "Strength PR"
 * goal's `current` from remaining workout history, since deleting a
 * workout can legitimately lower the true max weight.
 *
 * FIX: same as updateGoals.js — Goal.exercise is now an Exercise
 * ObjectId, so matching is a direct equality check instead of a
 * name-based regex lookup.
 *
 * @param {ObjectId|string} userId
 * @param {ObjectId|string} exerciseId - the Exercise _id the deleted workout referenced
 */
const recalculateGoalsForExercise = async (userId, exerciseId) => {
  try {
    if (exerciseId) {
      const prGoals = await Goal.find({
        user: userId,
        type: "Strength PR",
        exercise: exerciseId,
      });

      if (prGoals.length) {
        const workouts = await Workout.find({
          user: userId,
          exercise: exerciseId,
        });

        let maxWeight = 0;
        workouts.forEach((workout) => {
          workout.workoutSets.forEach((set) => {
            if (set.weight > maxWeight) maxWeight = set.weight;
          });
        });

        await Promise.all(
          prGoals.map(async (goal) => {
            goal.current = maxWeight;
            applyStatus(goal);
            await goal.save();
          })
        );
      }
    }

    await recalculateGlobalAutoGoals(userId);
  } catch (error) {
    // Never let goal recalculation break workout deletion.
    console.log(error);
  }
};

module.exports = recalculateGoalsForExercise;