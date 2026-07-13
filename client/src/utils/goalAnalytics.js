// Phase 8C — single source of truth for every derived, presentational
// value the Goals UI needs: progress percentage, remaining amount, pace,
// projected completion, and "goal health" (Ahead / On Track / Behind /
// Completed). Nothing here is persisted — it's all computed at render
// time from fields already on the Goal document (current, target,
// createdAt, deadline). See Phase 8B's design note in goalController.js
// for why health intentionally stays client-side: persisting it would
// mean duplicating this exact math inside the backend recalculation
// pipeline too.
//
// PURE MODULE: no API calls, no React, no mutation — takes a goal-like
// object (+ optional `now` for testability) and returns computed values.
//
// UI code should prefer the single getGoalAnalytics(goal) export over
// calling the individual helpers piecemeal, so every consumer (GoalCard,
// the stats header, filtering, sorting) reads from one consistently-
// shaped object instead of assembling its own subset.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Local-midnight day math — deliberately mirrors workoutUtils.js's
// startOfDay/date-window pattern rather than importing it. Goals and
// Workouts are separate domains; this is six lines, not worth a
// cross-domain dependency for (see "avoid premature abstraction").
const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const daysBetween = (from, to) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);

const formatAmount = (n) => {
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

// ---------------------------------------------------------------------

export function getProgressPercent(current, target) {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(((current || 0) / target) * 100)));
}

export function getRemaining(current, target) {
  return Math.max(0, (target ?? 0) - (current ?? 0));
}

// Days since the goal was created, floored at 0. Null if createdAt is
// somehow missing (shouldn't happen — timestamps: true — but defensive).
export function getDaysElapsed(goal, now = new Date()) {
  if (!goal?.createdAt) return null;
  return Math.max(0, daysBetween(goal.createdAt, now));
}

// Days until the deadline. Can be NEGATIVE (overdue) — callers that need
// a "can't go negative" version should clamp explicitly; averageRequired
// PerDay and getGoalHealth both rely on being able to see overdue as
// negative rather than 0.
export function getDaysRemaining(goal, now = new Date()) {
  if (!goal?.deadline) return null;
  return daysBetween(now, goal.deadline);
}

// Total span of the goal, createdAt -> deadline. Null without a deadline.
export function getDaysTotal(goal) {
  if (!goal?.createdAt || !goal?.deadline) return null;
  return daysBetween(goal.createdAt, goal.deadline);
}

// How much needs to be logged per remaining day to hit the target by the
// deadline. Null when there's no deadline, the goal is already met (0,
// not null — there's a real answer, it's just zero), or the deadline has
// already passed with work still remaining (no forward-looking average
// is meaningful once you're overdue — see getGoalInsight/isOverdue for
// how that's communicated instead).
export function getAverageRequiredPerDay(goal, now = new Date()) {
  if (!goal?.deadline) return null;
  const remaining = getRemaining(goal.current, goal.target);
  if (remaining <= 0) return 0;
  const daysRemaining = getDaysRemaining(goal, now);
  if (daysRemaining === null || daysRemaining <= 0) return null;
  return remaining / daysRemaining;
}

// Projects a completion date from the pace observed SO FAR (current /
// daysElapsed), independent of any deadline — this is "at this rate,
// when will you actually finish", not "will you make the deadline"
// (that's getGoalHealth's job). Null when the goal is already complete,
// or there isn't enough history yet to measure a rate (day 0, or zero
// progress logged so far).
export function getProjectedCompletionDate(goal, now = new Date()) {
  if ((goal?.current ?? 0) >= (goal?.target ?? 0)) return null;
  const daysElapsed = getDaysElapsed(goal, now);
  if (!daysElapsed || daysElapsed <= 0) return null;

  const rate = goal.current / daysElapsed;
  if (!Number.isFinite(rate) || rate <= 0) return null;

  const daysToTarget = Math.ceil(goal.target / rate);
  const projected = new Date(goal.createdAt);
  projected.setDate(projected.getDate() + daysToTarget);
  return projected;
}

// Tolerance band around the expected on-pace value that still counts as
// "On Track" rather than tipping into Ahead/Behind. A tuning knob, not a
// derived fact — 10% is a starting point.
const HEALTH_TOLERANCE = 0.1;

