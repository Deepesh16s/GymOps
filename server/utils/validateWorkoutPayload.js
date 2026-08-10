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

const normalizeCustomSessionType = (sessionType, customSessionType) => {
  if (sessionType !== OTHER_SESSION_TYPE) return null;
  return customSessionType.trim();
};

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