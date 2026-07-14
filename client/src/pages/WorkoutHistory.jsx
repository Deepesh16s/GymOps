import { useState, useEffect, useMemo } from "react";
import {
  ChevronDown,
  Clock,
  Layers,
  Flame,
  Dumbbell,
  Activity,
  Trash2,
  Loader2,
} from "lucide-react";
import "./workoutHistory.css";
import api from "../services/api";
import { getWorkouts } from "../services/workoutService";
import { SESSION_TYPE_FILTER_OPTIONS, getSessionTypeColor } from "../constants/sessionTypes";
import { DATE_RANGE_OPTIONS, DATE_RANGE_ALL, DATE_RANGE_CUSTOM } from "../constants/dateRanges";
import {
  getWorkoutVolume,
  getSetCount,
  formatSetBreakdown,
  isCardioEntry,
  getCardioActivityName,
  formatCardioSummary,
  buildSessionSummaries,
  filterSessionsBySearch,
  filterSessionsByMuscle,
  filterSessionsBySessionType,
  filterSessionsByDateRange,
  sortSessions,
  formatSessionDate,
  formatSessionEntryCountLabel,
  getSessionTypeLabel,
} from "../utils/workoutUtils";

const MAX_VISIBLE_MUSCLE_CHIPS = 3;

