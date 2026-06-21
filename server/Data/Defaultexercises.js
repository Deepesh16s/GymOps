/* server/data/defaultExercises.js
   ----------------------------------------------------------------
   Default exercise library seeded for every new user on registration
   (email/password) or first-time Google sign-in. `isDefault` and
   `createdBy` are NOT set here — they're attached in authController.js
   at insert time (isDefault: true, createdBy: user._id).
   ---------------------------------------------------------------- */

const defaultExercises = [
  // ── Chest ──
  { name: "Bench Press", muscleGroup: "Chest" },
  { name: "Incline DB Press", muscleGroup: "Chest" },
  { name: "Chest Fly", muscleGroup: "Chest" },

  // ── Back ──
  { name: "Lat Pulldown", muscleGroup: "Back" },
  { name: "Seated Cable Row", muscleGroup: "Back" },
  { name: "Deadlift", muscleGroup: "Back" },
  { name: "Pull Up", muscleGroup: "Back" },

  // ── Shoulders ──
  { name: "Shoulder Press", muscleGroup: "Shoulders" },
  { name: "Lateral Raise", muscleGroup: "Shoulders" },
  { name: "Rear Delt Fly", muscleGroup: "Shoulders" },

  // ── Biceps ──
  { name: "Bicep Curl", muscleGroup: "Biceps" },
  { name: "Hammer Curl", muscleGroup: "Biceps" },

  // ── Triceps ──
  { name: "Tricep Pushdown", muscleGroup: "Triceps" },
  { name: "Overhead Extension", muscleGroup: "Triceps" },

  // ── Legs ──
  { name: "Squat", muscleGroup: "Legs" },
  { name: "Leg Press", muscleGroup: "Legs" },
  { name: "Leg Curl", muscleGroup: "Legs" },
  { name: "Leg Extension", muscleGroup: "Legs" },
  { name: "Calf Raise", muscleGroup: "Legs" },

  // ── Abs ──
  { name: "Rope Crunch", muscleGroup: "Abs" },
  { name: "Hanging Leg Raise", muscleGroup: "Abs" },
  { name: "Plank", muscleGroup: "Abs" },
];

module.exports = defaultExercises;