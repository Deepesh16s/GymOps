// Single source of truth for notification categories/types/priorities on
// the backend. This is the backend half of a deliberately UNSHARED,
// mirrored pair — see client/src/constants/notificationTypes.js for the
// frontend counterpart (icon-name -> lucide-component lookup, category
// filter labels). Same separation cardioMetadata.js already established:
// not imported across the frontend/backend boundary, kept in sync
// manually.

const NOTIFICATION_CATEGORIES = {
  PROGRESS: "progress",
  CARDIO: "cardio",
  REMINDERS: "reminders",
  INSIGHTS: "insights",
};

// One notification TYPE can render under a different category depending
// on context (e.g. GOAL_COMPLETED is "progress" for a Strength PR goal
// but "cardio" for a Cardio Goal) — category is decided at generation
// time by notificationService.js, not fixed per type here. This list is
// only the vocabulary of `type` values a Notification document may hold.
const NOTIFICATION_TYPES = {
  PERSONAL_RECORD: "personalRecord",
  GOAL_COMPLETED: "goalCompleted",
  GOAL_THRESHOLD: "goalThreshold",
  STREAK_MILESTONE: "streakMilestone",
  LONGEST_WORKOUT: "longestWorkout",
  HIGHEST_VOLUME: "highestVolume",
  RECOVERY_COMPLETE: "recoveryComplete",
  NEW_LONGEST_RUN: "newLongestRun",
  WEEKLY_VOLUME_INCREASED: "weeklyVolumeIncreased",
  MUSCLE_GROUP_NEGLECTED: "muscleGroupNeglected",
  // Phase 13B — planning actions, not reminder delivery. These fire
  // once, at the moment the user takes the planning action itself.
  WORKOUT_SCHEDULED: "workoutScheduled",
  WORKOUT_RESCHEDULED: "workoutRescheduled",
  RECURRING_SCHEDULE_CREATED: "recurringScheduleCreated",
  WORKOUT_CANCELLED: "workoutCancelled",

  // Phase 13C — reminder delivery, all computed client-side (or, for
  // firstWorkoutAfterBreak, at session-save time) from data already
  // fetched, re-evaluated whenever the app loads — no scheduler, "starts
  // in 1 hour" is only ever as fresh as the user's last page load/reload.
  WORKOUT_TODAY: "workoutToday",
  WORKOUT_STARTING_SOON: "workoutStartingSoon",
  WORKOUT_OVERDUE: "workoutOverdue",
  WORKOUT_MISSED_YESTERDAY: "workoutMissedYesterday",
  RECURRING_DUE_TOMORROW: "recurringDueTomorrow",
  GOAL_PROGRESS_REMINDER: "goalProgressReminder",
  GOAL_EXPIRING_TODAY: "goalExpiringToday",
  MILESTONE_ALMOST_COMPLETE: "milestoneAlmostComplete",
  STREAK_PROTECTION: "streakProtection",
  CARDIO_STREAK_EXPIRING: "cardioStreakExpiring",
  CARDIO_SESSION_DUE: "cardioSessionDue",
  CARDIO_ACTIVITY_NOT_LOGGED: "cardioActivityNotLogged",
  PLANNER_RESCHEDULE_WARNING: "plannerRescheduleWarning",
  PLANNER_OVERLAP: "plannerOverlap",
  PLANNER_SERIES_ENDING_SOON: "plannerSeriesEndingSoon",
  FIRST_WORKOUT_AFTER_BREAK: "firstWorkoutAfterBreak",
};

// Phase 13C, section 9 — the single source of truth every reminder's
// priority is stamped from at generation time (server-triggered
// detectors here, and the client's reminders/ engine mirrors this same
// map — see client/src/constants/notificationTypes.js). muscleGroupNeglected
// is deliberately absent: its priority is severity-dependent (info/
// warning/critical — section 5), computed per-instance by whichever
// generator builds it rather than fixed per type.
const TYPE_PRIORITY = {
  // Critical — needs action today or it's lost.
  [NOTIFICATION_TYPES.WORKOUT_OVERDUE]: "critical",
  [NOTIFICATION_TYPES.STREAK_PROTECTION]: "critical",
  [NOTIFICATION_TYPES.CARDIO_STREAK_EXPIRING]: "critical",
  [NOTIFICATION_TYPES.GOAL_EXPIRING_TODAY]: "critical",

  // High — timely and worth surfacing above routine progress notes.
  [NOTIFICATION_TYPES.WORKOUT_TODAY]: "high",
  [NOTIFICATION_TYPES.WORKOUT_STARTING_SOON]: "high",
  [NOTIFICATION_TYPES.WORKOUT_MISSED_YESTERDAY]: "high",
  [NOTIFICATION_TYPES.RECOVERY_COMPLETE]: "high",
  [NOTIFICATION_TYPES.PLANNER_OVERLAP]: "high",

  // Medium — routine progress/planning notes.
  [NOTIFICATION_TYPES.GOAL_PROGRESS_REMINDER]: "medium",
  [NOTIFICATION_TYPES.GOAL_THRESHOLD]: "medium",
  [NOTIFICATION_TYPES.CARDIO_SESSION_DUE]: "medium",
  [NOTIFICATION_TYPES.CARDIO_ACTIVITY_NOT_LOGGED]: "medium",
  [NOTIFICATION_TYPES.RECURRING_DUE_TOMORROW]: "medium",
  [NOTIFICATION_TYPES.PLANNER_RESCHEDULE_WARNING]: "medium",
  [NOTIFICATION_TYPES.PLANNER_SERIES_ENDING_SOON]: "medium",
  [NOTIFICATION_TYPES.MILESTONE_ALMOST_COMPLETE]: "medium",

  // Low — achievements (celebratory, not actionable) and planning-action
  // confirmations (the user just did this themselves).
  [NOTIFICATION_TYPES.PERSONAL_RECORD]: "low",
  [NOTIFICATION_TYPES.GOAL_COMPLETED]: "low",
  [NOTIFICATION_TYPES.STREAK_MILESTONE]: "low",
  [NOTIFICATION_TYPES.HIGHEST_VOLUME]: "low",
  [NOTIFICATION_TYPES.LONGEST_WORKOUT]: "low",
  [NOTIFICATION_TYPES.NEW_LONGEST_RUN]: "low",
  [NOTIFICATION_TYPES.WEEKLY_VOLUME_INCREASED]: "low",
  [NOTIFICATION_TYPES.FIRST_WORKOUT_AFTER_BREAK]: "low",
  [NOTIFICATION_TYPES.WORKOUT_SCHEDULED]: "low",
  [NOTIFICATION_TYPES.WORKOUT_RESCHEDULED]: "low",
  [NOTIFICATION_TYPES.RECURRING_SCHEDULE_CREATED]: "low",
  [NOTIFICATION_TYPES.WORKOUT_CANCELLED]: "low",
};

