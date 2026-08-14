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
  Heart,
  MessageCircle,
} from "lucide-react";

export const NOTIFICATION_CATEGORIES = {
  PROGRESS: "progress",
  CARDIO: "cardio",
  REMINDERS: "reminders",
  INSIGHTS: "insights",
};

export const NOTIFICATION_FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: NOTIFICATION_CATEGORIES.PROGRESS, label: "Achievements" },
  { key: NOTIFICATION_CATEGORIES.CARDIO, label: "Cardio" },
  { key: NOTIFICATION_CATEGORIES.REMINDERS, label: "Reminders" },
  { key: NOTIFICATION_CATEGORIES.INSIGHTS, label: "Insights" },
];

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
  Heart,
  MessageCircle,
};

export const getNotificationIcon = (iconName) => NOTIFICATION_ICON_MAP[iconName] || Bell;

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
  workoutScheduled: "reminder",
  workoutRescheduled: "reminder",
  recurringScheduleCreated: "reminder",
  workoutCancelled: "reminder",
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
  plateauDetected: "insight",
  weeklyGradeImproved: "insight",
  recoveryScoreIncreased: "recovery",
  volumeLandmarkAchieved: "insight",
};

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

  plateauDetected: "medium",
  weeklyGradeImproved: "low",
  recoveryScoreIncreased: "low",
  volumeLandmarkAchieved: "low",
};

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

export function getNotificationPriority(notification) {
  return notification.priority || TYPE_PRIORITY[notification.type] || "medium";
}

export function getPriorityRank(priority) {
  return PRIORITY_RANK[priority] ?? PRIORITY_RANK.medium;
}

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
  plateauDetected: "recovery",
  recoveryScoreIncreased: "recovery",
  weeklyGradeImproved: "achievement",
  volumeLandmarkAchieved: "achievement",
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
