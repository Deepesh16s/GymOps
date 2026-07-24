import { CheckCircle2, Trophy, X } from "lucide-react";
import "./FinishWorkoutSummary.css";

// Module 9 — replaces the plain-text success banner with a real
// "Workout Complete" card. `summary` is assembled by Dashboard right
// after a successful finishWorkout(): the local session totals
// (duration/volume/exercises/sets/prExerciseCount) were captured from
// WorkoutSession before it unmounted, and badges/currentStreak are
// computed from the freshly-refetched workouts (so they already include
// the session that just finished).
function FinishWorkoutSummary({ summary, onClose }) {
  if (!summary) return null;

  const {
    durationMinutes,
    totalVolume,
    exerciseCount,
    setCount,
    prExerciseCount,
    badges = [],
    currentStreak,
  } = summary;

  // Counts distinct exercises with a PR, not raw PR events — "PR in 2
  // exercises" reads more meaningfully than a number that could double-
  // count one exercise broken twice in the same session.
  const prLabel =
    prExerciseCount > 0
      ? `${prExerciseCount} ${prExerciseCount === 1 ? "exercise" : "exercises"}`
      : "—";

  return (
    <div className="finish-summary-overlay">
      <div className="finish-summary-card">
        <button
          type="button"
          className="finish-summary-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={16} strokeWidth={2} />
        </button>

        <div className="finish-summary-icon">
          <CheckCircle2 size={28} strokeWidth={1.8} />
        </div>
        <p className="finish-summary-title">Workout Complete</p>

        <div className="finish-summary-grid">
          <div className="finish-summary-stat">
            <span>Duration</span>
            <strong>{durationMinutes < 1 ? "<1 min" : `${durationMinutes} min`}</strong>
          </div>
          <div className="finish-summary-stat">
            <span>Volume</span>
            <strong>{Math.round(totalVolume).toLocaleString()} kg</strong>
          </div>
          <div className="finish-summary-stat">
            <span>Exercises</span>
            <strong>{exerciseCount}</strong>
          </div>
          <div className="finish-summary-stat">
            <span>Sets</span>
            <strong>{setCount}</strong>
          </div>
          <div className="finish-summary-stat">
            <span>New PRs</span>
            <strong>{prLabel}</strong>
          </div>
          <div className="finish-summary-stat">
            <span>Consistency</span>
            <strong>{currentStreak > 0 ? `🔥 Day ${currentStreak}` : "—"}</strong>
          </div>
        </div>

        {badges.length > 0 && (
          <div className="finish-summary-badges">
            {badges.map((badge) => (
              <span className="finish-summary-badge" key={badge.key}>
                <Trophy size={12} strokeWidth={2} /> {badge.label}
              </span>
            ))}
          </div>
        )}

        <button type="button" className="finish-summary-done-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

export default FinishWorkoutSummary;
