import { computeMuscleBreakdown } from "../utils/workoutUtils";
import { daysAgo } from "./reminderUtils";

const INFO_THRESHOLD_DAYS = 10;
const WARNING_THRESHOLD_DAYS = 18;
const CRITICAL_THRESHOLD_DAYS = 30;

function severityOf(days) {
  if (days >= CRITICAL_THRESHOLD_DAYS) return "critical";
  if (days >= WARNING_THRESHOLD_DAYS) return "warning";
  if (days >= INFO_THRESHOLD_DAYS) return "info";
  return null;
}

const SEVERITY_PRIORITY = { critical: "high", warning: "medium", info: "low" };

function phraseFor(muscle, days, isPlural) {
  if (days >= 30) return `${muscle} ${isPlural ? "haven't" : "hasn't"} been trained this month`;
  const weeks = Math.floor(days / 7);
  return `${muscle}: no logged training in over ${weeks} week${weeks === 1 ? "" : "s"}`;
}

export function generateNeglectReminders(workouts) {
  const breakdown = computeMuscleBreakdown(workouts);

  const bySeverity = { critical: [], warning: [], info: [] };
  breakdown.forEach((entry) => {
    if (!entry.lastTrained) return;
    const days = daysAgo(entry.lastTrained);
    const severity = severityOf(days);
    if (!severity) return;
    bySeverity[severity].push({ muscle: entry.muscle, days });
  });

  const reminders = [];
  ["critical", "warning", "info"].forEach((severity) => {
    const entries = bySeverity[severity];
    if (!entries.length) return;

    const muscleNames = entries.map((e) => e.muscle).sort();
    const subtitle =
      entries.length === 1
        ? phraseFor(entries[0].muscle, entries[0].days, /s$/.test(entries[0].muscle))
        : `${entries.length} muscle groups have gone a while without logged training`;

    reminders.push({
      type: "muscleGroupNeglected",
      category: "insights",
      priority: SEVERITY_PRIORITY[severity],
      icon: "TrendingDown",
      title: entries.length === 1 ? "Training Gap" : "Training Gaps",
      subtitle,
      navigationTarget: "/progression",
      action: { page: "/progression", entityId: null, focus: null },
      dedupeKey: `neglect-${severity}-${muscleNames.join("-").toLowerCase()}`,
      expiresAt: null,
      metadata: { muscles: muscleNames, severity },
    });
  });

  return reminders;
}
