// Single source of truth for workout Session Types on the frontend.
// Used by StartWorkoutModal (session creation) and WorkoutHistory's
// Session Type filter, so both always agree on the allowed list.
// Mirrors server/constants/sessionTypes.js — if this list changes,
// update both.

export const SESSION_TYPES = [
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

export const OTHER_SESSION_TYPE = "Other";

// Convenience list for filter dropdowns ("All" + every real type).
export const SESSION_TYPE_FILTER_OPTIONS = ["All", ...SESSION_TYPES];

export const isValidSessionType = (value) => SESSION_TYPES.includes(value);

// Badge color per Session Type (Workout History polish). Each entry gives
// a background + text color pair pulled from a fixed, readable palette —
// not derived from --go-primary, since the whole point is that each type
// is visually distinct from the others. Legacy sessions (sessionType is
// null) and any value outside SESSION_TYPES fall back to "default" (gray)
// via getSessionTypeColor below, so the UI never breaks on unexpected data.
export const SESSION_TYPE_COLORS = {
  Push: { bg: "#fee2e2", text: "#b91c1c" },
  Pull: { bg: "#dbeafe", text: "#1d4ed8" },
  Legs: { bg: "#ffedd5", text: "#c2410c" },
  Upper: { bg: "#ede9fe", text: "#6d28d9" },
  Lower: { bg: "#dcfce7", text: "#15803d" },
  "Full Body": { bg: "#cffafe", text: "#0e7490" },
  Arms: { bg: "#fce7f3", text: "#be185d" },
  Cardio: { bg: "#fef9c3", text: "#a16207" },
  Other: { bg: "#e5e7eb", text: "#374151" },
  default: { bg: "#e5e7eb", text: "#374151" },
};

export const getSessionTypeColor = (sessionType) =>
  SESSION_TYPE_COLORS[sessionType] || SESSION_TYPE_COLORS.default;