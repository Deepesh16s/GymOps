import "./calendar.css";
import { useEffect, useState, useMemo, useRef } from "react";
import api from "../services/api";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  Flame,
  Clock,
  Layers,
  Dumbbell,
  Activity,
  Trash2,
  Loader2,
  Star,
  MapPin,
} from "lucide-react";
import { getSessionTypeColor } from "../constants/sessionTypes";
import { prHistory } from "../utils/strengthUtils";
import {
  buildSessionSummaries,
  getWorkoutVolume,
  getSetCount,
  formatSetBreakdown,
  isCardioEntry,
  getCardioActivityName,
  formatCardioSummary,
  formatSessionEntryCountLabel,
  getSessionTypeLabel,
} from "../utils/workoutUtils";

// Relative to the single heaviest day ever logged (not a fixed kg
// threshold) — so "Heavy" means the same thing whether a user's typical
// session is 2,000kg or 20,000kg, matching how MuscleBodyMap scales its
// own intensity tiers off the user's own max rather than an absolute cutoff.
function intensityTier(volume, maxVolume) {
  if (!volume || !maxVolume) return null;
  const ratio = volume / maxVolume;
  if (ratio > 0.75) return "heavy";
  if (ratio > 0.4) return "moderate";
  return "light";
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MAX_VISIBLE_MUSCLE_CHIPS = 3;

const getLocalDateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function CalendarPage() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());
  const [deletingSessionKey, setDeletingSessionKey] = useState(null);
  const [hoveredDateKey, setHoveredDateKey] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [navDirection, setNavDirection] = useState("next");
  const hasAutoSelected = useRef(false);
  const gridWrapRef = useRef(null);

  const today = new Date();

  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  useEffect(() => {
    const fetchWorkouts = async () => {
      try {
        const res = await api.get("/dashboard/calendar-workouts");
        setWorkouts(res.data);
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkouts();
  }, []);

  // Same grouping used by Workout History — one card = one session,
  // legacy workouts (no sessionId) become their own standalone session.
  // Regrouped only when the raw workout list changes, mirroring the
  // `allSessions` memo pattern in WorkoutHistory.jsx.
  const allSessions = useMemo(() => buildSessionSummaries(workouts), [workouts]);

  const recordEvents = useMemo(() => prHistory(workouts), [workouts]);
  const prDateKeys = useMemo(
    () => new Set(recordEvents.map((ev) => getLocalDateKey(ev.date))),
    [recordEvents]
  );

  // Sessions grouped by day (not just a count) — powers intensity tiers,
  // session-type chips, and the hover preview, all of which need the
  // actual session data for that day, not just "did something happen".
  const sessionsByDateKey = useMemo(() => {
    const map = new Map();
    allSessions.forEach((s) => {
      const key = getLocalDateKey(s.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    });
    return map;
  }, [allSessions]);

  const volumeByDateKey = useMemo(() => {
    const map = new Map();
    sessionsByDateKey.forEach((sessions, key) => {
      map.set(key, sessions.reduce((sum, s) => sum + (s.stats.volume || 0), 0));
    });
    return map;
  }, [sessionsByDateKey]);

  // Lifetime max (not just this month's max) so a tier means the same
  // thing regardless of which month is in view — flipping to a new month
  // never silently redefines what "Heavy" means.
  const maxDayVolume = useMemo(() => {
    let max = 0;
    volumeByDateKey.forEach((v) => { if (v > max) max = v; });
    return max;
  }, [volumeByDateKey]);

  // Collapse any expanded session card whenever the selected day changes,
  // so expansion state never leaks from one day's sessions to another's.
  useEffect(() => {
    setExpandedKeys(new Set());
  }, [selectedDate]);

  // Marker map: dateKey -> number of sessions that day. Replaces the old
  // "dot = workout" set with a session count, since a day's marker should
  // reflect sessions, not individual exercise documents.
  const sessionCountsByDate = useMemo(() => {
    const counts = new Map();
    allSessions.forEach((s) => {
      const key = getLocalDateKey(s.date);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [allSessions]);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const calendarDays = [];

  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const getDateKey = (day) => {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const todayKey = getLocalDateKey(today);

  const selectedSessions = selectedDate
    ? allSessions.filter((s) => getLocalDateKey(s.date) === selectedDate)
    : [];

  // Auto-select today (or the most recently logged workout) once the
  // data has loaded, so the details panel never opens on an unnecessary
  // "tap any day" prompt when there's something to show right away. Runs
  // exactly once — after that, the user's own clicks own selectedDate.
  useEffect(() => {
    if (loading || hasAutoSelected.current) return;
    hasAutoSelected.current = true;
    if (sessionCountsByDate.has(todayKey)) {
      setSelectedDate(todayKey);
      return;
    }
    if (allSessions.length > 0) {
      const mostRecent = [...allSessions].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      setSelectedDate(getLocalDateKey(mostRecent.date));
      setViewMonth(new Date(mostRecent.date).getMonth());
      setViewYear(new Date(mostRecent.date).getFullYear());
    }
  }, [loading, allSessions, sessionCountsByDate, todayKey]);

  // This month's own headline numbers — a quick "how'd this month go"
  // read above the grid, recomputed whenever the visible month changes.
  const monthSummary = useMemo(() => {
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
    let sessionCount = 0;
    let exerciseCount = 0;
    let minutes = 0;
    sessionsByDateKey.forEach((sessions, key) => {
      if (!key.startsWith(monthPrefix)) return;
      sessionCount += sessions.length;
      sessions.forEach((s) => {
        exerciseCount += s.stats.exerciseCount + s.stats.cardioCount;
        minutes += s.sessionDuration || 0;
      });
    });
    const prCount = recordEvents.filter((ev) => getLocalDateKey(ev.date).startsWith(monthPrefix)).length;
    return { sessionCount, exerciseCount, prCount, hours: Math.round((minutes / 60) * 10) / 10 };
  }, [sessionsByDateKey, recordEvents, viewMonth, viewYear]);

  const goToPrevMonth = () => {
    setNavDirection("prev");
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    setNavDirection("next");
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    setNavDirection(
      viewYear === today.getFullYear() && viewMonth === today.getMonth()
        ? navDirection
        : new Date(viewYear, viewMonth) < new Date(today.getFullYear(), today.getMonth())
        ? "next"
        : "prev"
    );
    setViewMonth(today.getMonth());
    setViewYear(today.getFullYear());
    setSelectedDate(todayKey);
  };

  const handleCellHover = (dateKey, e) => {
    const wrapBox = gridWrapRef.current?.getBoundingClientRect();
    const cellBox = e.currentTarget.getBoundingClientRect();
    if (!wrapBox) return;
    setHoverPos({
      x: cellBox.left - wrapBox.left + cellBox.width / 2,
      y: cellBox.top - wrapBox.top,
    });
    setHoveredDateKey(dateKey);
  };

  const toggleExpanded = (key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Same delete contract as WorkoutHistory's handleDeleteSession: real
  // sessions go through the session-delete endpoint, legacy standalone
  // sessions fall back to the single-workout delete. Local state only —
  // no refetch, card disappears immediately.
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
    <div className="calendar-page">
      <main className="calendar-main">
        <div className="calendar-card go-card">
          <div className="calendar-header">
            <div>
              <h1 className="calendar-title go-page-title">
                Workout Calendar
              </h1>

              <p className="go-page-subtitle">
                See every session at a glance.
              </p>
            </div>

            <div className="calendar-nav">
              <button
                type="button"
                className="calendar-nav-btn"
                onClick={goToPrevMonth}
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>

              <span className="calendar-month-label">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>

              <button
                type="button"
                className="calendar-nav-btn"
                onClick={goToNextMonth}
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>

              <button
                type="button"
                className="calendar-today-btn"
                onClick={goToToday}
              >
                <MapPin size={12} strokeWidth={2.2} />
                Today &bull; {MONTH_NAMES[today.getMonth()].slice(0, 3)} {today.getDate()}
              </button>
            </div>
          </div>

          {!loading && monthSummary.sessionCount > 0 && (
            <div className="calendar-month-summary">
              <div className="calendar-month-summary__chip">
                <span className="calendar-month-summary__value">{monthSummary.sessionCount}</span>
                <span className="calendar-month-summary__label">
                  Workout{monthSummary.sessionCount !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="calendar-month-summary__chip">
                <span className="calendar-month-summary__value">{monthSummary.exerciseCount}</span>
                <span className="calendar-month-summary__label">Exercises</span>
              </div>
              <div className="calendar-month-summary__chip">
                <span className="calendar-month-summary__value">{monthSummary.prCount}</span>
                <span className="calendar-month-summary__label">PR{monthSummary.prCount !== 1 ? "s" : ""}</span>
              </div>
              {monthSummary.hours > 0 && (
                <div className="calendar-month-summary__chip">
                  <span className="calendar-month-summary__value">{monthSummary.hours}h</span>
                  <span className="calendar-month-summary__label">Trained</span>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="calendar-grid">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="calendar-cell go-skeleton" />
              ))}
            </div>
          ) : (
            <div className="calendar-grid-wrap" ref={gridWrapRef}>
              <div
                className={`calendar-grid calendar-grid--slide-${navDirection}`}
                key={`${viewYear}-${viewMonth}`}
              >
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="calendar-weekday">
                    {day}
                  </div>
                ))}

                {calendarDays.map((day, index) => {
                  if (!day) {
                    return <div key={index} className="calendar-cell empty" />;
                  }

                  const dateKey = getDateKey(day);
                  const daySessions = sessionsByDateKey.get(dateKey) || [];
                  const sessionCount = daySessions.length;
                  const hasWorkout = sessionCount > 0;
                  const isToday = dateKey === todayKey;
                  const isSelected = dateKey === selectedDate;
                  const isPrDay = prDateKeys.has(dateKey);
                  const tier = hasWorkout
                    ? intensityTier(volumeByDateKey.get(dateKey), maxDayVolume)
                    : null;
                  const dayOfWeek = index % 7;
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                  const prevKey = day > 1 ? getDateKey(day - 1) : null;
                  const nextKey = day < daysInMonth ? getDateKey(day + 1) : null;
                  const connectPrev = hasWorkout && prevKey && sessionCountsByDate.has(prevKey);
                  const connectNext = hasWorkout && nextKey && sessionCountsByDate.has(nextKey);

                  const sessionTypes = [...new Set(daySessions.map((s) => s.sessionType).filter(Boolean))];

                  return (
                    <button
                      type="button"
                      key={index}
                      className={[
                        "calendar-cell",
                        hasWorkout ? "workout-day" : "",
                        tier ? `intensity-${tier}` : "",
                        isWeekend ? "is-weekend" : "",
                        isToday ? "is-today" : "",
                        isSelected ? "is-selected" : "",
                        connectPrev ? "connect-prev" : "",
                        connectNext ? "connect-next" : "",
                      ].join(" ").trim()}
                      onClick={() => setSelectedDate(dateKey)}
                      onMouseEnter={(e) => hasWorkout && handleCellHover(dateKey, e)}
                      onMouseLeave={() => setHoveredDateKey(null)}
                    >
                      {connectPrev && <span className="calendar-cell__connector calendar-cell__connector--prev" />}
                      {connectNext && <span className="calendar-cell__connector calendar-cell__connector--next" />}
                      <span className="calendar-cell-day">{day}</span>
                      {isPrDay && (
                        <Star size={11} strokeWidth={2} className="calendar-cell__pr-star" fill="currentColor" />
                      )}
                      {hasWorkout && sessionCount === 1 && (
                        <div className="calendar-dot" />
                      )}
                      {hasWorkout && sessionCount > 1 && (
                        <span className="calendar-session-count-badge">
                          {sessionCount}
                        </span>
                      )}
                      {sessionTypes.length > 0 && (
                        <span className="calendar-cell__type-chips">
                          {sessionTypes.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="calendar-cell__type-dot"
                              style={{ background: getSessionTypeColor(t).text }}
                              title={t}
                            />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {hoveredDateKey && (sessionsByDateKey.get(hoveredDateKey) || []).length > 0 && (
                <CalendarHoverPreview
                  sessions={sessionsByDateKey.get(hoveredDateKey)}
                  isPrDay={prDateKeys.has(hoveredDateKey)}
                  pos={hoverPos}
                />
              )}
            </div>
          )}
        </div>

        <div className="calendar-details-card go-card">
          <div className="calendar-details-header">
            <CalendarDays size={16} strokeWidth={1.8} />
            <h2 className="calendar-details-header__title">
              {selectedDate ? formatLongDate(selectedDate) : "Pick a day"}
            </h2>
          </div>

          {/* Reachable only when there's truly no workout history at all —
              auto-select (above) always lands on today or the most recent
              session otherwise, so this never shows a "tap any day" prompt
              when there's actually something to tap. */}
          {!selectedDate && (
            <div className="go-empty">
              <div className="go-empty-icon">
                <CalendarDays size={20} strokeWidth={1.8} />
              </div>
              <p className="go-empty-title">📅 No workouts yet</p>
              <p className="go-empty-sub">
                Log your first session and this calendar will fill in with your
                training history, sets, and personal records.
              </p>
            </div>
          )}

          {selectedDate && selectedSessions.length === 0 && (
            <div className="go-empty">
              <div className="go-empty-icon">
                <Flame size={20} strokeWidth={1.8} />
              </div>
              <p className="go-empty-title">Rest day</p>
              <p className="go-empty-sub">No workouts logged on this day.</p>
            </div>
          )}

          <div className="calendar-session-list calendar-timeline">
            {selectedSessions.map((session, sessionIndex) => {
              const isExpanded = expandedKeys.has(session.key);
              const { exerciseCount, cardioCount, setCount, volume, muscles } =
                session.stats;
              const visibleMuscles = muscles.slice(0, MAX_VISIBLE_MUSCLE_CHIPS);
              const hiddenMuscleCount = muscles.length - visibleMuscles.length;
              const hasDuration =
                session.sessionDuration != null && session.sessionDuration > 0;
              // Same rule as WorkoutHistory.jsx: a cardio-only session has
              // no meaningful Sets/Volume, so those stats are hidden
              // rather than showing "0 Sets" / "0 kg".
              const hasStrengthEntries = exerciseCount > 0;
              const typeLabel = getSessionTypeLabel(session);
              const typeColor = getSessionTypeColor(session.sessionType);
              const isDeletingSession = deletingSessionKey === session.key;
              const sessionTime = new Date(session.date).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              });
              const isLastSession = sessionIndex === selectedSessions.length - 1;

              return (
                <div className="calendar-timeline-row" key={session.key}>
                  <div className="calendar-timeline-rail">
                    <span className="calendar-timeline-dot" style={{ background: typeColor.text }} />
                    {!isLastSession && <span className="calendar-timeline-line" />}
                  </div>
                  <div className="calendar-timeline-content">
                    <span className="calendar-timeline-time">{sessionTime}</span>
                <div className="calendar-session-card">
                  <button
                    type="button"
                    className="calendar-session-card__head"
                    onClick={() => toggleExpanded(session.key)}
                    aria-expanded={isExpanded}
                  >
                    <div className="calendar-session-card__top">
                      <span
                        className="calendar-session-type-badge"
                        style={{ background: typeColor.bg, color: typeColor.text }}
                      >
                        {typeLabel}
                      </span>
                      <ChevronDown
                        size={16}
                        strokeWidth={2}
                        className={`calendar-session-card__chevron ${
                          isExpanded ? "calendar-session-card__chevron--open" : ""
                        }`}
                      />
                    </div>

                    <div className="calendar-session-card__stats">
                      {hasDuration && (
                        <span className="calendar-session-stat">
                          <Clock size={12} strokeWidth={1.8} />
                          {session.sessionDuration} min
                        </span>
                      )}
                      <span className="calendar-session-stat">
                        <Dumbbell size={12} strokeWidth={1.8} />
                        {formatSessionEntryCountLabel({ exerciseCount, cardioCount })}
                      </span>
                      {hasStrengthEntries && (
                        <span className="calendar-session-stat">
                          <Layers size={12} strokeWidth={1.8} />
                          {setCount} Set{setCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      {hasStrengthEntries && (
                        <span className="calendar-session-stat">
                          <Flame size={12} strokeWidth={1.8} />
                          {volume.toLocaleString()} kg
                        </span>
                      )}
                    </div>

                    {visibleMuscles.length > 0 && (
                      <div className="calendar-session-card__chips">
                        {visibleMuscles.map((m) => (
                          <span className="calendar-muscle-chip" key={m}>{m}</span>
                        ))}
                        {hiddenMuscleCount > 0 && (
                          <span className="calendar-muscle-chip calendar-muscle-chip--more">
                            +{hiddenMuscleCount}
                          </span>
                        )}
                      </div>
                    )}
                  </button>

                  <div
                    className={`calendar-session-body ${
                      isExpanded ? "calendar-session-body--expanded" : ""
                    }`}
                  >
                    <div className="calendar-session-body__inner">
                      <div className="calendar-session-body__header">
                        <span className="calendar-session-body__header-label">
                          Session Details
                        </span>
                        <button
                          type="button"
                          className="calendar-delete-session-btn"
                          onClick={() => handleDeleteSession(session)}
                          disabled={isDeletingSession}
                        >
                          {isDeletingSession ? (
                            <Loader2
                              size={13}
                              strokeWidth={2}
                              className="calendar-delete-btn__spinner"
                            />
                          ) : (
                            <>
                              <Trash2 size={13} strokeWidth={1.8} />
                              Delete Session
                            </>
                          )}
                        </button>
                      </div>

                      <div className="calendar-session-exercises">
                        {session.workouts.map((w) => {
                          const isCardio = isCardioEntry(w);

                          return (
                            <div className="calendar-session-exercise" key={w._id}>
                              <div className="calendar-session-exercise__main">
                                <span className="calendar-session-exercise__name">
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
                              </div>
                              <div className="calendar-session-exercise__sets">
                                {isCardio
                                  ? formatCardioSummary(w)
                                      .map((m) => m.text)
                                      .join(", ")
                                  : formatSetBreakdown(w)}
                              </div>
                              {!isCardio && (
                                <div className="calendar-session-exercise__meta">
                                  <span>{getSetCount(w)} sets</span>
                                  <span>
                                    {getWorkoutVolume(w).toLocaleString()} kg
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedDate && selectedSessions.length > 0 && (
            <div className="calendar-day-summary">
              <div className="calendar-day-summary__item">
                <span className="calendar-day-summary__value">{selectedSessions.length}</span>
                <span className="calendar-day-summary__label">
                  Workout{selectedSessions.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="calendar-day-summary__item">
                <span className="calendar-day-summary__value">
                  {selectedSessions.reduce(
                    (sum, s) => sum + s.stats.exerciseCount + s.stats.cardioCount,
                    0
                  )}
                </span>
                <span className="calendar-day-summary__label">Exercises</span>
              </div>
              <div className="calendar-day-summary__item">
                <span className="calendar-day-summary__value">
                  {selectedSessions
                    .reduce((sum, s) => sum + (s.stats.volume || 0), 0)
                    .toLocaleString()}
                </span>
                <span className="calendar-day-summary__label">kg Lifted</span>
              </div>
              <div className="calendar-day-summary__item">
                <span className="calendar-day-summary__value">
                  {recordEvents.filter((ev) => getLocalDateKey(ev.date) === selectedDate).length}
                </span>
                <span className="calendar-day-summary__label">PRs</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function formatLongDate(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// Hover-only quick glance at a day's sessions — no click required. Shown
// beside whichever cell is currently hovered, positioned via the same
// wrap-relative x/y technique MuscleBodyMap uses for its own tooltip.
function CalendarHoverPreview({ sessions, isPrDay, pos }) {
  const totalExercises = sessions.reduce(
    (sum, s) => sum + s.stats.exerciseCount + s.stats.cardioCount,
    0
  );
  const totalVolume = sessions.reduce((sum, s) => sum + (s.stats.volume || 0), 0);
  const types = [...new Set(sessions.map((s) => getSessionTypeLabel(s)))];

  return (
    <div className="calendar-hover-preview" style={{ left: pos.x, top: pos.y }}>
      <span className="calendar-hover-preview__title">{types.join(" + ")}</span>
      <span className="calendar-hover-preview__row">
        <Dumbbell size={11} strokeWidth={2} />
        {totalExercises} exercise{totalExercises !== 1 ? "s" : ""}
      </span>
      {totalVolume > 0 && (
        <span className="calendar-hover-preview__row">
          <Flame size={11} strokeWidth={2} />
          {totalVolume.toLocaleString()} kg
        </span>
      )}
      {isPrDay && (
        <span className="calendar-hover-preview__row calendar-hover-preview__row--pr">
          <Star size={11} strokeWidth={2} fill="currentColor" />
          New PR
        </span>
      )}
    </div>
  );
}

export default CalendarPage;