// Phase 13C, section 15 — the centralized reminder engine orchestrator.
// Each generator module returns plain candidate objects (section 16's
// schema, pre-persistence — type/category/icon/title/subtitle/
// navigationTarget/dedupeKey/expiresAt/metadata; priority is resolved
// here via TYPE_PRIORITY unless a generator already stamped a dynamic
// one, e.g. neglectReminders.js's severity-based priority). This is the
// ONE place that merges them, applies category preferences (section 13),
// prioritizes (section 9), and groups (section 10) — every consumer
// (Dashboard's generateNotifications call, a future Calendar/Goals
// badge) reads from this single function rather than assembling its own
// subset.
import { generateWorkoutReminders } from "./workoutReminders";
import { generateGoalReminders } from "./goalReminders";
import { generateRecoveryReminders } from "./recoveryReminders";
import { generateStreakReminders } from "./streakReminders";
import { generateNeglectReminders } from "./neglectReminders";
import { generateCardioReminders } from "./cardioReminders";
import { generatePlannerReminders } from "./plannerReminders";
import { generateAchievementReminders } from "./achievementReminders";
import { generateIntelligenceReminders } from "./intelligenceReminders";
import { isReminderCategoryEnabled } from "./reminderPreferences";
import { TYPE_PRIORITY, getPriorityRank, getReminderPreferenceCategory } from "../constants/notificationTypes";
import { dayKey } from "./reminderUtils";

export function prioritizeReminders(reminders) {
  return [...reminders].sort(
    (a, b) => getPriorityRank(a.priority) - getPriorityRank(b.priority)
  );
}

// Section 10 — generic fallback grouping: recovery/neglect already group
// naturally within their own generators (bespoke, better-phrased
// summaries); this catches everything else that still piles up 3+ items
// in one category during a single generation pass (e.g. several cardio
// reminders at once). Never groups high/critical items — those must
// stay individually visible, not buried in a summary.
const GROUPABLE_MIN_COUNT = 3;

export function groupReminders(reminders) {
  const groupable = reminders.filter(
    (r) => r.priority === "low" || r.priority === "medium"
  );
  const rest = reminders.filter((r) => !groupable.includes(r));

  const byCategory = new Map();
  groupable.forEach((r) => {
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category).push(r);
  });

  const result = [...rest];
  byCategory.forEach((items, category) => {
    if (items.length < GROUPABLE_MIN_COUNT) {
      result.push(...items);
      return;
    }
    const keys = items.map((i) => i.dedupeKey).sort();
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    result.push({
      type: "groupedReminder",
      category,
      priority: items.some((i) => i.priority === "medium") ? "medium" : "low",
      icon: "Bell",
      title: `${items.length} ${category} reminders`,
      subtitle: items.map((i) => i.title).join(", "),
      navigationTarget: null,
      // Day-scoped rather than content-hashed: re-generating the same
      // day's group updates the same notification instead of minting a
      // new one every time the underlying set shifts slightly.
      dedupeKey: `grouped:${category}:${dayKey(new Date())}`,
      expiresAt: endOfToday,
      metadata: { groupedDedupeKeys: keys },
    });
  });

  return result;
}

// The single orchestrator every consumer should call. `context` carries
// whatever each sub-generator needs — all of it data the caller (usually
// Dashboard's fetchDashboardData) already fetched for its own use, never
// a new request fired just for reminders.
export function generateReminders({ workouts = [], goals = [], plannedWorkouts = [] } = {}) {
  const raw = [
    ...generateWorkoutReminders(plannedWorkouts),
    ...generateGoalReminders(goals),
    ...generateRecoveryReminders(workouts),
    ...generateStreakReminders(workouts),
    ...generateNeglectReminders(workouts),
    ...generateCardioReminders(workouts),
    ...generatePlannerReminders(plannedWorkouts),
    ...generateAchievementReminders(workouts),
    ...generateIntelligenceReminders(workouts),
  ];

  const withPriority = raw.map((r) => ({
    ...r,
    priority: r.priority || TYPE_PRIORITY[r.type] || "medium",
  }));

  const enabled = withPriority.filter((r) =>
    isReminderCategoryEnabled(getReminderPreferenceCategory(r.type))
  );

  return prioritizeReminders(groupReminders(enabled));
}
