// Single source of truth for the Muscle Group taxonomy on the backend.
// Shared by the Exercise model (schema-level enum), exerciseController
// (request-level validation), and the default exercise seed data, so
// they can never drift apart. Mirrors src/constants/muscles.js on the
// frontend — if this list changes, update both.
//
// "Legs" is a legacy value: exercises seeded/created before Quads/
// Glutes/Calves/Hamstrings existed as their own groups may still carry
// it. It stays accepted here (so those old documents keep validating
// and remain fully functional) but is intentionally excluded from
// MUSCLES — new exercises/workouts must use one of the current groups.

const MUSCLES = [
  "Chest",
  "Back",
  "Shoulders",
  "Traps",
  "Biceps",
  "Triceps",
  "Forearms",
  "Abs",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Calves",
];

const LEGACY_MUSCLES = ["Legs"];

const ALL_ACCEPTED_MUSCLES = [...MUSCLES, ...LEGACY_MUSCLES];

const isValidMuscle = (value) => ALL_ACCEPTED_MUSCLES.includes(value);

module.exports = { MUSCLES, LEGACY_MUSCLES, ALL_ACCEPTED_MUSCLES, isValidMuscle };