function WorkoutHistory() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState("All");
  const [sessionType, setSessionType] = useState("All");
  const [dateRange, setDateRange] = useState(DATE_RANGE_ALL);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [order, setOrder] = useState("newest");
  const [deletingId, setDeletingId] = useState(null);
  const [deletingSessionKey, setDeletingSessionKey] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());

  const fetchWorkouts = async () => {
    setLoading(true);
    try {
      const res = await getWorkouts(500);
      setWorkouts(res.data);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkouts();
  }, []);

  // Collapse any expanded session cards whenever the active filters
  // change, so expansion state never persists across a different
  // visible set of sessions.
  useEffect(() => {
    setExpandedKeys(new Set());
  }, [search, muscle, sessionType, dateRange, customStart, customEnd, order]);

  const muscleOptions = useMemo(() => {
    const set = new Set(workouts.map((w) => w.exercise?.muscleGroup).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [workouts]);

  // Workouts are grouped into sessions exactly once per `workouts` change.
  // Filtering, muscle-matching, and sorting below all operate on this
  // already-grouped + already-summarized list, so a session's stats are
  // never recalculated just because a filter or sort order changed.
  const allSessions = useMemo(() => buildSessionSummaries(workouts), [workouts]);

  const visibleSessions = useMemo(() => {
    let result = filterSessionsBySearch(allSessions, search);
    result = filterSessionsByMuscle(result, muscle);
    result = filterSessionsBySessionType(result, sessionType);
    result = filterSessionsByDateRange(result, dateRange, customStart, customEnd);
    result = sortSessions(result, order);
    return result;
  }, [allSessions, search, muscle, sessionType, dateRange, customStart, customEnd, order]);

  const isCustomRange = dateRange === DATE_RANGE_CUSTOM;

  const toggleExpanded = (key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDelete = async (workout) => {
    const exerciseName = workout.exercise?.name || "this exercise";
    const confirmed = window.confirm(
      `Delete "${exerciseName}" from this workout session?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(workout._id);
    try {
      await api.delete(`/workouts/${workout._id}`);
      // Removing the workout from state automatically re-groups on the next
      // render via the `allSessions` memo above. If this was the last
      // exercise in its session, the session card simply disappears —
      // no extra bookkeeping needed.
      setWorkouts((prev) => prev.filter((w) => w._id !== workout._id));
    } catch (error) {
      console.log(error);
    } finally {
      setDeletingId(null);
    }
  };

  // Deletes an entire session in one request when it has a real sessionId
  // (POST /workouts/session-created workouts), or falls back to the
  // existing single-workout delete for legacy standalone sessions, which
  // are always exactly one workout with no sessionId. Either way, local
  // state is updated directly — no refetch, card disappears immediately.
  const handleDeleteSession = async (session) => {
    const label = getSessionTypeLabel(session);
    const entryCount = session.workouts.length;
    const confirmed = window.confirm(
      `Delete this entire ${label}? This will remove all ${entryCount} entr${
        entryCount !== 1 ? "ies" : "y"
      } in this session.\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingSessionKey(session.key);
    try {
      if (session.sessionId) {
        await api.delete(`/workouts/session/${session.sessionId}`);
      } else {
        await api.delete(`/workouts/${session.workouts[0]._id}`);
      }

      const deletedIds = new Set(session.workouts.map((w) => w._id));
      setWorkouts((prev) => prev.filter((w) => !deletedIds.has(w._id)));
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        next.delete(session.key);
        return next;
      });
    } catch (error) {
      console.log(error);
    } finally {
      setDeletingSessionKey(null);
    }
  };

  return (
    <div className="history-page">
      <main className="history-main">
        <div className="history-header">
          <h1>Workout History</h1>
          <p>
            {visibleSessions.length} session{visibleSessions.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="history-controls">
          <input
            className="history-search"
            type="text"
            placeholder="Search by exercise..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="history-select"
            value={muscle}
            onChange={(e) => setMuscle(e.target.value)}
          >
            {muscleOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            className="history-select"
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value)}
          >
            {SESSION_TYPE_FILTER_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            className="history-select"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            {DATE_RANGE_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {isCustomRange && (
            <div className="history-date-range-inputs">
              <input
                type="date"
                className="history-date-input"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                aria-label="Start date"
              />
              <span className="history-date-range-sep">to</span>
              <input
                type="date"
                className="history-date-input"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                aria-label="End date"
              />
            </div>
          )}

          <select
            className="history-select"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        {loading ? (
          <div className="history-placeholder">
            <p>Loading workouts...</p>
          </div>
        ) : visibleSessions.length === 0 ? (
          <div className="history-placeholder">
            <h1>No sessions found</h1>
            <p>Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="history-list">
            {visibleSessions.map((session) => {
              const isExpanded = expandedKeys.has(session.key);
              const { exerciseCount, cardioCount, setCount, volume, muscles } =
                session.stats;
              const visibleMuscles = muscles.slice(0, MAX_VISIBLE_MUSCLE_CHIPS);
              const hiddenMuscleCount = muscles.length - visibleMuscles.length;
              const hasDuration =
                session.sessionDuration != null && session.sessionDuration > 0;
              // A cardio-only session has no meaningful Sets/Volume to
              // show — those would render as "0 Sets" / "0 kg Volume",
              // which is the same placeholder problem this phase is
              // fixing for individual entries.
              const hasStrengthEntries = exerciseCount > 0;
              const typeLabel = getSessionTypeLabel(session);
              const typeColor = getSessionTypeColor(session.sessionType);
              const isDeletingSession = deletingSessionKey === session.key;

              return (
                <div className="session-card" key={session.key}>
                  <button
                    type="button"
                    className="session-card__head"
                    onClick={() => toggleExpanded(session.key)}
                    aria-expanded={isExpanded}
                  >
                    <div className="session-card__top">
                      <div className="session-card__heading">
                        <span
                          className="session-card__type-badge"
                          style={{ background: typeColor.bg, color: typeColor.text }}
                        >
                          {typeLabel}
                        </span>
                        <span className="session-card__date">
                          {formatSessionDate(session.date)}
                        </span>
                      </div>
                      <ChevronDown
                        size={18}
                        strokeWidth={2}
                        className={`session-card__chevron ${
                          isExpanded ? "session-card__chevron--open" : ""
                        }`}
                      />
                    </div>

                    <div className="session-card__stats">
                      {hasDuration && (
                        <span className="session-stat">
                          <Clock size={13} strokeWidth={1.8} />
                          {session.sessionDuration} min
                        </span>
                      )}
                      <span className="session-stat">
                        <Dumbbell size={13} strokeWidth={1.8} />
                        {formatSessionEntryCountLabel({ exerciseCount, cardioCount })}
                      </span>
                      {hasStrengthEntries && (
                        <span className="session-stat">
                          <Layers size={13} strokeWidth={1.8} />
                          {setCount} Set{setCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      {hasStrengthEntries && (
                        <span className="session-stat">
                          <Flame size={13} strokeWidth={1.8} />
                          {volume.toLocaleString()} kg Volume
                        </span>
                      )}
                    </div>

                    {visibleMuscles.length > 0 && (
                      <div className="session-card__chips">
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
                  </button>

                  <div
                    className={`session-body ${
                      isExpanded ? "session-body--expanded" : ""
                    }`}
                  >
                    <div className="session-body__inner">
                      <div className="session-body__header">
                        <span className="session-body__header-label">
                          Session Details
                        </span>
                        <button
                          type="button"
                          className="history-delete-session-btn"
                          onClick={() => handleDeleteSession(session)}
                          disabled={isDeletingSession}
                        >
                          {isDeletingSession ? (
                            <Loader2
                              size={14}
                              strokeWidth={2}
                              className="delete-btn__spinner"
                            />
                          ) : (
                            <>
                              <Trash2 size={14} strokeWidth={1.8} />
                              Delete Session
                            </>
                          )}
                        </button>
                      </div>

                      <div className="session-exercises">
                        {session.workouts.map((w) => {
                          const isDeleting = deletingId === w._id;
                          const isCardio = isCardioEntry(w);

                          return (
                            <div className="session-exercise" key={w._id}>
                              <div className="session-exercise__main">
                                <span className="session-exercise__name">
                                  {isCardio ? (
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                      }}
                                    >
                                      <Activity size={14} strokeWidth={1.8} />
                                      {getCardioActivityName(w)}
                                    </span>
                                  ) : (
                                    w.exercise?.name || "Unknown exercise"
                                  )}
                                </span>
                                {!isCardio && (
                                  <span className="history-muscle-tag">
                                    {w.exercise?.muscleGroup}
                                  </span>
                                )}
                              </div>

                              <div className="session-exercise__sets">
                                {isCardio
                                  ? formatCardioSummary(w)
                                      .map((m) => m.text)
                                      .join(", ")
                                  : formatSetBreakdown(w)}
                              </div>

                              {!isCardio && (
                                <div className="session-exercise__meta">
                                  <span>{getSetCount(w)} sets</span>
                                  <span>
                                    {getWorkoutVolume(w).toLocaleString()} kg volume
                                  </span>
                                </div>
                              )}

                              <button
                                type="button"
                                className="history-delete-btn"
                                onClick={() => handleDelete(w)}
                                disabled={isDeleting || isDeletingSession}
                              >
                                {isDeleting ? (
                                  <Loader2
                                    size={14}
                                    strokeWidth={2}
                                    className="delete-btn__spinner"
                                  />
                                ) : (
                                  <>
                                    <Trash2 size={14} strokeWidth={1.8} />
                                    Delete
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default WorkoutHistory;