// Phase 13A — frontend half of a deliberately UNSHARED, mirrored pair;
// see server/constants/notificationTypes.js for the backend
// counterpart. Same separation cardioMetadata.js already established:
// not imported across the frontend/backend boundary.
import {
  Trophy,
  PartyPopper,
  Flame,
  Timer,
  Footprints,
  Target,
  HeartPulse,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Bell,
  CalendarPlus,
  CalendarClock,
  CalendarX,
  Repeat,
  Dumbbell,
  Clock,
  Ban,
  Sparkles,
  Layers,
} from "lucide-react";

export const NOTIFICATION_CATEGORIES = {
  PROGRESS: "progress",
  CARDIO: "cardio",
  REMINDERS: "reminders",
  INSIGHTS: "insights",
};

// Panel filter bar (section 4). "Achievements" is the user-facing label
// for the "progress" category — Goal Completed notifications are
// grouped under it too (same placement the spec's own category examples
// use), rather than a separate "Goals" filter, so a goal completion
// doesn't have to pick between two competing filters.
export const NOTIFICATION_FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: NOTIFICATION_CATEGORIES.PROGRESS, label: "Achievements" },
  { key: NOTIFICATION_CATEGORIES.CARDIO, label: "Cardio" },
  { key: NOTIFICATION_CATEGORIES.REMINDERS, label: "Reminders" },
  { key: NOTIFICATION_CATEGORIES.INSIGHTS, label: "Insights" },
];

// A Notification document's `icon` field is a plain string (the backend
// never imports a UI library) — this is the lookup that turns it into
// an actual component, the exact pattern cardioMetadata.js's
// CARDIO_ACTIVITY_ICONS already established. `Bell` is the fallback for
// any icon name this build doesn't recognize (e.g. an older client
// after a new notification type ships), so an unrecognized type never
// renders visibly broken.
const NOTIFICATION_ICON_MAP = {
  Trophy,
  PartyPopper,
  Flame,
  Timer,
  Footprints,
  Target,
  HeartPulse,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CalendarPlus,
  CalendarClock,
  CalendarX,
  Repeat,
  Dumbbell,
  Clock,
  Ban,
  Sparkles,
  Layers,
};

export const getNotificationIcon = (iconName) => NOTIFICATION_ICON_MAP[iconName] || Bell;

// Left-accent / icon-badge tint, one step more specific than category —
// every card in "progress" looked identically green before this, which
// read as monotonous. Keyed by `type` (PR/streak/highest-volume/longest-
// workout all read as one "achievement" feel; goal completion/threshold
// gets its own cyan regardless of whether the goal happens to be a
// Cardio Goal; recovery gets its own teal instead of blending into
// achievements). Falls back to a category-level tone for any type this
// build doesn't recognize yet (e.g. an older client after a new
// notification type ships) — see getNotificationTone below.
const TYPE_TONE = {
  personalRecord: "achievement",
  streakMilestone: "achievement",
  highestVolume: "achievement",
  longestWorkout: "achievement",
  recoveryComplete: "recovery",
  goalCompleted: "goal",
  goalThreshold: "goal",
  newLongestRun: "cardio",
  weeklyVolumeIncreased: "insight",
  muscleGroupNeglected: "insight",
  // Phase 13B — planning actions all read as "reminder" tone (amber),
  // distinct from achievements/goals/insights.
  workoutScheduled: "reminder",
  workoutRescheduled: "reminder",
  recurringScheduleCreated: "reminder",
  workoutCancelled: "reminder",
  // Phase 13C — reminder engine types.
  workoutToday: "reminder",
  workoutStartingSoon: "reminder",
  workoutOverdue: "reminder",
  workoutMissedYesterday: "reminder",
  recurringDueTomorrow: "reminder",
  goalProgressReminder: "goal",
  goalExpiringToday: "goal",
  milestoneAlmostComplete: "goal",
  streakProtection: "reminder",
  cardioStreakExpiring: "reminder",
  cardioSessionDue: "cardio",
  cardioActivityNotLogged: "cardio",
  plannerRescheduleWarning: "reminder",
  plannerOverlap: "reminder",
  plannerSeriesEndingSoon: "reminder",
  firstWorkoutAfterBreak: "achievement",
};

