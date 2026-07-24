const { SESSION_TYPES, OTHER_SESSION_TYPE } = require("../constants/sessionTypes");
const { CARDIO_ACTIVITIES, CARDIO_METRICS, CARDIO_ACTIVITY_VARIANTS } = require("../constants/cardioMetadata");

const validateWorkoutSets = (workoutSets) => {
  if (!Array.isArray(workoutSets) || workoutSets.length === 0) {
    const err = new Error("workoutSets must be a non-empty array");
    err.status = 400;
    throw err;
  }

  workoutSets.forEach((s, i) => {
    if (
      s.weight === undefined ||
      s.reps === undefined ||
      s.weight === null ||
      s.reps === null ||
      s.weight === "" ||
      s.reps === "" ||
      isNaN(Number(s.weight)) ||
      isNaN(Number(s.reps))
    ) {
      const err = new Error(`Set ${i + 1} needs a valid weight and reps`);
      err.status = 400;
      throw err;
    }

    const weight = Number(s.weight);
    const reps = Number(s.reps);

    if (weight < 0) {
      const err = new Error(`Set ${i + 1}: weight cannot be negative`);
      err.status = 400;
      throw err;
    }

    if (reps < 1) {
      const err = new Error(`Set ${i + 1}: reps must be at least 1`);
      err.status = 400;
      throw err;
    }

    if (!Number.isInteger(reps)) {
      const err = new Error(`Set ${i + 1}: reps must be a whole number`);
      err.status = 400;
      throw err;
    }
  });
};

const validateSessionMeta = (sessionId, sessionDuration) => {
  if (!sessionId || typeof sessionId !== "string" || !sessionId.trim()) {
    const err = new Error("sessionId is required");
    err.status = 400;
    throw err;
  }

  if (
    sessionDuration === undefined ||
    sessionDuration === null ||
    sessionDuration === "" ||
    isNaN(Number(sessionDuration)) ||
    Number(sessionDuration) < 0
  ) {
    const err = new Error("sessionDuration must be a valid number >= 0");
    err.status = 400;
    throw err;
  }
};

// Validates sessionType against the allowed enum, and enforces that
// customSessionType is present (and non-blank) whenever sessionType is
// "Other". Kept separate from validateSessionMeta so existing call sites
// of validateSessionMeta are untouched — this is called only from the
// session-creation flow that now also accepts sessionType.
const validateSessionType = (sessionType, customSessionType) => {
  if (sessionType === undefined || sessionType === null || sessionType === "") {
    const err = new Error("sessionType is required");
    err.status = 400;
    throw err;
  }

  if (!SESSION_TYPES.includes(sessionType)) {
    const err = new Error(
      `sessionType must be one of: ${SESSION_TYPES.join(", ")}`
    );
    err.status = 400;
    throw err;
  }

  if (sessionType === OTHER_SESSION_TYPE) {
    if (
      !customSessionType ||
      typeof customSessionType !== "string" ||
      !customSessionType.trim()
    ) {
      const err = new Error(
        'customSessionType is required when sessionType is "Other"'
      );
      err.status = 400;
      throw err;
    }
  }
};

// customSessionType is only ever meaningful when sessionType is "Other".
// For every other sessionType it must be stored as null, regardless of
// what the client sent, so history/filtering never has to guess which
// field is authoritative.
const normalizeCustomSessionType = (sessionType, customSessionType) => {
  if (sessionType !== OTHER_SESSION_TYPE) return null;
  return customSessionType.trim();
};

// requireSessionMeta defaults to true (new workout creation). Pass false
// for updates, where sessionId/sessionDuration aren't being (re)supplied.
const validateWorkoutPayload = ({
  workoutSets,
  sessionId,
  sessionDuration,
  requireSessionMeta = true,
}) => {
  validateWorkoutSets(workoutSets);
  if (requireSessionMeta) {
    validateSessionMeta(sessionId, sessionDuration);
  }
};

