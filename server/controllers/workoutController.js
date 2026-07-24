const Workout = require("../models/workout");
const Exercise = require("../models/Exercise");
const PlannedWorkout = require("../models/PlannedWorkout");
const {
  updateGoalsForWorkout,
  updateGoalsForSession,
} = require("../utils/updateGoals");
const recalculateGoalsForExercise = require("../utils/recalculateGoals");
const { recalculateGoalsForExercises } = require("../utils/recalculateGoals");
const { detectWorkoutSessionNotifications } = require("../utils/notificationTriggers");
const { createNotificationsIfNew, suppressNotifications } = require("../utils/notificationService");
const {
  validateWorkoutPayload,
  validateWorkoutSets,
  validateSessionMeta,
  validateSessionType,
  normalizeCustomSessionType,
  validateCardioEntry,
  validateSessionTiming,
  validateOptionalSessionTimestamps,
  validateNote,
} = require("../utils/validateWorkoutPayload");

const NOTE_MAX_LENGTH = 500;
const SESSION_NOTE_MAX_LENGTH = 1000;

exports.createWorkout = async (req, res) => {
  try {
    const { exercise, workoutSets, sessionId, sessionDuration } = req.body;

    validateWorkoutPayload({ workoutSets, sessionId, sessionDuration });

    const exerciseDoc = await Exercise.findOne({
      _id: exercise,
      createdBy: req.user._id,
    });
    if (!exerciseDoc) {
      const err = new Error("Selected exercise was not found");
      err.status = 400;
      throw err;
    }

    const cleanSets = workoutSets.map((s) => ({
      weight: Number(s.weight),
      reps: Number(s.reps),
    }));

    const workout = await Workout.create({
      user: req.user._id,
      exercise: exerciseDoc._id,
      workoutSets: cleanSets,
      sessionId: sessionId.trim(),
      sessionDuration: Number(sessionDuration),
    });

    await updateGoalsForWorkout(req.user._id, exercise, cleanSets);

    res.status(201).json(workout);
  } catch (error) {
    console.log(error);

    res.status(error.status || 500).json({
      message: error.status ? error.message : "Server Error",
    });
  }
};

