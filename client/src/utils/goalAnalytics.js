
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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


export function getProgressPercent(current, target) {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(((current || 0) / target) * 100)));
}

export function getRemaining(current, target) {
  return Math.max(0, (target ?? 0) - (current ?? 0));
}

export function getDaysElapsed(goal, now = new Date()) {
  if (!goal?.createdAt) return null;
  return Math.max(0, daysBetween(goal.createdAt, now));
}

export function getDaysRemaining(goal, now = new Date()) {
  if (!goal?.deadline) return null;
  return daysBetween(now, goal.deadline);
}

export function getDaysTotal(goal) {
  if (!goal?.createdAt || !goal?.deadline) return null;
  return daysBetween(goal.createdAt, goal.deadline);
}

export function getAverageRequiredPerDay(goal, now = new Date()) {
  if (!goal?.deadline) return null;
  const remaining = getRemaining(goal.current, goal.target);
  if (remaining <= 0) return 0;
  const daysRemaining = getDaysRemaining(goal, now);
  if (daysRemaining === null || daysRemaining <= 0) return null;
  return remaining / daysRemaining;
}

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

const HEALTH_TOLERANCE = 0.1;

export function getGoalHealth(goal, now = new Date()) {
  if ((goal?.current ?? 0) >= (goal?.target ?? 0)) return "Completed";
  if (!goal?.deadline) return null;

  const daysTotal = getDaysTotal(goal);
  if (daysTotal === null) return null;

  const daysRemaining = getDaysRemaining(goal, now);

  if (daysTotal <= 0) {
    return daysRemaining < 0 ? "Behind" : "On Track";
  }

  if (daysRemaining < 0) return "Behind";

  const daysElapsed = getDaysElapsed(goal, now);
  const clampedElapsed = Math.min(Math.max(daysElapsed ?? 0, 0), daysTotal);
  const expected = goal.target * (clampedElapsed / daysTotal);
  const diff = goal.current - expected;
  const tolerance = goal.target * HEALTH_TOLERANCE;

  if (diff >= tolerance) return "Ahead";
  if (diff <= -tolerance) return "Behind";
  return "On Track";
}

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

export function usesHealthBadge() {
  return false;
}