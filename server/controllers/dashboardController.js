const Workout = require("../models/workout");

/* small helper — volume for one workout doc = sum of (reps*weight)
   across all its sets. Used everywhere below instead of the old
   single sets*reps*weight line. */
const workoutVolume = (w) =>
  w.workoutSets.reduce((sum, s) => sum + s.reps * s.weight, 0);

const totalSetsCount = (w) => w.workoutSets.length;

/* ─────────────────────────────────────────
   1. Total Workouts
───────────────────────────────────────── */
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

/* ─────────────────────────────────────────
   2. Total Volume  (sum of reps × weight across all sets)
───────────────────────────────────────── */
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

/* ─────────────────────────────────────────
   3. Total Unique Exercises
───────────────────────────────────────── */
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

/* ─────────────────────────────────────────
   4. Recent Workouts  (last 5, populated)
   workoutSets travels along automatically since we no
   longer pick individual fields off the doc.
───────────────────────────────────────── */
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

/* ─────────────────────────────────────────
   5. Muscle Distribution  [{muscle, sets}]
   "sets" now means total workoutSets entries for that muscle,
   not the old single `sets` number on the doc.
───────────────────────────────────────── */
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

/* ─────────────────────────────────────────
   6. Weekly Volume  [{day, volume}]
   Uses the workout's `date` field (not createdAt).
   Returns Mon-Sun ordered for left-to-right display.
───────────────────────────────────────── */
exports.getWeeklyVolume = async (req, res) => {
  try {
    /* Start of the current week — Monday 00:00:00 */
    const today     = new Date();
    const dayOfWeek = today.getDay();                    // 0=Sun … 6=Sat
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday    = new Date(today);
    monday.setDate(today.getDate() + diffToMon);
    monday.setHours(0, 0, 0, 0);

    const workouts = await Workout.find({
      user: req.user._id,
      date:  { $gte: monday },
    });

    const DAYS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const accum = Object.fromEntries(DAYS.map((d) => [d, 0]));

    workouts.forEach((w) => {
      const d = new Date(w.date).getDay(); // 0=Sun
      const label = DAYS[d === 0 ? 6 : d - 1];  // map JS day → Mon-first index
      accum[label] += workoutVolume(w);
    });

    const result = DAYS.map((day) => ({ day, volume: accum[day] }));
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

/* ─────────────────────────────────────────
   7. Monthly Workouts  (last 30 days)
   Uses `date` field for consistency.
───────────────────────────────────────── */
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

/* ─────────────────────────────────────────
   8. Favorite Exercise  (most-performed, by session count)
───────────────────────────────────────── */
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
      if (n > count) { count = n; favoriteExercise = name; }
    }

    res.status(200).json({ favoriteExercise, count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

/* ─────────────────────────────────────────
   9. Last Workout
───────────────────────────────────────── */
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

/* ─────────────────────────────────────────
   10. Average Volume per workout session
───────────────────────────────────────── */
exports.getAverageVolume = async (req, res) => {
  try {
    const workouts = await Workout.find({ user: req.user._id });
    if (workouts.length === 0) return res.status(200).json({ averageVolume: 0 });

    const totalVolume = workouts.reduce(
      (sum, w) => sum + workoutVolume(w),
      0
    );
    /* Return raw float — frontend rounds via Math.round() */
    const averageVolume = totalVolume / workouts.length;
    res.status(200).json({ averageVolume });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

/* ─────────────────────────────────────────
   11. Personal Records  {exerciseName: maxWeight}
   Max weight now has to be found across every set of every
   workout, not just one weight field per doc.
───────────────────────────────────────── */
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

/* ─────────────────────────────────────────
   12. Current Streak — real consecutive days
   Counts back from today through workout `date` field.
───────────────────────────────────────── */
exports.getCurrentStreak = async (req, res) => {
  try {
    /* Collect all distinct workout dates for this user */
    const workouts = await Workout.find({ user: req.user._id }).select("date");

    if (workouts.length === 0) {
      return res.status(200).json({ currentStreak: 0 });
    }

    /* Build a Set of "YYYY-MM-DD" strings */
    const dateStrings = new Set(
      workouts.map((w) => {
        const d = new Date(w.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })
    );

    /* Walk backwards from today until we find a missing day */
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

/* ─────────────────────────────────────────
   13. Weekly Workouts  (current calendar week Mon–Sun)
   Uses `date` field for consistency with getWeeklyVolume.
───────────────────────────────────────── */
exports.getWeeklyWorkouts = async (req, res) => {
  try {
    const today     = new Date();
    const dayOfWeek = today.getDay();
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday    = new Date(today);
    monday.setDate(today.getDate() + diffToMon);
    monday.setHours(0, 0, 0, 0);

    const weeklyWorkouts = await Workout.countDocuments({
      user: req.user._id,
      date:  { $gte: monday },
    });

    res.status(200).json({ weeklyWorkouts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

/* ─────────────────────────────────────────
   14. Top Muscle  (most total sets)
───────────────────────────────────────── */
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
      if (n > count) { count = n; topMuscle = muscle; }
    }

    res.status(200).json({ topMuscle, count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

/* ─────────────────────────────────────────
   15. Top Exercise  (most frequently performed)
───────────────────────────────────────── */
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
      if (n > count) { count = n; exercise = name; }
    }

    res.status(200).json({ exercise, count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};
exports.getCalendarWorkouts = async (
  req,
  res
) => {
  try {
    const workouts =
      await Workout.find({
        user: req.user._id,
      })
        .populate("exercise")
        .sort({ date: -1 });

    res.status(200).json(
      workouts
    );
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "Server Error",
    });
  }
};