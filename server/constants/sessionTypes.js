// Single source of truth for the Session Type enum on the backend.
// Shared between the Workout model (schema-level enum) and
// validateWorkoutPayload (request-level validation) so the two can
// never drift apart. Mirrors src/constants/sessionTypes.js on the
// frontend — if this list changes, update both.

const SESSION_TYPES = [
  "Push",
  "Pull",
  "Legs",
  "Upper",
  "Lower",
  "Full Body",
  "Arms",
  "Cardio",
  "Other",
];

const OTHER_SESSION_TYPE = "Other";

module.exports = { SESSION_TYPES, OTHER_SESSION_TYPE };