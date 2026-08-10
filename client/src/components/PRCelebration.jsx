import { useEffect } from "react";
import { Trophy } from "lucide-react";
import "./PRCelebration.css";

const AUTO_DISMISS_MS = 4500;

const LABELS = {
  lifetimePR: "New Lifetime PR",
  repPR: "New Rep PR",
  volumePR: "New Volume PR",
};

function PRCelebration({ pr, exerciseName, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [pr, onDismiss]);

  if (!pr) return null;

  const badges = ["lifetimePR", "repPR", "volumePR"].filter((key) => pr[key]);
  if (!badges.length) return null;

  return (
    <div className="pr-celebration" role="status">
      <div className="pr-celebration__icon">
        <Trophy size={16} strokeWidth={2} />
      </div>
      <div className="pr-celebration__body">
        {badges.map((key) => (
          <p className="pr-celebration__title" key={key}>
            {LABELS[key]}
          </p>
        ))}
        <p className="pr-celebration__detail">
          {exerciseName} · {pr.weight} kg × {pr.reps}
        </p>
      </div>
      <button
        type="button"
        className="pr-celebration__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

export default PRCelebration;
