import { formatDate } from "../../utils/dateUtils";
import {
  formatSetBreakdown,
  getWorkoutVolume,
  getSetCount,
  isCardioEntry,
  getCardioActivityLabel,
  formatCardioSummary,
  getPrimaryCardioMetric,
} from "../../utils/workoutUtils";
import { ChartEmptyState } from "./ChartStates";
import "./progression-charts.css";

function WorkoutLogTable({ workouts = [], loading = false, limit = 50 }) {
  const isCardioTable = workouts.length > 0 && workouts.every(isCardioEntry);
  if (loading) {
    return (
      <div className="workout-log__skeleton" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className="skeleton" style={{ width: "100%", height: 40, borderRadius: 8, display: "block" }} />
        ))}
      </div>
    );
  }

  if (!workouts.length) {
    return (
      <ChartEmptyState
        height={140}
        title="No workouts in this view"
        message="Adjust the filters above, or log a session that matches this scope."
      />
    );
  }

  const rows = workouts.slice(0, limit);

  return (
    <div className="workout-log">
      <div className="workout-log__table-wrap">
        <table className="workout-log__table">
          <thead>
            {isCardioTable ? (
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Activity</th>
                <th>Metrics</th>
                <th>Primary</th>
              </tr>
            ) : (
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Exercise</th>
                <th>Muscle</th>
                <th>Sets</th>
                <th>Volume</th>
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((w) => {
              const date = new Date(w.date || w.createdAt);
              if (isCardioTable) {
                return (
                  <tr key={w._id}>
                    <td>{formatDate(date)}</td>
                    <td>{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="workout-log__exercise">{getCardioActivityLabel(w)}</td>
                    <td>{formatCardioSummary(w).map((m) => m.text).join(", ") || "—"}</td>
                    <td>{getPrimaryCardioMetric(w) || "—"}</td>
                  </tr>
                );
              }
              return (
                <tr key={w._id}>
                  <td>{formatDate(date)}</td>
                  <td>{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="workout-log__exercise">{w.exercise?.name || "—"}</td>
                  <td>{w.exercise?.muscleGroup || "—"}</td>
                  <td>
                    {formatSetBreakdown(w)}{" "}
                    <span className="workout-log__set-count">({getSetCount(w)})</span>
                  </td>
                  <td>{getWorkoutVolume(w).toLocaleString()} kg</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {workouts.length > limit && (
        <p className="workout-log__more">
          Showing the {limit} most recent of {workouts.length} logged entries in this view.
        </p>
      )}
    </div>
  );
}

export default WorkoutLogTable;