// "Ahead" / "On Track" / "Behind" / "Completed", or null when health has
// no meaning (no deadline set — there's no schedule to be ahead of or
// behind on).
export function getGoalHealth(goal, now = new Date()) {
  if ((goal?.current ?? 0) >= (goal?.target ?? 0)) return "Completed";
  if (!goal?.deadline) return null;

  const daysTotal = getDaysTotal(goal);
  if (daysTotal === null) return null;

  const daysRemaining = getDaysRemaining(goal, now);

  if (daysTotal <= 0) {
    // Deadline on/before creation date — no runway to measure pace
    // against. Only meaningful signal left is overdue-or-not.
    return daysRemaining < 0 ? "Behind" : "On Track";
  }

  if (daysRemaining < 0) return "Behind"; // explicitly overdue, not complete

  const daysElapsed = getDaysElapsed(goal, now);
  const clampedElapsed = Math.min(Math.max(daysElapsed ?? 0, 0), daysTotal);
  const expected = goal.target * (clampedElapsed / daysTotal);
  const diff = goal.current - expected;
  const tolerance = goal.target * HEALTH_TOLERANCE;

  if (diff >= tolerance) return "Ahead";
  if (diff <= -tolerance) return "Behind";
  return "On Track";
}

// Short, human-readable line summarizing the goal's situation. Takes the
// already-computed analytics object rather than recomputing anything, so
// it stays a pure formatting step over shared numbers.
export function getGoalInsight(goal, analytics) {
  const { health, hasDeadline, isOverdue, averageRequiredPerDay } = analytics;

  if (health === "Completed") return "Goal completed — nice work.";
  if (!hasDeadline) return "Add a deadline to see pace and projection insights.";
  if (isOverdue) return "The deadline has passed. Consider updating the target or deadline.";

  if (health === "Ahead") return "Ahead of schedule — keep it up.";

  if (health === "Behind") {
    return averageRequiredPerDay != null
      ? `Behind pace. Log about ${formatAmount(averageRequiredPerDay)} ${goal.unit}/day to catch up.`
      : "Behind pace.";
  }

  if (health === "On Track") {
    return averageRequiredPerDay != null
      ? `On track. About ${formatAmount(averageRequiredPerDay)} ${goal.unit}/day keeps you on pace.`
      : "On track.";
  }

  return "Keep logging progress toward this goal.";
}

// The consolidated shape every UI consumer should read from — GoalCard,
// the statistics header, filtering, and sorting all call this ONCE per
// goal (see Goals.jsx's goalsWithAnalytics) rather than calling the
// individual helpers above piecemeal.
export function getGoalAnalytics(goal, now = new Date()) {
  const daysRemaining = getDaysRemaining(goal, now);
  const remaining = getRemaining(goal.current, goal.target);
  const hasDeadline = !!goal.deadline;
  const isOverdue = hasDeadline && daysRemaining !== null && daysRemaining < 0 && remaining > 0;

  const analytics = {
    percent: getProgressPercent(goal.current, goal.target),
    remaining,
    daysElapsed: getDaysElapsed(goal, now),
    daysRemaining,
    daysTotal: getDaysTotal(goal),
    hasDeadline,
    isOverdue,
    averageRequiredPerDay: getAverageRequiredPerDay(goal, now),
    projectedCompletionDate: getProjectedCompletionDate(goal, now),
    health: getGoalHealth(goal, now),
  };

  analytics.insight = getGoalInsight(goal, analytics);

  return analytics;
}

// Originally (Phase 8C UX refinement) this excluded only Strength PR —
// pace-based health is misleading for it since strength progress is
// naturally non-linear (plateaus followed by sudden jumps). Per a
// follow-up product decision, EVERY goal type now behaves the same way:
// no goal card shows Ahead/On Track/Behind, and the stats
// header/filter no longer surface those values at all.
//
// IMPORTANT: this still does NOT change what getGoalHealth computes
// above — analytics.health is still populated for every goal, exactly
// as before. This function only tells the UI whether to DISPLAY it, so
// re-enabling pace tracking for a specific goal type later (if ever
// wanted) is a one-line change here, not a rebuild of the analytics
// engine. Consumers: GoalCard.jsx (badge + progress bar tint).
export function usesHealthBadge(goal) {
  return false;
}