// Metadata-driven cardio validation (Phase 8A). Which metrics are
// REQUIRED comes entirely from CARDIO_ACTIVITIES in cardioMetadata.js —
// there is no per-activity switch statement here or anywhere else. Any
// metric not required for the given activityType is still accepted if
// provided (and validated as a non-negative number), since every metric
// is optional at the data level; only the required subset varies by
// activity.
const validateCardioEntry = (cardio, index) => {
  if (!cardio || typeof cardio !== "object") {
    const err = new Error(
      `Entry ${index + 1}: cardio data is required for a cardio entry`
    );
    err.status = 400;
    throw err;
  }

  const { activityType, data } = cardio;

  if (!activityType || !CARDIO_ACTIVITIES[activityType]) {
    const err = new Error(
      `Entry ${index + 1}: activityType must be one of: ${Object.keys(
        CARDIO_ACTIVITIES
      ).join(", ")}`
    );
    err.status = 400;
    throw err;
  }

  const rawData = data && typeof data === "object" ? data : {};
  const { requiredMetrics } = CARDIO_ACTIVITIES[activityType];

  requiredMetrics.forEach((metricKey) => {
    const value = rawData[metricKey];
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      isNaN(Number(value)) ||
      Number(value) < 0
    ) {
      const label = CARDIO_METRICS[metricKey]?.label || metricKey;
      const err = new Error(
        `Entry ${index + 1}: ${label} is required for ${activityType}`
      );
      err.status = 400;
      throw err;
    }
  });

  const cleanData = {};
  Object.keys(CARDIO_METRICS).forEach((metricKey) => {
    const value = rawData[metricKey];
    if (value === undefined || value === null || value === "") return;

    if (isNaN(Number(value)) || Number(value) < 0) {
      const label = CARDIO_METRICS[metricKey]?.label || metricKey;
      const err = new Error(
        `Entry ${index + 1}: ${label} must be a valid non-negative number`
      );
      err.status = 400;
      throw err;
    }

    cleanData[metricKey] = Number(value);
  });

  // Phase 12 — optional variant (e.g. "Treadmill Run" under "Running").
  // Omitting it is always valid, regardless of whether this activity
  // has any variants defined at all — a variant is a refinement a
  // caller may choose to add, never a requirement. When one IS sent, it
  // must be a real option for this specific activityType; an activity
  // with no variants defined (Elliptical, Stair Climber, Other) simply
  // has no valid values to send, so any non-empty variant for those is
  // rejected rather than silently stored as an arbitrary free-text value.
  let variant = null;
  if (cardio.variant !== undefined && cardio.variant !== null && cardio.variant !== "") {
    const allowedVariants = CARDIO_ACTIVITY_VARIANTS[activityType] || [];
    if (!allowedVariants.includes(cardio.variant)) {
      const err = new Error(
        allowedVariants.length
          ? `Entry ${index + 1}: variant must be one of: ${allowedVariants.join(", ")}`
          : `Entry ${index + 1}: ${activityType} does not support a variant`
      );
      err.status = 400;
      throw err;
    }
    variant = cardio.variant;
  }

  return { activityType, data: cleanData, variant };
};

// Live Workout Mode (Phase 11) notes. Optional everywhere — omitting a
// note is the overwhelmingly common case, so undefined/null/"" all
// normalize to null rather than being treated as an error.
const validateNote = (note, maxLength, label) => {
  if (note === undefined || note === null || note === "") return null;

  if (typeof note !== "string") {
    const err = new Error(`${label} must be text`);
    err.status = 400;
    throw err;
  }

  const trimmed = note.trim();
  if (!trimmed) return null;

  if (trimmed.length > maxLength) {
    const err = new Error(`${label} must be ${maxLength} characters or fewer`);
    err.status = 400;
    throw err;
  }

  return trimmed;
};

const EIGHT_HOURS_IN_MINUTES = 8 * 60;