exports.createWorkoutSession = async (req, res) => {
  try {
    const {
      sessionId,
      sessionDuration,
      sessionType,
      customSessionType,
      exercises,
      startedAt,
      endedAt,
      sessionNote,
      // Phase 13B — set when this session was started via "Start
      // Planned Workout" rather than "New Workout"; see the
      // plannedWorkout-completion block below, right after the session
      // itself is confirmed saved.
      plannedWorkoutId,
    } = req.body;

    validateSessionMeta(sessionId, sessionDuration);
    validateSessionType(sessionType, customSessionType);
    const cleanSessionNote = validateNote(sessionNote, SESSION_NOTE_MAX_LENGTH, "Workout note");

    // Workout Session Editing & Time Tracking: when the workout was
    // actually tracked live (Start Workout -> Finish Workout), the client
    // sends the real startedAt/endedAt it captured, so the session shows
    // accurate times by default without requiring a manual edit. Both are
    // optional — a session finished without a live timer simply has no
    // timing until set via "Edit Workout Timing", same as before.
    const { startedAt: parsedStartedAt, endedAt: parsedEndedAt } =
      validateOptionalSessionTimestamps(startedAt, endedAt);

    if (!Array.isArray(exercises) || exercises.length === 0) {
      const err = new Error("exercises must be a non-empty array");
      err.status = 400;
      throw err;
    }

    // Phase 8A: each entry in `exercises` (the API field name is kept
    // unchanged for backward compatibility — see finishWorkout in
    // useWorkoutSession.js) may be a strength entry (unchanged shape) or
    // a cardio entry, distinguished by `entryType`. Any entry without an
    // explicit entryType is treated as "strength", so pre-Phase-8A
    // clients continue to work unmodified.
    const cleanEntries = exercises.map((entry, i) => {
      const entryType =
        entry && entry.entryType === "cardio" ? "cardio" : "strength";
      const note = validateNote(entry?.note, NOTE_MAX_LENGTH, `Exercise ${i + 1} note`);

      if (entryType === "cardio") {
        const { activityType, data, variant } = validateCardioEntry(entry.cardio, i);
        return {
          entryType: "cardio",
          cardio: { activityType, data, variant },
          note,
        };
      }

      if (!entry || !entry.exercise) {
        const err = new Error(`Exercise ${i + 1} is missing an exercise id`);
        err.status = 400;
        throw err;
      }

      validateWorkoutSets(entry.workoutSets);

      return {
        entryType: "strength",
        exercise: entry.exercise,
        workoutSets: entry.workoutSets.map((s) => ({
          weight: Number(s.weight),
          reps: Number(s.reps),
        })),
        note,
      };
    });

    // Verify every strength entry's exercise belongs to the requesting
    // user, in one query rather than one per entry — mirrors
    // goalController.createGoal's ownership check for the same relation.
    const strengthExerciseIds = [
      ...new Set(
        cleanEntries
          .filter((entry) => entry.entryType === "strength")
          .map((entry) => String(entry.exercise))
      ),
    ];

    // Phase 13D, Part A.3 (Smart Suppression) — muscleGroup is selected
    // alongside _id here so the SAME ownership-check query also tells us
    // which muscles this session just trained, for suppressing any
    // active recovery/neglect reminder that mentions them below. Not a
    // second query — reusing what this call already fetches.
    let trainedMuscleGroups = [];

    if (strengthExerciseIds.length) {
      const ownedExercises = await Exercise.find({
        _id: { $in: strengthExerciseIds },
        createdBy: req.user._id,
      }).select("_id muscleGroup");

      const ownedIds = new Set(ownedExercises.map((e) => String(e._id)));
      const missingIds = strengthExerciseIds.filter((id) => !ownedIds.has(id));

      if (missingIds.length) {
        const err = new Error("One or more selected exercises were not found");
        err.status = 400;
        throw err;
      }

      trainedMuscleGroups = [...new Set(ownedExercises.map((e) => e.muscleGroup).filter(Boolean))];
    }

    const trimmedSessionId = sessionId.trim();
    const numericSessionDuration = Number(sessionDuration);
    const normalizedCustomSessionType = normalizeCustomSessionType(
      sessionType,
      customSessionType
    );

    const docs = cleanEntries.map((entry) => ({
      user: req.user._id,
      entryType: entry.entryType,
      ...(entry.entryType === "cardio"
        ? { cardio: entry.cardio }
        : { exercise: entry.exercise, workoutSets: entry.workoutSets }),
      note: entry.note,
      sessionId: trimmedSessionId,
      sessionDuration: numericSessionDuration,
      sessionType,
      customSessionType: normalizedCustomSessionType,
      startedAt: parsedStartedAt,
      endedAt: parsedEndedAt,
      timingMode: "AUTO",
      sessionNote: cleanSessionNote,
    }));

    const createdWorkouts = await Workout.insertMany(docs, {
      ordered: true,
    });

    // Phase 13B — "Start Planned Workout" completion linkage. Best-effort
    // and non-fatal: a broken link is far less costly than losing the
    // just-saved session, so any failure here is only ever logged, never
    // thrown. Ownership-checked (the plan must belong to this user) so a
    // forged id from another account can't be marked completed by proxy.
    if (plannedWorkoutId) {
      try {
        await PlannedWorkout.updateOne(
          { _id: plannedWorkoutId, user: req.user._id },
          { status: "Completed", completedSessionId: trimmedSessionId }
        );
        // Phase 13D, Part A.3 (Smart Suppression) — "Planner reminder ->
        // Workout completed -> Remove planner reminder." Same dedupeKey
        // reminders/workoutReminders.js uses for every state of this
        // plan's lifecycle (today/starting soon/overdue/missed), so one
        // suppression call clears whichever of those was showing.
        await suppressNotifications(req.user._id, { dedupeKey: `workout:${plannedWorkoutId}` });
      } catch (linkError) {
        console.error("Planned workout completion link failed:", linkError);
      }
    }

    // Phase 13D, Part A.3 — "Recovery reminder -> Muscle trained ->
    // Suppress" (and the same principle for a Neglected Muscle reminder,
    // which is equally stale once the muscle is trained again). Matches
    // on `metadata.muscles` rather than an exact dedupeKey, since a
    // recovery/neglect reminder may be a GROUPED one covering several
    // muscles at once (see reminders/recoveryReminders.js /
    // neglectReminders.js) — this trained session's muscles might only
    // be part of that group.
    if (trainedMuscleGroups.length) {
      try {
        await suppressNotifications(req.user._id, {
          type: { $in: ["recoveryComplete", "muscleGroupNeglected"] },
          "metadata.muscles": { $in: trainedMuscleGroups },
        });
      } catch (suppressError) {
        console.error("Recovery/neglect suppression failed:", suppressError);
      }
    }

    // Goal recalculation is strength-specific (Strength PR and volume/
    // session metrics derive from workoutSets), but that's knowledge that
    // belongs to the goal layer, not this controller. Cardio entries here
    // simply have no `exercise`/`workoutSets` fields — and
    // updateGoals.js's buildWeightsByExercise already skips any entry
    // without a real workoutSets array. So every entry is passed through
    // unfiltered; the goal layer's existing guard is what excludes
    // cardio, not an entryType check duplicated here.
    const entriesForGoals = cleanEntries.map((entry) => ({
      exercise: entry.exercise,
      workoutSets: entry.workoutSets,
    }));

    let goalRecalculationFailed = false;
    let goalNotificationPayloads = [];

    try {
      goalNotificationPayloads = await updateGoalsForSession(req.user._id, entriesForGoals);
    } catch (goalError) {
      console.error("Goal recalculation failed:", goalError);
      goalRecalculationFailed = true;
    }

    // Phase 13A — PR / highest-volume / longest-workout / new-longest-run
    // / goal-completion / streak-milestone notifications, persisted
    // together in one call. Deliberately its own try/catch, independent
    // of goal recalculation above: a notification failure must never
    // block the session save response, same "log and move on" contract
    // every other fire-and-forget side effect in this controller already
    // follows.
    let notifications = [];
    try {
      const strengthEntries = cleanEntries.filter((e) => e.entryType === "strength");
      const cardioEntries = cleanEntries.filter((e) => e.entryType === "cardio");
      const sessionPayloads = await detectWorkoutSessionNotifications(req.user._id, {
        sessionId: trimmedSessionId,
        strengthEntries,
        cardioEntries,
        sessionDuration: numericSessionDuration,
      });
      notifications = await createNotificationsIfNew(req.user._id, [
        ...sessionPayloads,
        ...goalNotificationPayloads,
      ]);
    } catch (notificationError) {
      console.error("Notification generation failed:", notificationError);
    }

    if (goalRecalculationFailed) {
      return res.status(201).json({
        message:
          "Workout session saved successfully, but goal recalculation failed. Please refresh your Goals or recalculate them later.",
        workouts: createdWorkouts,
        goalRecalculationFailed: true,
        notifications,
      });
    }

    return res.status(201).json({
      message: "Workout session saved successfully.",
      workouts: createdWorkouts,
      goalRecalculationFailed: false,
      notifications,
    });
  } catch (error) {
    console.log(error);

    res.status(error.status || 500).json({
      message: error.status ? error.message : "Server Error",
    });
  }
};

