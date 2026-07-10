import { useEffect, useState } from "react";
import { Dumbbell, Plus, X } from "lucide-react";
import "./WorkoutSession.css";

const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

// Phase 1 display only: duration + exercise count, Add Exercise / Discard Session.
// Add Set, Edit Workout, and Finish Workout are intentionally not implemented here.
function WorkoutSession({ startTime, exerciseCount, onAddExercise, onDiscard }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsed = startTime ? now - startTime : 0;

  return (
    <section className="session-card">
      <div className="session-card__info">
        <div className="session-card__icon">
          <Dumbbell size={20} strokeWidth={1.8} />
        </div>
        <div>
          <p className="session-card__title">Workout Session</p>
          <div className="session-card__stats">
            <span>{formatDuration(elapsed)}</span>
            <span className="session-card__dot" />
            <span>
              {exerciseCount} {exerciseCount === 1 ? "exercise" : "exercises"}
            </span>
          </div>
        </div>
      </div>

      <div className="session-card__actions">
        <button type="button" className="cta-btn" onClick={onAddExercise}>
          <Plus size={16} strokeWidth={2.5} />
          Add Exercise
        </button>
        <button
          type="button"
          className="session-discard-btn"
          onClick={onDiscard}
        >
          <X size={15} strokeWidth={2} />
          Discard Session
        </button>
      </div>
    </section>
  );
}

export default WorkoutSession;