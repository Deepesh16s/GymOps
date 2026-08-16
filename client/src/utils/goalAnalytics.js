
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

function normalizeForDirection(goal) {
  if (goal?.direction === "loss" && Number.isFinite(goal?.startingValue)) {
    return {
      current: goal.startingValue - (goal.current ?? 0),
      target: goal.startingValue - (goal.target ?? 0),
    };
  }
  return { current: goal?.current ?? 0, target: goal?.target ?? 0 };
}

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
  const { current, target } = normalizeForDirection(goal);
  const remaining = getRemaining(current, target);
  if (remaining <= 0) return 0;
  const daysRemaining = getDaysRemaining(goal, now);
  if (daysRemaining === null || daysRemaining <= 0) return null;
  return remaining / daysRemaining;
}

const MAX_PROJECTION_DAYS = 36500;

export function getProjectedCompletionDate(goal, now = new Date()) {
  const { current, target } = normalizeForDirection(goal);
  if (current >= target) return null;
  const daysElapsed = getDaysElapsed(goal, now);
  if (!daysElapsed || daysElapsed <= 0) return null;

  const rate = current / daysElapsed;
  if (!Number.isFinite(rate) || rate <= 0) return null;

  const daysToTarget = Math.ceil(target / rate);
  if (!Number.isFinite(daysToTarget) || daysToTarget > MAX_PROJECTION_DAYS) return null;

  const projected = new Date(goal.createdAt);
  projected.setDate(projected.getDate() + daysToTarget);
  if (Number.isNaN(projected.getTime())) return null;
  return projected;
}

const RELIABLE_EXTRAPOLATION_RATIO = 3;
const ROUGH_EXTRAPOLATION_RATIO = 10;

export function getProjectionReliability(goal, now = new Date()) {
  const daysElapsed = getDaysElapsed(goal, now);
  const projected = getProjectedCompletionDate(goal, now);
  if (!daysElapsed || daysElapsed <= 0 || !projected) return null;

  const daysToTarget = daysBetween(goal.createdAt, projected);
  const extrapolationRatio = daysToTarget / daysElapsed;

  if (extrapolationRatio <= RELIABLE_EXTRAPOLATION_RATIO) return "reliable";
  if (extrapolationRatio <= ROUGH_EXTRAPOLATION_RATIO) return "rough";
  return "uncertain";
}

const HEALTH_TOLERANCE = 0.1;
const AT_RISK_TOLERANCE = 0.25;
const MIN_DAYS_FOR_RELIABLE_READ = 2;

export function getGoalHealth(goal, now = new Date()) {
  const { current, target } = normalizeForDirection(goal);
  if (current >= target) return "Completed";
  if (!goal?.deadline) return null;

  const daysTotal = getDaysTotal(goal);
  if (daysTotal === null) return null;

  const daysRemaining = getDaysRemaining(goal, now);
  const daysElapsed = getDaysElapsed(goal, now);

  if (daysTotal <= 0) {
    return daysRemaining < 0 ? "Behind" : "On Track";
  }

  if (daysRemaining < 0) return "Behind";

  if ((daysElapsed ?? 0) < MIN_DAYS_FOR_RELIABLE_READ) return "Insufficient Data";

  const clampedElapsed = Math.min(Math.max(daysElapsed ?? 0, 0), daysTotal);
  const expected = target * (clampedElapsed / daysTotal);
  const diff = current - expected;
  const tolerance = target * HEALTH_TOLERANCE;
  const atRiskTolerance = target * AT_RISK_TOLERANCE;

  if (diff >= tolerance) return "Ahead";
  if (diff >= -tolerance) return "On Track";
  if (diff >= -atRiskTolerance) return "At Risk";
  return "Behind";
}

export function getGoalInsight(goal, analytics) {
  const { health, hasDeadline, isOverdue, averageRequiredPerDay } = analytics;

  if (health === "Completed") return "Goal completed — nice work.";
  if (!hasDeadline) return "Add a deadline to see pace and projection insights.";
  if (isOverdue) return "The deadline has passed. Consider updating the target or deadline.";
  if (health === "Insufficient Data") return "More data is needed before a reliable pace read is possible.";

  if (health === "Ahead") return "Ahead of schedule — keep it up.";

  if (health === "Behind") {
    return averageRequiredPerDay != null
      ? `Behind pace. Log about ${formatAmount(averageRequiredPerDay)} ${goal.unit}/day to catch up.`
      : "Behind pace.";
  }

  if (health === "At Risk") {
    return averageRequiredPerDay != null
      ? `At risk of falling behind. About ${formatAmount(averageRequiredPerDay)} ${goal.unit}/day gets you back on pace.`
      : "At risk of falling behind.";
  }

  if (health === "On Track") {
    return averageRequiredPerDay != null
      ? `On track. About ${formatAmount(averageRequiredPerDay)} ${goal.unit}/day keeps you on pace.`
      : "On track.";
  }

  return "Keep logging progress toward this goal.";
}

export function getGoalAnalytics(goal, now = new Date()) {
  const normalized = normalizeForDirection(goal);
  const daysRemaining = getDaysRemaining(goal, now);
  const remaining = getRemaining(normalized.current, normalized.target);
  const hasDeadline = !!goal.deadline;
  const isOverdue = hasDeadline && daysRemaining !== null && daysRemaining < 0 && remaining > 0;

  const analytics = {
    percent: getProgressPercent(normalized.current, normalized.target),
    remaining,
    daysElapsed: getDaysElapsed(goal, now),
    daysRemaining,
    daysTotal: getDaysTotal(goal),
    hasDeadline,
    isOverdue,
    averageRequiredPerDay: getAverageRequiredPerDay(goal, now),
    projectedCompletionDate: getProjectedCompletionDate(goal, now),
    projectionReliability: getProjectionReliability(goal, now),
    health: getGoalHealth(goal, now),
  };

  analytics.insight = getGoalInsight(goal, analytics);

  return analytics;
}

export function usesHealthBadge() {
  return true;
}