exports.getWorkouts = async (req, res) => {
  try {
    const { page = 1, limit = 10, start, end } = req.query;

    let query = {
      user: req.user._id,
    };

    if (start && end) {
      query.createdAt = {
        $gte: new Date(start),
        $lte: new Date(end),
      };
    }

    const workouts = await Workout.find(query)
      .populate("exercise")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json(workouts);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

exports.searchWorkouts = async (req, res) => {
  try {
    const { exercise } = req.query;

    const workouts = await Workout.find({
      user: req.user._id,
    }).populate("exercise");

    // Defensive fix (Phase 8A): cardio entries have no `exercise`, so
    // `workout.exercise.name` would throw. Guard mirrors the pattern
    // already used elsewhere in this codebase (e.g. dashboardController's
    // `if (!w.exercise) return;`).
    const filtered = workouts.filter((workout) =>
      workout.exercise?.name?.toLowerCase().includes(exercise.toLowerCase())
    );

    res.status(200).json(filtered);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

exports.filterByMuscle = async (req, res) => {
  try {
    const { muscle } = req.query;

    const workouts = await Workout.find({
      user: req.user._id,
    }).populate("exercise");

    // Defensive fix (Phase 8A): cardio entries have no `exercise`, so
    // `workout.exercise.muscleGroup` would throw without this guard.
    const filtered = workouts.filter(
      (workout) => workout.exercise && workout.exercise.muscleGroup === muscle
    );

    res.status(200).json(filtered);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

exports.updateWorkout = async (req, res) => {
  try {
    const workout = await Workout.findById(req.params.id);

    if (!workout) {
      return res.status(404).json({
        message: "Workout not found",
      });
    }

    if (workout.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    // Only workoutSets/exercise are editable here — previously the
    // entire req.body (including `user`) was passed straight into
    // findByIdAndUpdate, which let a request reassign a workout to a
    // different account. Whitelisting closes that hole.
    const updates = {};

    if (req.body.workoutSets !== undefined) {
      validateWorkoutSets(req.body.workoutSets);

      updates.workoutSets = req.body.workoutSets.map((s) => ({
        weight: Number(s.weight),
        reps: Number(s.reps),
      }));
    }

    if (req.body.exercise !== undefined) {
      const exerciseDoc = await Exercise.findOne({
        _id: req.body.exercise,
        createdBy: req.user._id,
      });
      if (!exerciseDoc) {
        return res.status(400).json({
          message: "Selected exercise was not found",
        });
      }
      updates.exercise = exerciseDoc._id;
    }

    const updatedWorkout = await Workout.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (
      updates.workoutSets !== undefined ||
      updates.exercise !== undefined
    ) {
      await updateGoalsForWorkout(
        req.user._id,
        updatedWorkout.exercise,
        updatedWorkout.workoutSets
      );
    }

    res.status(200).json(updatedWorkout);
  } catch (error) {
    console.log(error);

    res.status(error.status || 500).json({
      message: error.status ? error.message : "Server Error",
    });
  }
};

// Workout Session Editing & Time Tracking. sessionDuration/startedAt/
// endedAt/timingMode are session-level metadata duplicated across every
// Workout document sharing a sessionId (same pattern sessionType already
// uses) — updateMany keeps every document in the session consistent in
// one write, mirroring deleteWorkoutSession's ownership + sessionId
// lookup just below.
exports.updateWorkoutSessionTiming = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { startedAt, endedAt, sessionDuration, timingMode } = req.body;

    if (!sessionId || !sessionId.trim()) {
      return res.status(400).json({ message: "sessionId is required" });
    }

    const sessionWorkouts = await Workout.find({
      user: req.user._id,
      sessionId: sessionId.trim(),
    }).select("_id");

    if (!sessionWorkouts.length) {
      return res.status(404).json({ message: "Session not found" });
    }

    const validated = validateSessionTiming({
      startedAt,
      endedAt,
      sessionDuration,
      timingMode,
    });

    await Workout.updateMany(
      { user: req.user._id, sessionId: sessionId.trim() },
      {
        startedAt: validated.startedAt,
        endedAt: validated.endedAt,
        sessionDuration: validated.sessionDuration,
        timingMode: validated.timingMode,
      },
      { runValidators: true }
    );

    res.status(200).json({
      message: "Workout timing updated successfully.",
      sessionId: sessionId.trim(),
      startedAt: validated.startedAt,
      endedAt: validated.endedAt,
      sessionDuration: validated.sessionDuration,
      timingMode: validated.timingMode,
      warning: validated.warning,
    });
  } catch (error) {
    console.log(error);

    res.status(error.status || 500).json({
      message: error.status ? error.message : "Server Error",
    });
  }
};

exports.deleteWorkout = async (req, res) => {
  try {
    const workout = await Workout.findById(req.params.id);

    if (!workout) {
      return res.status(404).json({
        message: "Workout not found",
      });
    }

    if (workout.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    await workout.deleteOne();

    await recalculateGoalsForExercise(req.user._id, workout.exercise);

    res.status(200).json({
      message: "Workout deleted successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

// Deletes every workout belonging to a session in ONE query, then
// recalculates goals ONCE for the whole session (see
// recalculateGoalsForExercises in utils/recalculateGoals.js) instead of
// once per exercise. Legacy standalone workouts (no sessionId) are not
// reachable through this route at all — the frontend falls back to the
// existing single-workout DELETE /workouts/:id for those, so this handler
// only ever deals with real, non-null sessionId values.
exports.deleteWorkoutSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId || !sessionId.trim()) {
      return res.status(400).json({
        message: "sessionId is required",
      });
    }

    const sessionWorkouts = await Workout.find({
      user: req.user._id,
      sessionId: sessionId.trim(),
    }).select("exercise");

    if (!sessionWorkouts.length) {
      return res.status(404).json({
        message: "Session not found",
      });
    }

    const exerciseIds = sessionWorkouts.map((w) => w.exercise);

    await Workout.deleteMany({
      user: req.user._id,
      sessionId: sessionId.trim(),
    });

    await recalculateGoalsForExercises(req.user._id, exerciseIds);

    res.status(200).json({
      message: "Session deleted successfully",
      deletedCount: sessionWorkouts.length,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};