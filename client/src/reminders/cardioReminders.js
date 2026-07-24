// Phase 13C, section 6 — Cardio Reminders. Goal-backed cardio reminders
// ("Weekly distance: 4 km remaining", "Daily steps: 3,200 left") are
// already covered generically by goalReminders.js's goalProgressReminder
// (category flips to "cardio" for any Cardio Goal) — duplicating that
// here would just be the same number under a second type. This file
// only covers what ISN'T goal-shaped: per-activity staleness and cadence,
// reusing cardioProgressionEngine.getAvailableCardioActivities for the
// activity list rather than re-deriving it.
import { isCardioEntry } from "../utils/workoutUtils";
import { getAvailableCardioActivities } from "../progression/cardioProgressionEngine";
import { daysAgo } from "./reminderUtils";

const NOT_LOGGED_THRESHOLD_DAYS = 14;
// Minimum logged sessions of an activity before "average gap" is a
// meaningful enough figure to base a "due" reminder on.
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
      // 13C.1 — bucketed by week, not exact days: with a stable
      // dedupeKey, the subtitle text is what decides "meaningfully
      // changed" vs "respect the cooldown" (see notificationService.js).
      // An exact day-count would drift every single calendar day
      // regardless of any real action, defeating the cooldown entirely.
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
      // Deliberately no exact day-count in the subtitle (same drift
      // concern as above) — "due" is itself the meaningful signal, the
      // average cadence doesn't change from one refresh to the next.
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
