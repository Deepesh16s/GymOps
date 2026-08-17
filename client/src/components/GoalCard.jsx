import { useState } from "react";
import {
  ChevronDown,
  Calendar,
  Gauge,
  Lightbulb,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  HelpCircle,
  Trophy,
  Bell,
} from "lucide-react";
import { usesHealthBadge } from "../utils/goalAnalytics";
import { formatDate } from "../utils/dateUtils";
import EvidenceBadge from "./EvidenceBadge";
import { EVIDENCE_STRENGTH } from "../constants/evidenceSources";

const PROJECTION_EVIDENCE_EXPLANATION =
  "A straight-line projection from your recent pace. Strength and progress adaptation typically follow a diminishing-returns curve rather than a straight line, so a short recent window doesn't reliably extrapolate over a long horizon — treat this as an estimate, not a guarantee.";

const HEALTH_ICONS = {
  Completed: CheckCircle2,
  Ahead: TrendingUp,
  "On Track": Minus,
  "At Risk": AlertTriangle,
  Behind: TrendingDown,
  "Insufficient Data": HelpCircle,
};

const healthBadgeClass = (status) => {
  switch (status) {
    case "Completed":
      return "goal-badge--completed";
    case "Ahead":
      return "goal-badge--ahead";
    case "On Track":
      return "goal-badge--on-track";
    case "At Risk":
      return "goal-badge--at-risk";
    case "Behind":
      return "goal-badge--behind";
    case "Insufficient Data":
      return "goal-badge--insufficient";
    default:
      return "goal-badge--progress";
  }
};

