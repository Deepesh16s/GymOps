// Phase 13C — tiny date helpers shared across the reminders/ engine's
// sibling generator files (see reminderEngine.js for the orchestrator).
// Deliberately local to this folder rather than imported from
// workoutUtils.js/dashboardInsights.js/goalAnalytics.js, each of which
// already has its own private copy of the same few lines — see
// goalAnalytics.js's header comment for why this codebase treats that as
// the right call for six lines of date math rather than a cross-domain
// dependency. This file exists only because every generator IN THIS
// FOLDER needs the exact same helpers, not to bridge to another domain.
export const MS_PER_DAY = 86400000;

export const dayKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const startOfWeek = (date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMon);
  return d;
};

export const daysAgo = (date) => Math.floor((Date.now() - new Date(date).getTime()) / MS_PER_DAY);

export const isToday = (date) => dayKey(date) === dayKey(new Date());

export const isYesterday = (date) => {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return dayKey(date) === dayKey(y);
};

export const isTomorrow = (date) => {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return dayKey(date) === dayKey(t);
};
