import { useMemo, memo } from "react";
import { Trophy, TrendingUp } from "lucide-react";
import Drawer from "./Drawer";
import ExerciseSessionChart from "./progression/ExerciseSessionChart";
import { getExerciseHistorySnapshot, strengthWorkoutsForExercise } from "../progression/liveWorkoutEngine";
import { buildExerciseSessionSeries } from "../progression/progressionEngine";
import { EXERCISE_DEFAULT_METRIC, getMetricDef } from "../progression/progressionMetrics";
import "./ExerciseHistoryDrawer.css";

function ExerciseHistoryDrawer({ open, onClose, entry, historicalWorkouts = [], onUpdateNote }) {
  const exercise = entry?.exercise;

  const pastWorkouts = useMemo(
    () => (exercise ? strengthWorkoutsForExercise(historicalWorkouts, exercise._id) : []),
    [historicalWorkouts, exercise]
  );

  const snapshot = useMemo(
    () => (exercise ? getExerciseHistorySnapshot(historicalWorkouts, exercise._id) : null),
    [historicalWorkouts, exercise]
  );

  const series = useMemo(() => buildExerciseSessionSeries(pastWorkouts), [pastWorkouts]);
  const metricDef = getMetricDef(EXERCISE_DEFAULT_METRIC);

  if (!exercise) return null;

  const last5 = pastWorkouts.slice(0, 5);

  return (
    <Drawer open={open} onClose={onClose} title={exercise.name}>
      <div className="ex-history-drawer">
        <div className="ex-history-drawer__stats">
          <div className="ex-history-drawer__stat">
            <span>Best Set</span>
            <strong>
              {snapshot?.bestSet ? `${snapshot.bestSet.weight} kg × ${snapshot.bestSet.reps}` : "—"}
            </strong>
          </div>
          <div className="ex-history-drawer__stat">
            <span>Est. 1RM</span>
            <strong>{snapshot?.estOneRM ? `${snapshot.estOneRM} kg` : "—"}</strong>
          </div>
        </div>

        <div className="ex-history-drawer__section">
          <p className="ex-history-drawer__section-title">
            <TrendingUp size={13} strokeWidth={2} /> Trend
          </p>
          <ExerciseSessionChart series={series} metricKey={metricDef.key} metricDef={metricDef} height={160} />
        </div>

        <div className="ex-history-drawer__section">
          <p className="ex-history-drawer__section-title">Last 5 Sessions</p>
          {last5.length ? (
            <div className="ex-history-drawer__sessions">
              {last5.map((w) => (
                <div className="ex-history-drawer__session" key={w._id}>
                  <span className="ex-history-drawer__session-date">
                    {new Date(w.date || w.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="ex-history-drawer__session-sets">
                    {(w.workoutSets || []).map((s) => `${s.weight}×${s.reps}`).join(", ")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="ex-history-drawer__empty">No sessions logged yet for this exercise.</p>
          )}
        </div>

        <div className="ex-history-drawer__section">
          <p className="ex-history-drawer__section-title">Note</p>
          <textarea
            className="ex-history-drawer__note-field"
            placeholder="Note for this exercise"
            value={entry.note || ""}
            onChange={(e) => onUpdateNote?.(e.target.value)}
            rows={3}
          />
        </div>

        {snapshot?.bestSet && (
          <p className="ex-history-drawer__footnote">
            <Trophy size={11} strokeWidth={2} /> Lifetime best logged so far
          </p>
        )}
      </div>
    </Drawer>
  );
}

export default memo(ExerciseHistoryDrawer);
