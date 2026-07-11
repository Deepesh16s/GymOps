
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

module.exports = { validateWorkoutPayload, validateWorkoutSets, validateSessionMeta };