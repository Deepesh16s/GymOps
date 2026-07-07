const Goal = require("../models/Goal");
const Workout = require("../models/workout");
const { recalculateGlobalAutoGoals } = require("./updateGoals");

const applyStatus = (goal) => {
  goal.status = goal.current >= goal.target ? "Completed" : "In Progress";
};

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
    console.log(error);
  }
};

module.exports = recalculateGoalsForExercise;