// Phase 13D, Part A.1 — Reminder Confidence: how certain the rule that
// produced this notification actually is, derived from the NATURE of
// that rule (never fabricated per-instance):
//   high   — exact/deterministic (real logged numbers, a scheduled
//            plan's own fields, a plain historical comparison)
//   medium — a comparative/statistical heuristic (which muscle category
//            is MORE overdue than another, an average logging cadence)
//   low    — a speculative pattern-based nudge, not a certain fact
// Unlike TYPE_PRIORITY (where muscleGroupNeglected's priority tracks
// severity and is stamped per-instance by the generator instead), its
// CONFIDENCE is flat "Medium" regardless of severity tier — the phase's
// own example fixes it there, and severity is about urgency, not how
// certain the underlying rule is.
const TYPE_CONFIDENCE = {
  [NOTIFICATION_TYPES.MUSCLE_GROUP_NEGLECTED]: "medium",
  [NOTIFICATION_TYPES.PERSONAL_RECORD]: "high",
  [NOTIFICATION_TYPES.HIGHEST_VOLUME]: "high",
  [NOTIFICATION_TYPES.LONGEST_WORKOUT]: "high",
  [NOTIFICATION_TYPES.NEW_LONGEST_RUN]: "high",
  [NOTIFICATION_TYPES.FIRST_WORKOUT_AFTER_BREAK]: "high",
  [NOTIFICATION_TYPES.WEEKLY_VOLUME_INCREASED]: "high",
  [NOTIFICATION_TYPES.GOAL_COMPLETED]: "high",
  [NOTIFICATION_TYPES.GOAL_THRESHOLD]: "high",
  [NOTIFICATION_TYPES.GOAL_PROGRESS_REMINDER]: "high",
  [NOTIFICATION_TYPES.GOAL_EXPIRING_TODAY]: "high",
  [NOTIFICATION_TYPES.MILESTONE_ALMOST_COMPLETE]: "high",
  [NOTIFICATION_TYPES.RECOVERY_COMPLETE]: "high",
  [NOTIFICATION_TYPES.STREAK_MILESTONE]: "high",
  [NOTIFICATION_TYPES.STREAK_PROTECTION]: "high",
  [NOTIFICATION_TYPES.CARDIO_STREAK_EXPIRING]: "high",
  [NOTIFICATION_TYPES.WORKOUT_TODAY]: "high",
  [NOTIFICATION_TYPES.WORKOUT_STARTING_SOON]: "high",
  [NOTIFICATION_TYPES.WORKOUT_OVERDUE]: "high",
  [NOTIFICATION_TYPES.WORKOUT_MISSED_YESTERDAY]: "high",
  [NOTIFICATION_TYPES.RECURRING_DUE_TOMORROW]: "high",

  [NOTIFICATION_TYPES.CARDIO_SESSION_DUE]: "medium",
  [NOTIFICATION_TYPES.CARDIO_ACTIVITY_NOT_LOGGED]: "medium",

  [NOTIFICATION_TYPES.PLANNER_RESCHEDULE_WARNING]: "low",
  [NOTIFICATION_TYPES.PLANNER_OVERLAP]: "low",
  [NOTIFICATION_TYPES.PLANNER_SERIES_ENDING_SOON]: "low",
  [NOTIFICATION_TYPES.WORKOUT_SCHEDULED]: "low",
  [NOTIFICATION_TYPES.WORKOUT_RESCHEDULED]: "low",
  [NOTIFICATION_TYPES.RECURRING_SCHEDULE_CREATED]: "low",
  [NOTIFICATION_TYPES.WORKOUT_CANCELLED]: "low",
};

// Streak lengths worth a one-time celebration. A day beyond 100 doesn't
// get its own notification — the list is finite on purpose (matches
// section 7's explicit "7, 14, 30, 60, 100").
const STREAK_MILESTONES = [7, 14, 30, 60, 100];

// Goal completion-percentage thresholds worth a nudge before the goal is
// actually done (100% is handled separately as GOAL_COMPLETED, a
// distinctly bigger moment than a progress checkpoint).
const GOAL_PROGRESS_THRESHOLDS = [80, 90];

module.exports = {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TYPES,
  TYPE_PRIORITY,
  TYPE_CONFIDENCE,
  STREAK_MILESTONES,
  GOAL_PROGRESS_THRESHOLDS,
};
