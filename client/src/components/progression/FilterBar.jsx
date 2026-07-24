import { Activity, Dumbbell, LayoutGrid, HeartPulse } from "lucide-react";
import { TIME_RANGE_OPTIONS } from "../../progression";
import "./progression-charts.css";

const PRIMARY_VIEWS = [
  { key: "overall", label: "Overall", icon: LayoutGrid },
  { key: "muscle", label: "Muscle", icon: Activity },
  { key: "exercise", label: "Exercise", icon: Dumbbell },
  { key: "cardio", label: "Cardio", icon: HeartPulse },
];

// The primary filter row for the whole Progression page — scope
// (Overall/Muscle/Exercise) plus Time Range. Kept deliberately narrow:
// Metric + Moving Average only apply to the Advanced Analytics chart
// (a secondary, collapsible section), so those controls live there
// instead of cluttering the page's top-level filter row. Every option
// list (muscles, exercises) is passed in already-derived from the
// current dataset, so this component has no knowledge of workouts/
// sessions itself — purely a controlled input surface.
function FilterBar({
  viewMode,
  onViewModeChange,
  muscle,
  onMuscleChange,
  availableMuscles = [],
  exercise,
  onExerciseChange,
  availableExercises = [],
  cardioActivity,
  onCardioActivityChange,
  availableCardioActivities = [],
  timeRange,
  onTimeRangeChange,
}) {
  return (
    <div className="progression-filterbar">
      <div className="progression-filterbar__primary" role="tablist" aria-label="Progression scope">
        {PRIMARY_VIEWS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={viewMode === key}
            className={`progression-filterbar__tab ${viewMode === key ? "progression-filterbar__tab--active" : ""}`}
            onClick={() => onViewModeChange(key)}
          >
            <Icon size={15} strokeWidth={1.8} />
            {label}
          </button>
        ))}
      </div>

      <div className="progression-filterbar__secondary">
        {viewMode === "muscle" && (
          <select
            className="progression-filterbar__select"
            value={muscle || ""}
            onChange={(e) => onMuscleChange(e.target.value)}
            aria-label="Select muscle group"
          >
            <option value="" disabled>
              Select a muscle
            </option>
            {availableMuscles.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}

        {viewMode === "exercise" && (
          <select
            className="progression-filterbar__select"
            value={exercise || ""}
            onChange={(e) => onExerciseChange(e.target.value)}
            aria-label="Select exercise"
          >
            <option value="" disabled>
              Select an exercise
            </option>
            {availableExercises.map((ex) => (
              <option key={ex} value={ex}>
                {ex}
              </option>
            ))}
          </select>
        )}

        {viewMode === "cardio" && (
          <select
            className="progression-filterbar__select"
            value={cardioActivity || ""}
            onChange={(e) => onCardioActivityChange(e.target.value)}
            aria-label="Select cardio activity"
          >
            <option value="" disabled>
              Select an activity
            </option>
            {availableCardioActivities.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        )}

        <select
          className="progression-filterbar__select"
          value={timeRange}
          onChange={(e) => onTimeRangeChange(e.target.value)}
          aria-label="Select time range"
        >
          {TIME_RANGE_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default FilterBar;
