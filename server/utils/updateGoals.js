const Goal = require("../models/Goal");
const Exercise = require("../models/Exercise");

/**
 * updateGoalsForWorkout
 * ---------------------
 * Called once, right after a workout is created. Looks at the max
 * weight lifted in that workout and bumps any matching goals'
 * `current` value up (never down), recalculating status.
 *
 * This intentionally does NOT scan workout history — it only reacts
 * to the single workout just logged, per the "no recalculation on
 * every load" requirement.
 *
 * @param {ObjectId|string} userId      - req.user._id
 * @param {ObjectId|string} exerciseId  - the Exercise _id referenced by the workout
 * @param {Array<{weight:number, reps:number}>} workoutSets - already-normalized sets (numbers)
 */
const updateGoalsForWorkout = async (userId, exerciseId, workoutSets) => {
  try {
    if (!Array.isArray(workoutSets) || workoutSets.length === 0) return;

    const maxWeight = Math.max(...workoutSets.map((s) => s.weight));

    // Goal.exercise stores the exercise NAME (string), while
    // Workout.exercise stores an Exercise ObjectId — resolve the name first.
    const exerciseDoc = await Exercise.findById(exerciseId);
    if (!exerciseDoc) return;

    const goals = await Goal.find({
      user: userId,
      exercise: exerciseDoc.name,
    });

    if (!goals.length) return;

    await Promise.all(
      goals.map(async (goal) => {
        if (maxWeight > goal.current) {
          goal.current = maxWeight;
          goal.status =
            goal.current >= goal.target ? "Completed" : "In Progress";
          await goal.save();
        }
      })
    );
  } catch (error) {
    // Never let a goal-update failure break workout creation.
    console.log(error);
  }
};

module.exports = updateGoalsForWorkout;