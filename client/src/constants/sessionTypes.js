
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

export const SESSION_TYPE_FILTER_OPTIONS = ["All", ...SESSION_TYPES];

export const isValidSessionType = (value) => SESSION_TYPES.includes(value);

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