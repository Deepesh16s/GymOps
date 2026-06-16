const Workout = require("../models/workout");

// Total Workouts
exports.getTotalWorkouts = async (req, res) => {
  try {
    const totalWorkouts = await Workout.countDocuments({
      user: req.user._id,
    });

    res.status(200).json({
      totalWorkouts,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};
exports.getTotalVolume = async (req, res) => {
  try {
    const workouts = await Workout.find({
      user: req.user._id,
    });

    let totalVolume = 0;

    workouts.forEach((workout) => {
      totalVolume +=
        workout.sets *
        workout.reps *
        workout.weight;
    });

    res.status(200).json({
      totalVolume,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};
// Total Unique Exercises
exports.getTotalExercises = async (req, res) => {
  try {
    const exercises = await Workout.distinct(
      "exercise",
      {
        user: req.user._id,
      }
    );

    res.status(200).json({
      totalExercises: exercises.length,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};
// Recent Workouts
exports.getRecentWorkouts = async (req, res) => {
  try {
    const workouts = await Workout.find({
      user: req.user._id,
    })
      .populate("exercise")
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json(workouts);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};
// Muscle Distribution
exports.getMuscleDistribution = async (req, res) => {
  try {
    const workouts = await Workout.find({
      user: req.user._id,
    }).populate("exercise");

    const distribution = {};

    workouts.forEach((workout) => {
      if (!workout.exercise) return;
      const muscle =workout.exercise.muscleGroup;

      if (!distribution[muscle]) {
        distribution[muscle] = 0;
      }

      distribution[muscle]++;
    });

    res.status(200).json(distribution);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};
// Weekly Volume
exports.getWeeklyVolume = async (req, res) => {
  try {
   const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

const workouts = await Workout.find({
  user: req.user._id,
  createdAt: {
    $gte: sevenDaysAgo,
  },
});

    let totalVolume = 0;

    workouts.forEach((workout) => {
      totalVolume +=
        workout.sets *
        workout.reps *
        workout.weight;
    });

    res.status(200).json({
      weeklyVolume: totalVolume,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};
// Monthly Workouts
exports.getMonthlyWorkouts = async (
  req,
  res
) => {
  try {
    const thirtyDaysAgo = new Date();

    thirtyDaysAgo.setDate(
      thirtyDaysAgo.getDate() - 30
    );

    const monthlyWorkouts =
      await Workout.countDocuments({
        user: req.user._id,
        createdAt: {
          $gte: thirtyDaysAgo,
        },
      });

    res.status(200).json({
      monthlyWorkouts,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};
// Favorite Exercise
exports.getFavoriteExercise = async (req, res) => {
  try {
    const workouts = await Workout.find({
      user: req.user._id,
    }).populate("exercise");

    const frequency = {};

    workouts.forEach((workout) => {
      if (!workout.exercise) return;
      const name =workout.exercise.name;

      if (!frequency[name]) {
        frequency[name] = 0;
      }

      frequency[name]++;
    });

    let favoriteExercise = null;
    let max = 0;

    for (let exercise in frequency) {
      if (frequency[exercise] > max) {
        max = frequency[exercise];
        favoriteExercise = exercise;
      }
    }

    res.status(200).json({
      favoriteExercise,
      count: max,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};
// Last Workout
exports.getLastWorkout = async (req, res) => {
  try {
    const workout = await Workout.findOne({
      user: req.user._id,
    })
      .populate("exercise")
      .sort({ createdAt: -1 });

    res.status(200).json(workout);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};
// Average Volume
exports.getAverageVolume = async (req, res) => {
  try {
    const workouts = await Workout.find({
      user: req.user._id,
    });

    if (workouts.length === 0) {
      return res.status(200).json({
        averageVolume: 0,
      });
    }

    let totalVolume = 0;

    workouts.forEach((workout) => {
      totalVolume +=
        workout.sets *
        workout.reps *
        workout.weight;
    });

    const averageVolume =
      totalVolume / workouts.length;

    res.status(200).json({
      averageVolume,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};
// Personal Records
exports.getPersonalRecords = async (req, res) => {
  try {
    const workouts = await Workout.find({
      user: req.user._id,
    }).populate("exercise");

    const prs = {};

    workouts.forEach((workout) => {
      if (!workout.exercise) return;
      const exercise =workout.exercise.name;

      if (
        !prs[exercise] ||
        workout.weight >
          prs[exercise]
      ) {
        prs[exercise] =
          workout.weight;
      }
    });

    res.status(200).json(prs);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};
// Current Streak
exports.getCurrentStreak = async (
  req,
  res
) => {
  try {
    const count =
      await Workout.countDocuments({
        user: req.user._id,
      });

    const currentStreak =
      count > 0 ? 1 : 0;

    res.status(200).json({
      currentStreak,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

// Weekly Workouts
exports.getWeeklyWorkouts = async (req, res) => {
  try {
    const sevenDaysAgo = new Date();

    sevenDaysAgo.setDate(
      sevenDaysAgo.getDate() - 7
    );

    const weeklyWorkouts =
      await Workout.countDocuments({
        user: req.user._id,
        createdAt: {
          $gte: sevenDaysAgo,
        },
      });

    res.status(200).json({
      weeklyWorkouts,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};
// Top Muscle Group
exports.getTopMuscle = async (
  req,
  res
) => {
  try {
    const workouts = await Workout.find({
      user: req.user._id,
    }).populate("exercise");

    const muscleCounts = {};

    workouts.forEach((workout) => {
  if (!workout.exercise) return;

  const muscle =
    workout.exercise.muscleGroup;

  muscleCounts[muscle] =
    (muscleCounts[muscle] || 0) + 1;
});

    let topMuscle = null;
    let count = 0;

    for (let muscle in muscleCounts) {
      if (muscleCounts[muscle] > count) {
        count = muscleCounts[muscle];
        topMuscle = muscle;
      }
    }

    res.status(200).json({
      topMuscle,
      count,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};
// Most Performed Exercise
exports.getTopExercise = async (
  req,
  res
) => {
  try {
    const workouts = await Workout.find({
      user: req.user._id,
    }).populate("exercise");

    const exerciseCounts = {};

    workouts.forEach((workout) => {
  if (!workout.exercise) return;

  const exercise =
    workout.exercise.name;

  exerciseCounts[exercise] =
    (exerciseCounts[exercise] || 0) + 1;
});

    let exercise = null;
    let count = 0;

    for (let name in exerciseCounts) {
      if (exerciseCounts[name] > count) {
        count = exerciseCounts[name];
        exercise = name;
      }
    }

    res.status(200).json({
      exercise,
      count,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};