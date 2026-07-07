const Workout = require("../models/workout");

const workoutVolume = (w) =>
  w.workoutSets.reduce((sum, s) => sum + s.reps * s.weight, 0);

const totalSetsCount = (w) => w.workoutSets.length;

exports.getTotalWorkouts = async (req, res) => {
  try {
    const totalWorkouts = await Workout.countDocuments({
      user: req.user._id,
    });
    res.status(200).json({ totalWorkouts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getTotalVolume = async (req, res) => {
  try {
    const workouts = await Workout.find({ user: req.user._id });
    const totalVolume = workouts.reduce(
      (sum, w) => sum + workoutVolume(w),
      0
    );
    res.status(200).json({ totalVolume });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getTotalExercises = async (req, res) => {
  try {
    const exercises = await Workout.distinct("exercise", {
      user: req.user._id,
    });
    res.status(200).json({ totalExercises: exercises.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getRecentWorkouts = async (req, res) => {
  try {
    const workouts = await Workout.find({ user: req.user._id })
      .populate("exercise")
      .sort({ createdAt: -1 })
      .limit(5);
    res.status(200).json(workouts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getMuscleDistribution = async (req, res) => {
  try {
    const workouts = await Workout.find({ user: req.user._id }).populate(
      "exercise"
    );

    const distribution = {};
    workouts.forEach((w) => {
      if (!w.exercise) return;
      const muscle = w.exercise.muscleGroup;
      distribution[muscle] = (distribution[muscle] || 0) + totalSetsCount(w);
    });

    const result = Object.entries(distribution).map(([muscle, sets]) => ({
      muscle,
      sets,
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getWeeklyVolume = async (req, res) => {
  try {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMon);
    monday.setHours(0, 0, 0, 0);

    const workouts = await Workout.find({
      user: req.user._id,
      date: { $gte: monday },
    });

    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const accum = Object.fromEntries(DAYS.map((d) => [d, 0]));

    workouts.forEach((w) => {
      const d = new Date(w.date).getDay();
      const label = DAYS[d === 0 ? 6 : d - 1];
      accum[label] += workoutVolume(w);
    });

    const result = DAYS.map((day) => ({ day, volume: accum[day] }));
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getMonthlyWorkouts = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const monthlyWorkouts = await Workout.countDocuments({
      user: req.user._id,
      date: { $gte: thirtyDaysAgo },
    });

    res.status(200).json({ monthlyWorkouts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getFavoriteExercise = async (req, res) => {
  try {
    const workouts = await Workout.find({ user: req.user._id }).populate(
      "exercise"
    );

    const freq = {};
    workouts.forEach((w) => {
      if (!w.exercise) return;
      const name = w.exercise.name;
      freq[name] = (freq[name] || 0) + 1;
    });

    let favoriteExercise = null;
    let count = 0;
    for (const [name, n] of Object.entries(freq)) {
      if (n > count) {
        count = n;
        favoriteExercise = name;
      }
    }

    res.status(200).json({ favoriteExercise, count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getLastWorkout = async (req, res) => {
  try {
    const workout = await Workout.findOne({ user: req.user._id })
      .populate("exercise")
      .sort({ createdAt: -1 });
    res.status(200).json(workout);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getAverageVolume = async (req, res) => {
  try {
    const workouts = await Workout.find({ user: req.user._id });
    if (workouts.length === 0) return res.status(200).json({ averageVolume: 0 });

    const totalVolume = workouts.reduce(
      (sum, w) => sum + workoutVolume(w),
      0
    );
    const averageVolume = totalVolume / workouts.length;
    res.status(200).json({ averageVolume });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getPersonalRecords = async (req, res) => {
  try {
    const workouts = await Workout.find({ user: req.user._id }).populate(
      "exercise"
    );

    const prs = {};
    workouts.forEach((w) => {
      if (!w.exercise) return;
      const name = w.exercise.name;

      const heaviestSet = w.workoutSets.reduce(
        (max, s) => (s.weight > max ? s.weight : max),
        0
      );

      if (!prs[name] || heaviestSet > prs[name]) prs[name] = heaviestSet;
    });

    res.status(200).json(prs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getCurrentStreak = async (req, res) => {
  try {
    const workouts = await Workout.find({ user: req.user._id }).select("date");

    if (workouts.length === 0) {
      return res.status(200).json({ currentStreak: 0 });
    }

    const dateStrings = new Set(
      workouts.map((w) => {
        const d = new Date(w.date);
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

    res.status(200).json({ currentStreak: streak });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getWeeklyWorkouts = async (req, res) => {
  try {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMon);
    monday.setHours(0, 0, 0, 0);

    const weeklyWorkouts = await Workout.countDocuments({
      user: req.user._id,
      date: { $gte: monday },
    });

    res.status(200).json({ weeklyWorkouts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getTopMuscle = async (req, res) => {
  try {
    const workouts = await Workout.find({ user: req.user._id }).populate(
      "exercise"
    );

    const muscleSets = {};
    workouts.forEach((w) => {
      if (!w.exercise) return;
      const muscle = w.exercise.muscleGroup;
      muscleSets[muscle] = (muscleSets[muscle] || 0) + totalSetsCount(w);
    });

    let topMuscle = null;
    let count = 0;
    for (const [muscle, n] of Object.entries(muscleSets)) {
      if (n > count) {
        count = n;
        topMuscle = muscle;
      }
    }

    res.status(200).json({ topMuscle, count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getTopExercise = async (req, res) => {
  try {
    const workouts = await Workout.find({ user: req.user._id }).populate(
      "exercise"
    );

    const counts = {};
    workouts.forEach((w) => {
      if (!w.exercise) return;
      const name = w.exercise.name;
      counts[name] = (counts[name] || 0) + 1;
    });

    let exercise = null;
    let count = 0;
    for (const [name, n] of Object.entries(counts)) {
      if (n > count) {
        count = n;
        exercise = name;
      }
    }

    res.status(200).json({ exercise, count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getCalendarWorkouts = async (req, res) => {
  try {
    const workouts = await Workout.find({ user: req.user._id })
      .populate("exercise")
      .sort({ date: -1 });

    res.status(200).json(workouts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};