// Phase 13C, section 9 — mirrors server/constants/notificationTypes.js's
// TYPE_PRIORITY exactly (see that file's header comment on why this pair
// stays unshared-but-mirrored). muscleGroupNeglected is absent here too
// — its priority is severity-dependent, stamped by the generator that
// builds it (client/src/reminders/neglectReminders.js).
export const TYPE_PRIORITY = {
  workoutOverdue: "critical",
  streakProtection: "critical",
  cardioStreakExpiring: "critical",
  goalExpiringToday: "critical",

  workoutToday: "high",
  workoutStartingSoon: "high",
  workoutMissedYesterday: "high",
  recoveryComplete: "high",
  plannerOverlap: "high",

  goalProgressReminder: "medium",
  goalThreshold: "medium",
  cardioSessionDue: "medium",
  cardioActivityNotLogged: "medium",
  recurringDueTomorrow: "medium",
  plannerRescheduleWarning: "medium",
  plannerSeriesEndingSoon: "medium",
  milestoneAlmostComplete: "medium",

  personalRecord: "low",
  goalCompleted: "low",
  streakMilestone: "low",
  highestVolume: "low",
  longestWorkout: "low",
  newLongestRun: "low",
  weeklyVolumeIncreased: "low",
  firstWorkoutAfterBreak: "low",
  workoutScheduled: "low",
  workoutRescheduled: "low",
  recurringScheduleCreated: "low",
  workoutCancelled: "low",
};

// Numeric sort weight, highest first — NotificationCenter sorts by this,
// then by recency within the same tier (section 9: "Notification Center
// should sort automatically").
const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

export function getNotificationPriority(notification) {
  return notification.priority || TYPE_PRIORITY[notification.type] || "medium";
}

export function getPriorityRank(priority) {
  return PRIORITY_RANK[priority] ?? PRIORITY_RANK.medium;
}

// Phase 13C, section 13 — the 7 user-toggleable reminder categories
// (distinct from NOTIFICATION_CATEGORIES above, which drive the panel's
// filter tabs). Every reminder-engine-generated type maps to exactly
// one of these; achievement/goal-completion types that already existed
// pre-13C map here too so their toggle actually governs them.
export const REMINDER_PREFERENCE_CATEGORIES = {
  WORKOUT: "workout",
  RECOVERY: "recovery",
  CARDIO: "cardio",
  PLANNER: "planner",
  ACHIEVEMENT: "achievement",
  GOAL: "goal",
  STREAK: "streak",
};

export const REMINDER_PREFERENCE_LABELS = {
  [REMINDER_PREFERENCE_CATEGORIES.WORKOUT]: "Workout reminders",
  [REMINDER_PREFERENCE_CATEGORIES.RECOVERY]: "Recovery reminders",
  [REMINDER_PREFERENCE_CATEGORIES.CARDIO]: "Cardio reminders",
  [REMINDER_PREFERENCE_CATEGORIES.PLANNER]: "Planner reminders",
  [REMINDER_PREFERENCE_CATEGORIES.ACHIEVEMENT]: "Achievement notifications",
  [REMINDER_PREFERENCE_CATEGORIES.GOAL]: "Goal reminders",
  [REMINDER_PREFERENCE_CATEGORIES.STREAK]: "Streak reminders",
};

const TYPE_PREFERENCE_CATEGORY = {
  workoutToday: "workout",
  workoutStartingSoon: "workout",
  workoutOverdue: "workout",
  workoutMissedYesterday: "workout",
  recurringDueTomorrow: "workout",
  recoveryComplete: "recovery",
  muscleGroupNeglected: "recovery",
  cardioSessionDue: "cardio",
  cardioActivityNotLogged: "cardio",
  newLongestRun: "cardio",
  plannerRescheduleWarning: "planner",
  plannerOverlap: "planner",
  plannerSeriesEndingSoon: "planner",
  workoutScheduled: "planner",
  workoutRescheduled: "planner",
  recurringScheduleCreated: "planner",
  workoutCancelled: "planner",
  personalRecord: "achievement",
  highestVolume: "achievement",
  longestWorkout: "achievement",
  firstWorkoutAfterBreak: "achievement",
  weeklyVolumeIncreased: "achievement",
  goalCompleted: "goal",
  goalThreshold: "goal",
  goalProgressReminder: "goal",
  goalExpiringToday: "goal",
  milestoneAlmostComplete: "goal",
  streakMilestone: "streak",
  streakProtection: "streak",
  cardioStreakExpiring: "streak",
};

export function getReminderPreferenceCategory(type) {
  return TYPE_PREFERENCE_CATEGORY[type] || null;
}

const CATEGORY_FALLBACK_TONE = {
  [NOTIFICATION_CATEGORIES.PROGRESS]: "achievement",
  [NOTIFICATION_CATEGORIES.CARDIO]: "cardio",
  [NOTIFICATION_CATEGORIES.REMINDERS]: "reminder",
  [NOTIFICATION_CATEGORIES.INSIGHTS]: "insight",
};

export const getNotificationTone = (notification) =>
  TYPE_TONE[notification.type] || CATEGORY_FALLBACK_TONE[notification.category] || "achievement";
