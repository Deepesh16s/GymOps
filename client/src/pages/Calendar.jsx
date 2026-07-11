import "./calendar.css";
import { useEffect, useState, useMemo } from "react";
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
  Trash2,
  Loader2,
} from "lucide-react";
import { getSessionTypeColor } from "../constants/sessionTypes";
import {
  buildSessionSummaries,
  getWorkoutVolume,
  getSetCount,
  formatSetBreakdown,
  getSessionTypeLabel,
} from "../utils/workoutUtils";

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

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    setViewMonth(today.getMonth());
    setViewYear(today.getFullYear());
    setSelectedDate(todayKey);
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
    const exerciseCount = session.workouts.length;
    const confirmed = window.confirm(
      `Delete this entire ${label}? This will remove all ${exerciseCount} exercise${
        exerciseCount !== 1 ? "s" : ""
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
                Today
              </button>
            </div>
          </div>

          {loading ? (
            <div className="calendar-grid">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="calendar-cell go-skeleton" />
              ))}
            </div>
          ) : (
            <div className="calendar-grid">
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
                const sessionCount = sessionCountsByDate.get(dateKey) || 0;
                const hasWorkout = sessionCount > 0;
                const isToday = dateKey === todayKey;
                const isSelected = dateKey === selectedDate;

                return (
                  <button
                    type="button"
                    key={index}
                    className={[
                      "calendar-cell",
                      hasWorkout ? "workout-day" : "",
                      isToday ? "is-today" : "",
                      isSelected ? "is-selected" : "",
                    ].join(" ").trim()}
                    onClick={() => setSelectedDate(dateKey)}
                  >
                    <span className="calendar-cell-day">{day}</span>
                    {hasWorkout && sessionCount === 1 && (
                      <div className="calendar-dot" />
                    )}
                    {hasWorkout && sessionCount > 1 && (
                      <span className="calendar-session-count-badge">
                        {sessionCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="calendar-details-card go-card">
          <div className="calendar-details-header">
            <CalendarDays size={16} strokeWidth={1.8} />
            <h2>{selectedDate ? formatLongDate(selectedDate) : "Select a day"}</h2>
          </div>

          {!selectedDate && (
            <div className="go-empty">
              <div className="go-empty-icon">
                <CalendarDays size={20} strokeWidth={1.8} />
              </div>
              <p className="go-empty-title">No date selected</p>
              <p className="go-empty-sub">
                Tap any day on the calendar to see what you trained.
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

          <div className="calendar-session-list">
            {selectedSessions.map((session) => {
              const isExpanded = expandedKeys.has(session.key);
              const { exerciseCount, setCount, volume, muscles } = session.stats;
              const visibleMuscles = muscles.slice(0, MAX_VISIBLE_MUSCLE_CHIPS);
              const hiddenMuscleCount = muscles.length - visibleMuscles.length;
              const hasDuration =
                session.sessionDuration != null && session.sessionDuration > 0;
              const typeLabel = getSessionTypeLabel(session);
              const typeColor = getSessionTypeColor(session.sessionType);
              const isDeletingSession = deletingSessionKey === session.key;

              return (
                <div className="calendar-session-card" key={session.key}>
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
                        {exerciseCount} Exercise{exerciseCount !== 1 ? "s" : ""}
                      </span>
                      <span className="calendar-session-stat">
                        <Layers size={12} strokeWidth={1.8} />
                        {setCount} Set{setCount !== 1 ? "s" : ""}
                      </span>
                      <span className="calendar-session-stat">
                        <Flame size={12} strokeWidth={1.8} />
                        {volume.toLocaleString()} kg
                      </span>
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
                        {session.workouts.map((w) => (
                          <div className="calendar-session-exercise" key={w._id}>
                            <div className="calendar-session-exercise__main">
                              <span className="calendar-session-exercise__name">
                                {w.exercise?.name || "Unknown exercise"}
                              </span>
                            </div>
                            <div className="calendar-session-exercise__sets">
                              {formatSetBreakdown(w)}
                            </div>
                            <div className="calendar-session-exercise__meta">
                              <span>{getSetCount(w)} sets</span>
                              <span>
                                {getWorkoutVolume(w).toLocaleString()} kg
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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

export default CalendarPage;