function ProgressBar({ percent, health, isCompleted, showHealth }) {
  const variant = !showHealth
    ? isCompleted
      ? "completed"
      : undefined
    : health === "Behind"
    ? "behind"
    : health === "At Risk"
    ? "at-risk"
    : health === "Ahead"
    ? "ahead"
    : isCompleted
    ? "completed"
    : undefined;

  return (
    <div className={`progress-track ${variant ? `progress-track--${variant}` : ""}`}>
      <div className="progress-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

const formatAmount = (n) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

function GoalCard({ goal, analytics, hasReminder, cardRef, isHighlighted, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const showHealth = usesHealthBadge(goal);
  const isCompleted = goal.status === "Completed";

  const displayStatus = showHealth ? analytics.health || goal.status : isCompleted ? "Completed" : null;
  const HealthIcon = displayStatus ? HEALTH_ICONS[displayStatus] : null;

  return (
    <div
      ref={cardRef}
      className={`go-card goal-card ${expanded ? "goal-card--expanded" : ""} ${
        isHighlighted ? "goal-card--highlighted" : ""
      }`}
    >
      <div className="goal-card__head" onClick={() => setExpanded((v) => !v)} role="button" tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <div>
          <p className="goal-card__title">
            {goal.title}
            {hasReminder && (
              <span
                className="goal-card__reminder-badge"
                role="img"
                aria-label="Active reminder for this goal"
                title="Active reminder for this goal"
              >
                <Bell size={11} strokeWidth={2.2} />
              </span>
            )}
          </p>
          <span className="goal-type-badge">
            {goal.type}
            {goal.type === "Strength PR" && goal.exercise?.name ? ` · ${goal.exercise.name}` : ""}
          </span>
        </div>
        <div className="goal-card__head-right">
          {displayStatus && (
            <span className={`goal-badge ${healthBadgeClass(displayStatus)}`}>
              {HealthIcon && <HealthIcon size={12} strokeWidth={2.2} />}
              {displayStatus}
            </span>
          )}
          <ChevronDown
            size={16}
            strokeWidth={2}
            className={`goal-card__chevron ${expanded ? "goal-card__chevron--open" : ""}`}
          />
        </div>
      </div>

      <div className="goal-card__progress-row">
        <span className="goal-card__progress-text">
          {goal.current.toLocaleString()} / {goal.target.toLocaleString()} {goal.unit}
        </span>
        <span className="goal-card__pct">{analytics.percent}%</span>
      </div>

      <ProgressBar
        percent={analytics.percent}
        health={analytics.health}
        isCompleted={isCompleted}
        showHealth={showHealth}
      />

      {expanded && showHealth && (
        <div className="goal-analytics-panel">
          <div className="goal-analytics-grid">
            <div className="goal-analytics-item">
              <span className="goal-analytics-label">Remaining</span>
              <span className="goal-analytics-value">
                {analytics.remaining.toLocaleString()} {goal.unit}
              </span>
            </div>

            <div className="goal-analytics-item">
              <span className="goal-analytics-label">
                <Gauge size={12} strokeWidth={2} /> Avg required / day
              </span>
              <span className="goal-analytics-value">
                {analytics.hasDeadline ? `${formatAmount(analytics.averageRequiredPerDay)} ${goal.unit}` : "No deadline set"}
              </span>
            </div>

            <div className="goal-analytics-item">
              <span className="goal-analytics-label">
                <Calendar size={12} strokeWidth={2} /> Deadline
              </span>
              <span className="goal-analytics-value">
                {analytics.hasDeadline ? formatDate(goal.deadline) : "Not set"}
                {analytics.isOverdue && <span className="goal-analytics-overdue"> · overdue</span>}
              </span>
            </div>

            <div className="goal-analytics-item">
              <span className="goal-analytics-label">
                Projected completion
                <EvidenceBadge
                  strength={EVIDENCE_STRENGTH.LIMITED}
                  explanation={PROJECTION_EVIDENCE_EXPLANATION}
                  metricKey="goalForecast"
                />
              </span>
              <span className="goal-analytics-value">
                {isCompleted
                  ? "Already completed"
                  : !analytics.hasDeadline
                  ? "No deadline set"
                  : analytics.projectedCompletionDate
                  ? formatDate(analytics.projectedCompletionDate)
                  : "Not enough data yet"}
                {analytics.projectedCompletionDate && analytics.projectionReliability !== "reliable" && (
                  <span className="goal-analytics-caveat">
                    {" "}
                    · {analytics.projectionReliability === "uncertain" ? "highly uncertain" : "rough estimate"}
                  </span>
                )}
              </span>
            </div>
          </div>

          <p className="goal-insight">
            <Lightbulb size={13} strokeWidth={1.8} />
            {analytics.insight}
          </p>
        </div>
      )}

      {expanded && !showHealth && (
        <div className="goal-analytics-panel">
          <div className="goal-analytics-grid">
            <div className="goal-analytics-item">
              <span className="goal-analytics-label">
                {goal.type === "Strength PR" && <Trophy size={12} strokeWidth={2} />}
                {goal.type === "Strength PR" ? "Current PR" : "Current"}
              </span>
              <span className="goal-analytics-value">
                {goal.current.toLocaleString()} {goal.unit}
              </span>
            </div>

            <div className="goal-analytics-item">
              <span className="goal-analytics-label">Target</span>
              <span className="goal-analytics-value">
                {goal.target.toLocaleString()} {goal.unit}
              </span>
            </div>

            <div className="goal-analytics-item">
              <span className="goal-analytics-label">Remaining</span>
              <span className="goal-analytics-value">
                {analytics.remaining.toLocaleString()} {goal.unit}
              </span>
            </div>

            {analytics.hasDeadline && (
              <div className="goal-analytics-item">
                <span className="goal-analytics-label">
                  <Calendar size={12} strokeWidth={2} /> Deadline
                </span>
                <span className="goal-analytics-value">
                  {formatDate(goal.deadline)}
                  {analytics.isOverdue && (
                    <span className="goal-analytics-overdue"> · overdue</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="goal-card-actions">
        <button type="button" className="goal-edit-btn" onClick={() => onEdit(goal)}>
          Edit
        </button>
        <button type="button" className="goal-delete-btn" onClick={() => onDelete(goal)}>
          Delete
        </button>
      </div>
    </div>
  );
}

export default GoalCard;