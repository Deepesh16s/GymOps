const Workout = require("../models/workout");
const {
  groupBySessionId,
  countDistinctSessions,
  getSessionTimestamp,
  getLatestSessionWorkouts,
  getAverageVolumeOfRecentSessions,
  getAverageSessionDurationOfRecentSessions,
  computeCurrentStreak,
  filterSince,
  sumVolume,
} = require("../utils/goalMetrics");

// Defensive fix (Phase 8A): cardio entries have no workoutSets, so this
// would throw without the guard. Mirrors the same (w.workoutSets || [])
// pattern already used throughout goalMetrics.js.
const workoutVolume = (w) =>
  (w.workoutSets || []).reduce((sum, s) => sum + s.reps * s.weight, 0);

// Phase 9 audit fix: guarded like workoutVolume above. Callers already
// filter out cardio entries via `if (!w.exercise) return;` before this
// runs, but the guard belongs on the helper itself rather than relying
// on every caller to remember to filter first.
const totalSetsCount = (w) => (w.workoutSets || []).length;

const RANGE_DAYS = {
  week: 7,
  month: 30,
  year: 365,
};

const buildDateFilter = (range) => {
  if (!RANGE_DAYS[range]) return null;
  const since = new Date();
  since.setDate(since.getDate() - RANGE_DAYS[range]);
  since.setHours(0, 0, 0, 0);
  return since;
};

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Phase 9: builds the presentation-ready Last Session payload from the
// raw (populated) Workout documents belonging to one session. Kept
// local/unexported — this is dashboard-specific shaping, not a generic
// metric, so it doesn't belong in goalMetrics.js. The frontend should not
// need to recompute anything from this shape, only render it.
const buildLastSessionPayload = (sessionWorkouts) => {
  if (!sessionWorkouts || sessionWorkouts.length === 0) return null;

  const first = sessionWorkouts[0];
  const exercises = [];
  const cardioActivities = [];
  const muscleGroups = new Set();

  sessionWorkouts.forEach((w) => {
    if (w.entryType === "cardio") {
      cardioActivities.push({
        activityType: w.cardio?.activityType ?? null,
        data: w.cardio?.data ?? {},
      });
    } else if (w.exercise) {
      exercises.push({
        name: w.exercise.name,
        muscleGroup: w.exercise.muscleGroup,
      });
      if (w.exercise.muscleGroup) muscleGroups.add(w.exercise.muscleGroup);
    }
  });

  return {
    sessionType: first.sessionType || null,
    customSessionType: first.customSessionType || null,
    date: first.date,
    sessionDuration: first.sessionDuration ?? null,
    volume: sumVolume(sessionWorkouts),
    exerciseCount: exercises.length,
    cardioCount: cardioActivities.length,
    exercises,
    cardioActivities,
    muscleGroups: Array.from(muscleGroups),
  };
};

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
    const { range } = req.query;
    const filter = { user: req.user._id };

    const since = buildDateFilter(range);
    if (since) {
      filter.date = { $gte: since };
    }

    const workouts = await Workout.find(filter).populate("exercise");

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

      // Phase 9 audit fix: guarded like workoutVolume above, for the same
      // reason — this is safe today only because of the `!w.exercise`
      // skip above; the guard now holds regardless of caller order.
      const heaviestSet = (w.workoutSets || []).reduce(
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

// Phase 9 audit fix: was a second, duplicate streak implementation.
// Reuses goalMetrics.computeCurrentStreak — same response contract
// ({ currentStreak }), single source of truth for streak logic now.
exports.getCurrentStreak = async (req, res) => {
  try {
    const workouts = await Workout.find({ user: req.user._id }).select("date");
    const currentStreak = computeCurrentStreak(workouts);
    res.status(200).json({ currentStreak });
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

/* ------------------------------------------------------------------ */
/* Phase 9 — session-centric dashboard endpoints                       */
/* ------------------------------------------------------------------ */

exports.getSessionSummary = async (req, res) => {
  try {
    const workouts = await Workout.find({ user: req.user._id }).populate(
      "exercise"
    );

    const totalSessions = countDistinctSessions(workouts);

    const sessionsLast7Days = countDistinctSessions(
      filterSince(workouts, daysAgo(7))
    );
    const sessionsLast30Days = countDistinctSessions(
      filterSince(workouts, daysAgo(30))
    );

    const lastSessionWorkouts = getLatestSessionWorkouts(workouts);
    const lastSession = buildLastSessionPayload(lastSessionWorkouts);

    const averageVolumeRecent = getAverageVolumeOfRecentSessions(
      workouts,
      5
    );

    const averageSessionDuration = getAverageSessionDurationOfRecentSessions(
      workouts,
      5
    );

    res.status(200).json({
      totalSessions,
      sessionsLast7Days,
      sessionsLast30Days,
      lastSession,
      lastSessionType: lastSession?.sessionType ?? null,
      averageVolumeRecent,
      averageSessionDuration,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getRecentSessions = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 6;

    const workouts = await Workout.find({ user: req.user._id })
      .populate("exercise")
      .sort({ createdAt: 1 });

    const sessions = groupBySessionId(workouts);

    const topSessionIds = Array.from(sessions.entries())
      .sort((a, b) => getSessionTimestamp(b[1]) - getSessionTimestamp(a[1]))
      .slice(0, limit)
      .map(([sessionId]) => sessionId);

    const idSet = new Set(topSessionIds);
    const limitedWorkouts = workouts.filter(
      (w) => w.sessionId && idSet.has(w.sessionId)
    );

    res.status(200).json(limitedWorkouts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};