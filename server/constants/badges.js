const BADGE_CATALOG = [
  { id: "sessions_1", name: "First Rep", description: "Complete 1 session", category: "milestone", type: "sessions", threshold: 1, tier: 1, color: "#2dd4bf" },
  { id: "sessions_10", name: "Getting Started", description: "Complete 10 sessions", category: "milestone", type: "sessions", threshold: 10, tier: 1, color: "#3b82f6" },
  { id: "sessions_25", name: "Committed", description: "Complete 25 sessions", category: "milestone", type: "sessions", threshold: 25, tier: 2, color: "#6366f1" },
  { id: "sessions_100", name: "Century", description: "Complete 100 sessions", category: "milestone", type: "sessions", threshold: 100, tier: 2, color: "#22c55e" },
  { id: "sessions_250", name: "Dedicated", description: "Complete 250 sessions", category: "milestone", type: "sessions", threshold: 250, tier: 3, color: "#f59e0b" },
  { id: "sessions_500", name: "Iron Regular", description: "Complete 500 sessions", category: "milestone", type: "sessions", threshold: 500, tier: 3, color: "#eab308" },
  { id: "sessions_1000", name: "Legendary Routine", description: "Complete 1,000 sessions", category: "milestone", type: "sessions", threshold: 1000, tier: 3, color: "#e2e8f0" },

  { id: "streak_7", name: "7-Day Streak", description: "Train 7 days in a row", category: "consistency", type: "streak", threshold: 7, tier: 1, color: "#fb923c" },
  { id: "streak_30", name: "30-Day Streak", description: "Train 30 days in a row", category: "consistency", type: "streak", threshold: 30, tier: 2, color: "#f97316" },
  { id: "streak_100", name: "100-Day Streak", description: "Train 100 days in a row", category: "consistency", type: "streak", threshold: 100, tier: 3, color: "#dc2626" },
  { id: "streak_250", name: "Consistency King", description: "Train 250 days in a row", category: "consistency", type: "streak", threshold: 250, tier: 3, color: "#be123c" },
  { id: "days_365", name: "Year Round", description: "Train on 365 distinct days", category: "consistency", type: "totalDays", threshold: 365, tier: 3, color: "#10b981" },

  { id: "pr_1", name: "First PR", description: "Record your first PR", category: "strength", type: "prCount", threshold: 1, tier: 1, color: "#a855f7" },
  { id: "pr_10", name: "PR Hunter", description: "Record 10 PRs", category: "strength", type: "prCount", threshold: 10, tier: 1, color: "#8b5cf6" },
  { id: "pr_25", name: "Record Breaker", description: "Record 25 PRs", category: "strength", type: "prCount", threshold: 25, tier: 2, color: "#d946ef" },
  { id: "pr_50", name: "Iron Chaser", description: "Record 50 PRs", category: "strength", type: "prCount", threshold: 50, tier: 2, color: "#7c3aed" },
  { id: "pr_100", name: "Unstoppable", description: "Record 100 PRs", category: "strength", type: "prCount", threshold: 100, tier: 3, color: "#9333ea" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_COLORS = [
  "#38bdf8", "#f472b6", "#4ade80", "#a3e635",
  "#facc15", "#fb923c", "#ef4444", "#ec4899",
  "#a855f7", "#f59e0b", "#b45309", "#14b8a6",
];

const MONTHLY_CONSISTENCY_THRESHOLD = 25;
const MONTHLY_BADGE_TIER = 2;

module.exports = {
  BADGE_CATALOG,
  MONTH_NAMES,
  MONTH_COLORS,
  MONTHLY_CONSISTENCY_THRESHOLD,
  MONTHLY_BADGE_TIER,
};