// Workout Session Editing & Time Tracking. Two independent shapes:
// AUTO (startedAt + endedAt given, duration derived) and MANUAL (a
// duration given directly, startedAt/endedAt optional/best-effort).
// Hard errors (End < Start, duration < 1 minute) throw; the "> 8 hours"
// case is intentionally NOT thrown — the spec calls for a warning, not a
// block, so it's returned on the result for the controller to pass back.
const validateSessionTiming = ({ startedAt, endedAt, sessionDuration, timingMode }) => {
  if (timingMode !== "AUTO" && timingMode !== "MANUAL") {
    const err = new Error('timingMode must be "AUTO" or "MANUAL"');
    err.status = 400;
    throw err;
  }

  let parsedStart = null;
  let parsedEnd = null;

  if (startedAt !== undefined && startedAt !== null && startedAt !== "") {
    parsedStart = new Date(startedAt);
    if (Number.isNaN(parsedStart.getTime())) {
      const err = new Error("startedAt is not a valid date/time");
      err.status = 400;
      throw err;
    }
  }

  if (endedAt !== undefined && endedAt !== null && endedAt !== "") {
    parsedEnd = new Date(endedAt);
    if (Number.isNaN(parsedEnd.getTime())) {
      const err = new Error("endedAt is not a valid date/time");
      err.status = 400;
      throw err;
    }
  }

  if (parsedStart && parsedEnd && parsedEnd <= parsedStart) {
    const err = new Error("End time must be after start time");
    err.status = 400;
    throw err;
  }

  let durationMinutes;

  if (timingMode === "AUTO") {
    if (!parsedStart || !parsedEnd) {
      const err = new Error("startedAt and endedAt are both required in Automatic mode");
      err.status = 400;
      throw err;
    }
    durationMinutes = Math.round((parsedEnd - parsedStart) / 60000);
  } else {
    if (
      sessionDuration === undefined ||
      sessionDuration === null ||
      sessionDuration === "" ||
      isNaN(Number(sessionDuration))
    ) {
      const err = new Error("A duration is required in Manual mode");
      err.status = 400;
      throw err;
    }
    durationMinutes = Math.round(Number(sessionDuration));
  }

  if (durationMinutes < 1) {
    const err = new Error("Duration must be at least 1 minute");
    err.status = 400;
    throw err;
  }

  return {
    startedAt: parsedStart,
    endedAt: parsedEnd,
    sessionDuration: durationMinutes,
    timingMode,
    warning:
      durationMinutes > EIGHT_HOURS_IN_MINUTES
        ? "This workout is logged as longer than 8 hours — double-check the times if that wasn't intentional."
        : null,
  };
};

// Session creation sends startedAt/endedAt captured directly from the live
// workout timer (not user-typed), so unlike validateSessionTiming this is
// just a sanity check on what's already trustworthy data — no duration
// recomputation, no AUTO/MANUAL branching. Both fields are optional (older
// clients, or a session somehow finished without a startTime) so the
// resulting workout simply has no timing until edited via "Edit Workout
// Timing", same as before this feature existed.
const validateOptionalSessionTimestamps = (startedAt, endedAt) => {
  let parsedStart = null;
  let parsedEnd = null;

  if (startedAt !== undefined && startedAt !== null && startedAt !== "") {
    parsedStart = new Date(startedAt);
    if (Number.isNaN(parsedStart.getTime())) {
      const err = new Error("startedAt is not a valid date/time");
      err.status = 400;
      throw err;
    }
  }

  if (endedAt !== undefined && endedAt !== null && endedAt !== "") {
    parsedEnd = new Date(endedAt);
    if (Number.isNaN(parsedEnd.getTime())) {
      const err = new Error("endedAt is not a valid date/time");
      err.status = 400;
      throw err;
    }
  }

  if (parsedStart && parsedEnd && parsedEnd <= parsedStart) {
    const err = new Error("End time must be after start time");
    err.status = 400;
    throw err;
  }

  return { startedAt: parsedStart, endedAt: parsedEnd };
};

module.exports = {
  validateWorkoutPayload,
  validateWorkoutSets,
  validateSessionMeta,
  validateSessionType,
  normalizeCustomSessionType,
  validateCardioEntry,
  validateSessionTiming,
  validateOptionalSessionTimestamps,
  validateNote,
};