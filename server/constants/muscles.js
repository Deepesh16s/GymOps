
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
