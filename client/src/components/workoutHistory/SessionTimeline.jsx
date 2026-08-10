import { useMemo } from "react";
import { Play, CheckCircle2, Dumbbell, Activity, Trophy, Award, Trash2, Loader2 } from "lucide-react";
import { formatDurationLong, formatClockTime } from "../../utils/timeFormat";
import {
  buildSessionTimeline,
  getWorkoutVolume,
  getSetCount,
  getCardioActivityName,
  getCardioActivityLabel,
  formatCardioSummary,
  formatCardioPrLabel,
} from "../../utils/workoutUtils";
import OverflowMenu from "./OverflowMenu";

const MAX_VISIBLE_SETS = 4;

function eventKey(ev) {
  return ev.type === "exercise" ? ev.workout._id : ev.type;
}

function EventIcon({ event }) {
  if (event.type === "workout-started") return <Play size={13} strokeWidth={2} />;
  if (event.type === "workout-finished") return <CheckCircle2 size={13} strokeWidth={2} />;
  if (event.pr) return <Trophy size={13} strokeWidth={2} />;
  return event.isCardio ? <Activity size={13} strokeWidth={2} /> : <Dumbbell size={13} strokeWidth={2} />;
}

function SessionTimeline({ session, milestones, deletingWorkoutId, onDeleteWorkout }) {
  const events = useMemo(() => buildSessionTimeline(session), [session]);

  if (!events.length) return null;

  return (
    <div className="session-timeline">
      {milestones.length > 0 && (
        <div className="session-timeline__milestones">
          {milestones.map((m) => (
            <span className="session-timeline__milestone" key={m}>
              <Award size={12} strokeWidth={2} />
              {m}
            </span>
          ))}
        </div>
      )}

      <ol className="session-timeline__list" aria-label="Workout timeline">
        {events.map((ev, i) => {
          const isLast = i === events.length - 1;
          const isCardio = ev.type === "exercise" && ev.isCardio;
          const w = ev.workout;
          const visibleSets = !isCardio && w ? (w.workoutSets || []).slice(0, MAX_VISIBLE_SETS) : [];
          const hiddenSetCount = !isCardio && w ? (w.workoutSets || []).length - visibleSets.length : 0;

          return (
            <li
              className="session-timeline__event"
              key={eventKey(ev)}
              style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}
            >
              <div className="session-timeline__rail" aria-hidden="true">
                <span
                  className={`session-timeline__dot ${
                    ev.pr ? "session-timeline__dot--pr" : `session-timeline__dot--${ev.type}`
                  }`}
                >
                  <EventIcon event={ev} />
                </span>
                {!isLast && <span className="session-timeline__connector" />}
              </div>

              <div className="session-timeline__content">
                {ev.relativeLabel && (
                  <span className="session-timeline__delta">{ev.relativeLabel}</span>
                )}

                {ev.type === "workout-started" && (
                  <>
                    <div className="session-timeline__title">Workout Started</div>
                    <div className="session-timeline__subtitle">{formatClockTime(ev.time)}</div>
                  </>
                )}

                {ev.type === "workout-finished" && (
                  <>
                    <div className="session-timeline__title">
                      <CheckCircle2 size={14} strokeWidth={2} />
                      Workout Finished
                    </div>
                    <div className="session-timeline__subtitle">{formatClockTime(ev.time)}</div>
                    <div className="session-timeline__finish-stats">
                      {ev.sessionDuration != null && (
                        <div className="session-timeline__finish-stat">
                          <span>Duration</span>
                          <span className="session-timeline__finish-stat-sep">&bull;</span>
                          <strong>{formatDurationLong(ev.sessionDuration)}</strong>
                        </div>
                      )}
                      {ev.volume > 0 && (
                        <div className="session-timeline__finish-stat">
                          <span>Volume</span>
                          <span className="session-timeline__finish-stat-sep">&bull;</span>
                          <strong>{ev.volume.toLocaleString()} kg</strong>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {ev.type === "exercise" && (
                  <div className="session-timeline__row">
                    <div className="session-timeline__main">
                      <div className="session-timeline__title">
                        {isCardio ? getCardioActivityLabel(w) : w.exercise?.name || "Unknown exercise"}
                        {!isCardio && (
                          <span className="history-muscle-tag">{w.exercise?.muscleGroup}</span>
                        )}
                      </div>

                      {ev.pr && (
                        <div className="session-timeline__pr">
                          <span className="session-timeline__pr-label">
                            <Trophy size={12} strokeWidth={2} />
                            New Personal Record
                          </span>
                          <div className="session-timeline__pr-value">
                            {ev.pr.isCardio ? formatCardioPrLabel(ev.pr) : `${ev.pr.weight}kg × ${ev.pr.reps}`}
                          </div>
                          {ev.pr.previousBest && (
                            <div className="session-timeline__pr-previous">
                              Previous best:{" "}
                              {ev.pr.isCardio
                                ? formatCardioPrLabel(ev.pr.previousBest)
                                : `${ev.pr.previousBest.weight}kg × ${ev.pr.previousBest.reps}`}
                            </div>
                          )}
                        </div>
                      )}

                      {isCardio ? (
                        <div className="session-timeline__tiles">
                          {formatCardioSummary(w).map((m) => (
                            <div className="session-exercise__tile" key={m.key}>
                              <span className="session-exercise__tile-value">{m.text}</span>
                              <span className="session-exercise__tile-label">{m.label}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="session-timeline__sets">
                            {visibleSets.map((s, si) => (
                              <div
                                className={`session-timeline__set ${
                                  s === ev.best ? "session-timeline__set--best" : ""
                                }`}
                                key={si}
                              >
                                <span className="session-timeline__set-index">Set {si + 1}</span>
                                <span className="session-timeline__set-value">
                                  {s.weight} × {s.reps}
                                </span>
                              </div>
                            ))}
                            {hiddenSetCount > 0 && (
                              <div className="session-timeline__set session-timeline__set--more">
                                +{hiddenSetCount} more set{hiddenSetCount !== 1 ? "s" : ""}
                              </div>
                            )}
                          </div>

                          <div className="session-exercise__tiles">
                            {ev.best && (
                              <div className="session-exercise__tile">
                                <span className="session-exercise__tile-value">
                                  {ev.best.weight} kg × {ev.best.reps}
                                </span>
                                <span className="session-exercise__tile-label">Best Set</span>
                              </div>
                            )}
                            <div className="session-exercise__tile">
                              <span className="session-exercise__tile-value">
                                {getWorkoutVolume(w).toLocaleString()} kg
                              </span>
                              <span className="session-exercise__tile-label">
                                {getSetCount(w)} Set{getSetCount(w) !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <OverflowMenu
                      label={`${isCardio ? getCardioActivityName(w) : w.exercise?.name || "Exercise"} actions`}
                    >
                      <button
                        type="button"
                        className="history-overflow-menu__item history-overflow-menu__item--danger"
                        onClick={() => onDeleteWorkout(w)}
                        disabled={deletingWorkoutId === w._id}
                      >
                        {deletingWorkoutId === w._id ? (
                          <Loader2 size={14} strokeWidth={2} className="delete-btn__spinner" />
                        ) : (
                          <Trash2 size={14} strokeWidth={1.8} />
                        )}
                        Delete
                      </button>
                    </OverflowMenu>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default SessionTimeline;
