import {
  ChevronDown,
  Clock,
  Timer,
  Dumbbell,
  HeartPulse,
  Trash2,
  Loader2,
  Pencil,
  Star,
  Trophy,
  Sparkles,
} from "lucide-react";
import { getSessionTypeColor } from "../../constants/sessionTypes";
import { formatDurationLong, formatClockTime } from "../../utils/timeFormat";
import {
  formatSessionDate,
  formatSessionEntryCountLabel,
  getSessionTypeLabel,
  formatCardioPrLabel,
} from "../../utils/workoutUtils";
import OverflowMenu from "./OverflowMenu";
import SessionTimeline from "./SessionTimeline";

const MAX_VISIBLE_MUSCLE_CHIPS = 3;

// Cardio gets its own icon; every strength session type (Push/Pull/Legs/
// Upper/Lower/Full Body/Arms/Other) shares Dumbbell — there's no single
// lucide icon that meaningfully distinguishes "Legs" from "Arms", so this
// only draws the distinction that's actually real: strength vs. cardio.
function getSessionIcon(sessionType) {
  return sessionType === "Cardio" ? HeartPulse : Dumbbell;
}

// One premium session card: collapsed head (icon + title + PR/quality
// badges, a compact "hero" stat block, chevron) + an expandable body
// (PR callout, timing tiles, per-exercise breakdown, session summary
// footer). Head and favorite toggle are two separate sibling buttons
// (not nested) so the favorite star can sit inside the clickable header
// region without invalid nested <button>s.
function SessionCard({
  session,
  isExpanded,
  onToggleExpand,
  isFavorite,
  onToggleFavorite,
  isHighestVolume,
  isLongestSession,
  milestones,
  isDeletingSession,
  onDeleteSession,
  deletingWorkoutId,
  onDeleteWorkout,
  onEditTiming,
}) {
  const { exerciseCount, cardioCount, setCount, volume, totalReps, muscles } = session.stats;
  const visibleMuscles = muscles.slice(0, MAX_VISIBLE_MUSCLE_CHIPS);
  const hiddenMuscleCount = muscles.length - visibleMuscles.length;
  const hasDuration = session.sessionDuration != null && session.sessionDuration > 0;
  const hasStrengthEntries = exerciseCount > 0;
  const hasTimeRange = !!(session.startedAt && session.endedAt);
  const typeLabel = getSessionTypeLabel(session);
  const typeColor = getSessionTypeColor(session.sessionType);
  const TypeIcon = getSessionIcon(session.sessionType);
  const prCount = session.prs?.length || 0;
  const hasPR = prCount > 0;
  // Quality badge is intentionally singular — Highest Volume takes
  // priority over Longest Session so a card never carries two
  // superlative badges at once.
  const qualityBadge = isHighestVolume
    ? "Highest Volume"
    : isLongestSession
    ? "Longest Session"
    : null;

  const headId = `session-head-${session.key}`;
  const bodyId = `session-body-${session.key}`;

  return (
    <div className={`history-card ${isFavorite ? "history-card--favorite" : ""}`}>
      <div className="history-card__head-row">
        <button
          type="button"
          id={headId}
          className="history-card__head"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          aria-controls={bodyId}
        >
          <div className="history-card__top">
            <div className="history-card__heading-block">
              <div className="history-card__title-row">
                <span
                  className="history-card__type-icon"
                  style={{ background: typeColor.bg, color: typeColor.text }}
                >
                  <TypeIcon size={14} strokeWidth={2} />
                </span>
                <h3 className="history-card__title" style={{ color: typeColor.text }}>
                  {typeLabel}
                </h3>
                {hasPR && (
                  <span className="history-card__badge history-card__badge--pr">
                    <Trophy size={12} strokeWidth={2} />
                    {prCount > 1 ? `${prCount} PRs` : "PR"}
                  </span>
                )}
                {qualityBadge && (
                  <span className="history-card__badge history-card__badge--quality">
                    <Sparkles size={12} strokeWidth={2} />
                    {qualityBadge}
                  </span>
                )}
              </div>

              <div className="history-card__subline">
                {formatSessionDate(session.date)}
                {hasTimeRange && (
                  <>
                    <span className="history-card__subline-sep">&bull;</span>
                    {formatClockTime(session.startedAt)} – {formatClockTime(session.endedAt)}
                  </>
                )}
              </div>

              {visibleMuscles.length > 0 && (
                <div className="history-card__chips">
                  {visibleMuscles.map((m) => (
                    <span className="muscle-chip" key={m}>{m}</span>
                  ))}
                  {hiddenMuscleCount > 0 && (
                    <span className="muscle-chip muscle-chip--more">
                      +{hiddenMuscleCount}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="history-card__hero">
              {hasStrengthEntries && (
                <strong className="history-card__hero-line">
                  {volume.toLocaleString()} kg
                </strong>
              )}
              {hasDuration && (
                <span className="history-card__hero-line">
                  {formatDurationLong(session.sessionDuration)}
                </span>
              )}
              <span className="history-card__hero-line history-card__hero-line--muted">
                {formatSessionEntryCountLabel({ exerciseCount, cardioCount })}
              </span>
            </div>

            <ChevronDown
              size={18}
              strokeWidth={2}
              className={`history-card__chevron ${
                isExpanded ? "history-card__chevron--open" : ""
              }`}
            />
          </div>
        </button>

        <button
          type="button"
          className={`history-card__favorite ${
            isFavorite ? "history-card__favorite--active" : ""
          }`}
          onClick={onToggleFavorite}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `Remove ${typeLabel} from favorites` : `Add ${typeLabel} to favorites`}
        >
          <Star size={17} strokeWidth={1.8} fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>

      <div
        id={bodyId}
        role="region"
        aria-labelledby={headId}
        className={`session-body ${isExpanded ? "session-body--expanded" : ""}`}
      >
        <div className="session-body__inner">
          <div className="session-body__header">
            <span className="session-body__header-label">
              Session Details
            </span>
            <OverflowMenu label="Session actions">
              <button
                type="button"
                className="history-overflow-menu__item history-overflow-menu__item--danger"
                onClick={onDeleteSession}
                disabled={isDeletingSession}
              >
                {isDeletingSession ? (
                  <Loader2 size={14} strokeWidth={2} className="delete-btn__spinner" />
                ) : (
                  <Trash2 size={14} strokeWidth={1.8} />
                )}
                Delete Session
              </button>
            </OverflowMenu>
          </div>

          {hasPR && (
            <div className="session-pr-panel">
              <span className="session-pr-panel__label">
                <Trophy size={13} strokeWidth={2} />
                New Personal Record{prCount !== 1 ? "s" : ""}
              </span>
              <ul className="session-pr-panel__list">
                {session.prs.map((pr) =>
                  pr.isCardio ? (
                    <li key={`${pr.activityType}-${pr.date}`}>
                      <strong>{pr.activityType}</strong> {formatCardioPrLabel(pr)}
                    </li>
                  ) : (
                    <li key={`${pr.exercise}-${pr.date}`}>
                      <strong>{pr.exercise}</strong> {pr.weight}kg×{pr.reps}
                    </li>
                  )
                )}
              </ul>
            </div>
          )}

          {/* Timing lives here, inside Workout Details — not on the
              Calendar, which stays a pure viewer. Only shown for real
              sessions (a sessionId); legacy standalone workouts predate
              session-level timing entirely. */}
          {session.sessionId && (
            <div className="session-timing">
              <div className="session-timing__grid">
                <div className="session-timing__item">
                  <span className="session-timing__item-icon">
                    <Clock size={14} strokeWidth={1.8} />
                  </span>
                  <div className="session-timing__item-body">
                    <strong>
                      {session.startedAt ? formatClockTime(session.startedAt) : "—"}
                    </strong>
                    <span className="session-timing__label">Start</span>
                  </div>
                </div>
                <div className="session-timing__item">
                  <span className="session-timing__item-icon">
                    <Clock size={14} strokeWidth={1.8} />
                  </span>
                  <div className="session-timing__item-body">
                    <strong>
                      {session.endedAt ? formatClockTime(session.endedAt) : "—"}
                    </strong>
                    <span className="session-timing__label">End</span>
                  </div>
                </div>
                <div className="session-timing__item">
                  <span className="session-timing__item-icon">
                    <Timer size={14} strokeWidth={1.8} />
                  </span>
                  <div className="session-timing__item-body">
                    <strong>
                      {hasDuration ? formatDurationLong(session.sessionDuration) : "—"}
                    </strong>
                    <span className="session-timing__label">Duration</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="session-timing__edit-btn"
                onClick={onEditTiming}
              >
                <Pencil size={13} strokeWidth={1.8} />
                Edit Workout Timing
              </button>
            </div>
          )}

          <SessionTimeline
            session={session}
            milestones={milestones || []}
            deletingWorkoutId={deletingWorkoutId}
            onDeleteWorkout={onDeleteWorkout}
          />

          {(hasStrengthEntries || hasDuration) && (
          <div className="session-summary-footer">
            <span className="session-summary-footer__label">Session Summary</span>
            <div className="session-summary-footer__grid">
              {hasStrengthEntries && (
                <div className="session-summary-footer__row">
                  <span>Exercises</span>
                  <strong>{exerciseCount}</strong>
                </div>
              )}
              {hasStrengthEntries && (
                <div className="session-summary-footer__row">
                  <span>Sets</span>
                  <strong>{setCount}</strong>
                </div>
              )}
              {hasStrengthEntries && (
                <div className="session-summary-footer__row">
                  <span>Reps</span>
                  <strong>{totalReps.toLocaleString()}</strong>
                </div>
              )}
              {hasStrengthEntries && (
                <div className="session-summary-footer__row">
                  <span>Volume</span>
                  <strong>{volume.toLocaleString()} kg</strong>
                </div>
              )}
              {hasDuration && (
                <div className="session-summary-footer__row">
                  <span>Duration</span>
                  <strong>{formatDurationLong(session.sessionDuration)}</strong>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SessionCard;
