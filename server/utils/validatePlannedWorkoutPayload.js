const { SESSION_TYPES } = require("../constants/sessionTypes");
const { CARDIO_ACTIVITY_TYPES } = require("../constants/cardioMetadata");
const {
  PLANNED_WORKOUT_PRIORITIES,
  RECURRENCE_TYPES,
} = require("../constants/plannedWorkoutTypes");

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const throwBadRequest = (message) => {
  const err = new Error(message);
  err.status = 400;
  throw err;
};

function validatePlannedWorkoutPayload(body, { partial = false } = {}) {
  const clean = {};

  if (!partial || body.title !== undefined) {
    if (!body.title || !body.title.trim()) throwBadRequest("Title is required");
    clean.title = body.title.trim();
  }

  if (!partial || body.workoutType !== undefined) {
    if (!SESSION_TYPES.includes(body.workoutType)) {
      throwBadRequest(`workoutType must be one of: ${SESSION_TYPES.join(", ")}`);
    }
    clean.workoutType = body.workoutType;
  }

  if (body.cardioActivityType !== undefined && body.cardioActivityType !== null) {
    if (!CARDIO_ACTIVITY_TYPES.includes(body.cardioActivityType)) {
      throwBadRequest(`cardioActivityType must be one of: ${CARDIO_ACTIVITY_TYPES.join(", ")}`);
    }
    clean.cardioActivityType = body.cardioActivityType;
  }

  if (!partial || body.scheduledDate !== undefined) {
    const parsed = new Date(body.scheduledDate);
    if (Number.isNaN(parsed.getTime())) throwBadRequest("scheduledDate is not a valid date");
    clean.scheduledDate = parsed;
  }

  if (body.scheduledTime !== undefined && body.scheduledTime !== null && body.scheduledTime !== "") {
    if (!TIME_PATTERN.test(body.scheduledTime)) {
      throwBadRequest("scheduledTime must be in HH:mm format");
    }
    clean.scheduledTime = body.scheduledTime;
  }

  if (body.exercises !== undefined) {
    if (!Array.isArray(body.exercises)) throwBadRequest("exercises must be an array");
    clean.exercises = body.exercises.map((e, i) => {
      if (!e || !e.exercise) throwBadRequest(`exercises[${i}] is missing an exercise id`);
      return {
        exercise: e.exercise,
        targetSets:
          e.targetSets === undefined || e.targetSets === null || e.targetSets === ""
            ? null
            : Number(e.targetSets),
        notes: e.notes || null,
      };
    });
  }

  if (body.estimatedDuration !== undefined) {
    if (body.estimatedDuration === null || body.estimatedDuration === "") {
      clean.estimatedDuration = null;
    } else if (isNaN(Number(body.estimatedDuration)) || Number(body.estimatedDuration) < 0) {
      throwBadRequest("estimatedDuration must be a non-negative number");
    } else {
      clean.estimatedDuration = Number(body.estimatedDuration);
    }
  }

  if (body.notes !== undefined) clean.notes = body.notes || null;

  if (body.priority !== undefined) {
    if (!PLANNED_WORKOUT_PRIORITIES.includes(body.priority)) {
      throwBadRequest(`priority must be one of: ${PLANNED_WORKOUT_PRIORITIES.join(", ")}`);
    }
    clean.priority = body.priority;
  }

  if (body.recurrence !== undefined) {
    const r = body.recurrence || { type: "none" };
    if (!RECURRENCE_TYPES.includes(r.type)) {
      throwBadRequest(`recurrence.type must be one of: ${RECURRENCE_TYPES.join(", ")}`);
    }
    clean.recurrence = {
      type: r.type,
      weekdays: Array.isArray(r.weekdays) ? r.weekdays.map(Number) : [],
      interval: r.interval ? Math.max(1, Number(r.interval)) : 1,
      endDate: r.endDate ? new Date(r.endDate) : null,
    };
  }

  return clean;
}

module.exports = { validatePlannedWorkoutPayload };
