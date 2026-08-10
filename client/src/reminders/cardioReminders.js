import { isCardioEntry } from "../utils/workoutUtils";
import { getAvailableCardioActivities } from "../progression/cardioProgressionEngine";
import { daysAgo } from "./reminderUtils";

const NOT_LOGGED_THRESHOLD_DAYS = 14;
const MIN_SESSIONS_FOR_CADENCE = 3;
const DUE_MULTIPLIER = 1.4;

function entryDate(w) {
  return new Date(w.date || w.createdAt);
}

export function generateCardioReminders(workouts) {
  const cardioWorkouts = workouts.filter(isCardioEntry);
  const activities = getAvailableCardioActivities(cardioWorkouts);
  const reminders = [];

  activities.forEach((activityType) => {
    const sessions = cardioWorkouts
      .filter((w) => w.cardio?.activityType === activityType)
      .sort((a, b) => entryDate(a) - entryDate(b));
    if (!sessions.length) return;

    const lastLogged = entryDate(sessions[sessions.length - 1]);
    const gapSinceLast = daysAgo(lastLogged);

    if (gapSinceLast >= NOT_LOGGED_THRESHOLD_DAYS) {
      const weeksGone = Math.floor(gapSinceLast / 7);
      reminders.push({
        type: "cardioActivityNotLogged",
        category: "cardio",
        icon: "HeartPulse",
        title: `${activityType} Not Logged`,
        subtitle: `Hasn't been logged in ${weeksGone} week${weeksGone === 1 ? "" : "s"}`,
        navigationTarget: "/progression?viewMode=cardio",
        action: { page: "/progression", entityId: activityType, focus: null },
        dedupeKey: `cardio-not-logged-${activityType.toLowerCase()}`,
        expiresAt: null,
        metadata: { activityType },
      });
      return;
    }

    if (sessions.length < MIN_SESSIONS_FOR_CADENCE) return;

    const gaps = [];
    for (let i = 1; i < sessions.length; i += 1) {
      gaps.push((entryDate(sessions[i]) - entryDate(sessions[i - 1])) / 86400000);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

    if (avgGap > 0 && gapSinceLast >= avgGap * DUE_MULTIPLIER) {
      reminders.push({
        type: "cardioSessionDue",
        category: "cardio",
        icon: "Footprints",
        title: `Next ${activityType} Session Due`,
        subtitle: `Usually every ~${Math.round(avgGap)} days`,
        navigationTarget: "/progression?viewMode=cardio",
        action: { page: "/progression", entityId: activityType, focus: null },
        dedupeKey: `cardio-session-due-${activityType.toLowerCase()}`,
        expiresAt: null,
        metadata: { activityType },
      });
    }
  });

  return reminders;
}
