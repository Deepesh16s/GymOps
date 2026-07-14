import { formatDate } from "../../utils/dateUtils";
import "./progression-charts.css";

// Decorative, fixed per-muscle color so a reader can visually group a
// long PR list by muscle at a glance without reading every label — not
// tied to any design-token semantic (success/warning/etc.), just a
// distinct hue per group. Purely cosmetic: falls back to a neutral dot
// for cardio/unclassified entries rather than omitting the dot entirely.
const MUSCLE_DOT_COLORS = {
  Chest: "#22c55e",
  Back: "#3b82f6",
  Shoulders: "#ef4444",
  Biceps: "#a855f7",
  Triceps: "#f97316",
  Forearms: "#14b8a6",
  Legs: "#eab308",
  Quads: "#06b6d4",
  Glutes: "#ec4899",
  Calves: "#84cc16",
  Hamstrings: "#6366f1",
  Abs: "#f43f5e",
};

// One row of a Personal Records list — either the current heaviest set
// for an exercise, or (in a chronological "recent records" view) a single
// past record-broken event. Shared by Progression and Analytics, both of
// which derive their record lists from the same strengthUtils.prHistory.
function PersonalRecordRow({ record }) {
  const dotColor = MUSCLE_DOT_COLORS[record.muscle] || "var(--go-text-faint)";
  return (
    <div className="prog-pr__row">
      <div className="prog-pr__row-main">
        <p className="prog-pr__row-name">
          {record.muscle && (
            <span className="prog-pr__row-dot" style={{ background: dotColor }} title={record.muscle} />
          )}
          <span className="prog-pr__row-name-text" title={record.exercise}>
            {record.exercise}
          </span>
        </p>
        <p className="prog-pr__row-date">{formatDate(record.date)}</p>
      </div>
      <div className="prog-pr__row-figures">
        <span className="prog-pr__row-weight">{record.weight} kg</span>
        <span className="prog-pr__row-est">Est. 1RM {record.estOneRM} kg</span>
      </div>
    </div>
  );
}

export default PersonalRecordRow;
