const Goal = require("../models/Goal");
const Exercise = require("../models/Exercise");
const Workout = require("../models/workout");

/**
 * recalculateGoalsForExercise
 * ----------------------------
 * Called after a workout is DELETED. Unlike updateGoalsForWorkout (which
 * only ever raises `current`), this fully recalculates `current` from the
 * remaining workout history — because deleting a workout can legitimately
 * lower the true max weight (e.g. the deleted workout held the old PR).
 *
 * @param {ObjectId|string} userId      - req.user._id
 * @param {ObjectId|string} exerciseId  - the Exercise _id the deleted workout referenced
 */
const recalculateGoalsForExercise = async (userId, exerciseId) => {
  try {
    if (!exerciseId) return;

    const exerciseDoc = await Exercise.findById(exerciseId);
    if (!exerciseDoc) return;

    const goals = await Goal.find({
      user: userId,
      exercise: exerciseDoc.name,
    });

    if (!goals.length) return;

    // Re-derive the true max weight from whatever workouts remain
    // for this exercise — no caching, computed fresh each time this runs.
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
      goals.map(async (goal) => {
        goal.current = maxWeight;
        goal.status =
          goal.current >= goal.target ? "Completed" : "In Progress";
        await goal.save();
      })
    );
  } catch (error) {
    // Never let goal recalculation break workout deletion.
    console.log(error);
  }
};

module.exports = recalculateGoalsForExercise;