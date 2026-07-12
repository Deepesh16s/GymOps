const { SESSION_TYPES, OTHER_SESSION_TYPE } = require("../constants/sessionTypes");
const { CARDIO_ACTIVITIES, CARDIO_METRICS } = require("../constants/cardioMetadata");

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

  return { activityType, data: cleanData };
};

module.exports = {
  validateWorkoutPayload,
  validateWorkoutSets,
  validateSessionMeta,
  validateSessionType,
  normalizeCustomSessionType,
  validateCardioEntry,
};