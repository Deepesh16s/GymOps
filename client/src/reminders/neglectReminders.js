// Phase 13C, section 5 — Muscle Neglect, with severity tiers. Reuses
// workoutUtils.computeMuscleBreakdown EXCLUSIVELY (same source
// dashboardInsights.js's workout recommendation reads lastTrained from).
// Supersedes utils/notificationRules.js's buildNeglectedMuscleCandidates
// (folded in here, not duplicated alongside it) — adds severity tiers
// and section 10's grouping (multiple muscles at the same severity
// collapse into one reminder).
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

// muscleGroupNeglected's priority is severity-dependent, not fixed per
// type — see server/constants/notificationTypes.js's TYPE_PRIORITY
// header comment for why this one type is deliberately absent there.
const SEVERITY_PRIORITY = { critical: "high", warning: "medium", info: "low" };

// 13C.1 — bucketed by WEEK rather than exact days: with the stable
// dedupeKey below, subtitle text is what notificationService.js compares
// to decide "did this meaningfully change" (bypassing the regeneration
// cooldown) or not (respecting it). An exact day-count changes every
// single calendar day regardless of any real action, which would defeat
// the cooldown entirely (content would always look "new"). Rounding to
// whole weeks means the wording — and therefore the regenerate/cooldown
// decision — only shifts roughly weekly, matching a sensible cadence.
function phraseFor(muscle, days, isPlural) {
  if (days >= 30) return `${muscle} ${isPlural ? "haven't" : "hasn't"} been trained this month`;
  const weeks = Math.floor(days / 7);
  return `${muscle}: not trained in over ${weeks} week${weeks === 1 ? "" : "s"}`;
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
        : `${entries.length} muscle groups are becoming overdue`;

    reminders.push({
      type: "muscleGroupNeglected",
      category: "insights",
      priority: SEVERITY_PRIORITY[severity],
      icon: "TrendingDown",
      title: entries.length === 1 ? "Muscle Group Neglected" : "Muscles Neglected",
      subtitle,
      navigationTarget: "/progression",
      action: { page: "/progression", entityId: null, focus: null },
      // 13C.1 — stable per severity+muscle-set (escalating from warning
      // to critical for the same muscle IS a meaningfully different key,
      // correctly bypassing any cooldown rather than being suppressed).
      dedupeKey: `neglect-${severity}-${muscleNames.join("-").toLowerCase()}`,
      expiresAt: null,
      metadata: { muscles: muscleNames, severity },
    });
  });

  return reminders;
}
