const Goal = require("../models/Goal");
const Exercise = require("../models/Exercise");
const Workout = require("../models/workout");
const { recalculateGlobalAutoGoals } = require("./updateGoals");

const applyStatus = (goal) => {
  goal.status = goal.current >= goal.target ? "Completed" : "In Progress";
};

/**
 * recalculateGoalsForExercise
 * ----------------------------
 * Called after a workout is DELETED. Unlike the PR bump-logic in
 * updateGoals.js (which only ever raises `current`), this fully
 * recalculates the "Strength PR" goal's `current` from the remaining
 * workout history — deleting a workout can legitimately lower the
 * true max weight (e.g. the deleted workout held the old PR).
 *
 * It also refreshes the global AUTO goals (weekly/monthly/streak),
 * since deleting a workout can lower those too.
 *
 * @param {ObjectId|string} userId
 * @param {ObjectId|string} exerciseId - the Exercise _id the deleted workout referenced
 */
const recalculateGoalsForExercise = async (userId, exerciseId) => {
  try {
    if (exerciseId) {
      const exerciseDoc = await Exercise.findById(exerciseId);

      if (exerciseDoc) {
        const prGoals = await Goal.find({
          user: userId,
          type: "Strength PR",
          exercise: {
            $regex: new RegExp(`^${exerciseDoc.name.trim()}$`, "i"),
          },
        });

        if (prGoals.length) {
          // Re-derive the true max weight from whatever workouts remain.
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
    }

    await recalculateGlobalAutoGoals(userId);
  } catch (error) {
    // Never let goal recalculation break workout deletion.
    console.log(error);
  }
};

module.exports = recalculateGoalsForExercise;