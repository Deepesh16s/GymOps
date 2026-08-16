import "./calendar.css";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  Plus,
  Play,
  CalendarClock,
  Copy,
  CheckCircle2,
  Ban,
  Repeat,
  Bell,
  AlertTriangle,
} from "lucide-react";
import { getSessionTypeColor } from "../constants/sessionTypes";
import { prHistory } from "../utils/strengthUtils";
import { formatDurationLong, formatClockTime } from "../utils/timeFormat";
import {
  buildSessionSummaries,
  getWorkoutVolume,
  getSetCount,
  formatSetBreakdown,
  isCardioEntry,
  getCardioActivityLabel,
  formatCardioSummary,
  formatSessionEntryCountLabel,
  getSessionTypeLabel,
} from "../utils/workoutUtils";
import {
  getPlannedWorkouts,
  reschedulePlannedWorkout,
  markPlannedWorkoutComplete,
  duplicatePlannedWorkout,
  cancelPlannedWorkout,
  deletePlannedWorkout,
} from "../services/plannedWorkoutService";
import {
  PLANNED_STATUS,
  BUILT_IN_TEMPLATES,
  STATUS_BADGE_CLASS,
  RECURRENCE_TYPE_OPTIONS,
} from "../constants/plannedWorkoutTypes";

const RECURRENCE_LABEL_BY_TYPE = Object.fromEntries(
  RECURRENCE_TYPE_OPTIONS.map((opt) => [opt.value, opt.label])
);
import PlannedWorkoutModal from "../components/PlannedWorkoutModal";
import { getPlannerAnalytics } from "../utils/plannedWorkoutAnalytics";
import { generateWorkoutReminders } from "../reminders/workoutReminders";
import { generatePlannerReminders } from "../reminders/plannerReminders";
import LoadErrorBanner from "../components/LoadErrorBanner";
import ConfirmDialog from "../components/ConfirmDialog";
import useModalEscapeAndFocus from "../hooks/useModalEscapeAndFocus";

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [actionError, setActionError] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());
  const [deletingSessionKey, setDeletingSessionKey] = useState(null);
  const [hoveredDateKey, setHoveredDateKey] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [navDirection, setNavDirection] = useState("next");
  const hasAutoSelected = useRef(false);
  const gridWrapRef = useRef(null);

  const [plannedWorkouts, setPlannedWorkouts] = useState([]);
  const [plannerModal, setPlannerModal] = useState(null);
  const [actionBusyId, setActionBusyId] = useState(null);
  const [plannerStatsOpen, setPlannerStatsOpen] = useState(false);
  const hasAppliedDeepLink = useRef(false);

  const today = new Date();

  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const fetchPlannedWorkouts = async () => {
    try {
      const res = await getPlannedWorkouts();
      setPlannedWorkouts(res.data);
    } catch (error) {
      console.log(error);
      setLoadError(true);
    }
  };

  useEffect(() => {
    const fetchWorkouts = async () => {
      try {
        const res = await api.get("/dashboard/calendar-workouts");
        setWorkouts(res.data);
      } catch (error) {
        console.log(error);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };

    setLoadError(false);
    fetchWorkouts();
    fetchPlannedWorkouts();
  }, [retryTrigger]);

  useEffect(() => {
    if (hasAppliedDeepLink.current) return;
    const dateParam = searchParams.get("date");
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return;
    hasAppliedDeepLink.current = true;
    hasAutoSelected.current = true;

    const [y, m] = dateParam.split("-").map(Number);
    setViewYear(y);
    setViewMonth(m - 1);
    setSelectedDate(dateParam);
  }, [searchParams]);

  const allSessions = useMemo(() => buildSessionSummaries(workouts), [workouts]);

  const recordEvents = useMemo(() => prHistory(workouts), [workouts]);
  const prDateKeys = useMemo(
    () => new Set(recordEvents.map((ev) => getLocalDateKey(ev.date))),
    [recordEvents]
  );

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

  const maxDayVolume = useMemo(() => {
    let max = 0;
    volumeByDateKey.forEach((v) => { if (v > max) max = v; });
    return max;
  }, [volumeByDateKey]);

  useEffect(() => {
    setExpandedKeys(new Set());
  }, [selectedDate]);

  const sessionCountsByDate = useMemo(() => {
    const counts = new Map();
    allSessions.forEach((s) => {
      const key = getLocalDateKey(s.date);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [allSessions]);

  const plannedByDateKey = useMemo(() => {
    const map = new Map();
    plannedWorkouts.forEach((p) => {
      const key = getLocalDateKey(p.scheduledDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    });
    return map;
  }, [plannedWorkouts]);

  const reminderPlanIds = useMemo(() => {
    const reminders = [
      ...generateWorkoutReminders(plannedWorkouts),
      ...generatePlannerReminders(plannedWorkouts),
    ];
    const ids = new Set();
    reminders.forEach((r) => {
      if (r.metadata?.plannedWorkoutId) ids.add(r.metadata.plannedWorkoutId);
      if (r.metadata?.plannedWorkoutIds) r.metadata.plannedWorkoutIds.forEach((id) => ids.add(id));
    });
    return ids;
  }, [plannedWorkouts]);


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

  const selectedPlans = selectedDate ? plannedByDateKey.get(selectedDate) || [] : [];
  const isSelectedDateInPast = selectedDate ? selectedDate < todayKey : false;
  const isSelectedDateToday = selectedDate === todayKey;

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

    let cardioDistance = 0;
    let cardioMinutes = 0;
    workouts.forEach((w) => {
      if (!isCardioEntry(w)) return;
      if (!getLocalDateKey(w.date || w.createdAt).startsWith(monthPrefix)) return;
      const distance = Number(w.cardio?.data?.distance);
      const duration = Number(w.cardio?.data?.duration);
      if (Number.isFinite(distance)) cardioDistance += distance;
      if (Number.isFinite(duration)) cardioMinutes += duration;
    });

    return {
      sessionCount,
      exerciseCount,
      prCount,
      hours: Math.round((minutes / 60) * 10) / 10,
      cardioDistance: Math.round(cardioDistance * 100) / 100,
      cardioMinutes: Math.round(cardioMinutes),
    };
  }, [sessionsByDateKey, recordEvents, workouts, viewMonth, viewYear]);

  const plannerAnalytics = useMemo(() => getPlannerAnalytics(plannedWorkouts), [plannedWorkouts]);

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

  const HOVER_PREVIEW_HALF_WIDTH = 100;

  const handleCellHover = (dateKey, e) => {
    const wrapBox = gridWrapRef.current?.getBoundingClientRect();
    const cellBox = e.currentTarget.getBoundingClientRect();
    if (!wrapBox) return;
    const rawX = cellBox.left - wrapBox.left + cellBox.width / 2;
    const clampedX = Math.min(
      Math.max(rawX, HOVER_PREVIEW_HALF_WIDTH),
      wrapBox.width - HOVER_PREVIEW_HALF_WIDTH
    );
    setHoverPos({
      x: clampedX,
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

  const [pendingAction, setPendingAction] = useState(null);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Compiler-transform preservation note only; this project doesn't use React Compiler.
  const handleCancelPendingAction = useCallback(() => setPendingAction(null), []);

  const handlePendingDateChange = (value) => {
    setPendingAction((prev) => (prev ? { ...prev, date: value } : prev));
  };

  const handleDeleteSession = (session) => {
    setPendingAction({ type: "deleteSession", session });
  };

  const runDeleteSession = async (session) => {
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


  const handleOpenCreatePlan = (dateKey, templatePrefill) => {
    setPlannerModal({ mode: "create", initialDateKey: dateKey, templatePrefill });
  };

  const handleOpenEditPlan = (plan) => {
    setPlannerModal({ mode: "edit", editingPlan: plan });
  };

  const handleClosePlannerModal = () => setPlannerModal(null);

  const handlePlannerSaved = () => {
    setPlannerModal(null);
    fetchPlannedWorkouts();
  };

  const handleStartPlannedWorkout = (plan) => {
    navigate(`/dashboard?startPlannedWorkoutId=${plan._id}`);
  };

  const handleReschedulePlan = (plan) => {
    setPendingAction({ type: "reschedulePlan", plan, date: getLocalDateKey(plan.scheduledDate) });
  };

  const runReschedule = async (plan, date) => {
    setActionBusyId(plan._id);
    setActionError("");
    try {
      await reschedulePlannedWorkout(plan._id, { scheduledDate: date });
      await fetchPlannedWorkouts();
    } catch (error) {
      console.log(error);
      setActionError(error.response?.data?.message || "Failed to reschedule.");
    } finally {
      setActionBusyId(null);
    }
  };

  const handleMarkPlanComplete = async (plan) => {
    setActionBusyId(plan._id);
    try {
      await markPlannedWorkoutComplete(plan._id);
      await fetchPlannedWorkouts();
    } catch (error) {
      console.log(error);
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDuplicatePlan = (plan) => {
    setPendingAction({ type: "duplicatePlan", plan, date: getLocalDateKey(plan.scheduledDate) });
  };

  const runDuplicate = async (plan, date) => {
    setActionBusyId(plan._id);
    setActionError("");
    try {
      await duplicatePlannedWorkout(plan._id, { scheduledDate: date });
      await fetchPlannedWorkouts();
    } catch (error) {
      console.log(error);
      setActionError(error.response?.data?.message || "Failed to duplicate.");
    } finally {
      setActionBusyId(null);
    }
  };

  const handleCancelPlan = (plan) => {
    setPendingAction({ type: "cancelPlan", plan });
  };

  const runCancelPlan = async (plan, editScope) => {
    setActionBusyId(plan._id);
    try {
      await cancelPlannedWorkout(plan._id, editScope);
      await fetchPlannedWorkouts();
    } catch (error) {
      console.log(error);
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDeletePlan = (plan) => {
    setPendingAction({ type: "deletePlan", plan });
  };

  const runDeletePlan = async (plan) => {
    setActionBusyId(plan._id);
    try {
      await deletePlannedWorkout(plan._id, "only");
      await fetchPlannedWorkouts();
    } catch (error) {
      console.log(error);
    } finally {
      setActionBusyId(null);
    }
  };

  const handleConfirmPendingAction = () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    if (action.type === "deleteSession") runDeleteSession(action.session);
    else if (action.type === "reschedulePlan") runReschedule(action.plan, action.date);
    else if (action.type === "duplicatePlan") runDuplicate(action.plan, action.date);
    else if (action.type === "deletePlan") runDeletePlan(action.plan);
    else if (action.type === "cancelPlan") runCancelPlan(action.plan, "only");
  };

  return (
    <div className="calendar-page">
      <main className="calendar-main">
        {loadError && (
          <LoadErrorBanner
            message="Couldn't load your calendar. Check your connection and try again."
            onRetry={() => setRetryTrigger((t) => t + 1)}
            className="calendar-load-error"
          />
        )}
        {actionError && (
          <LoadErrorBanner message={actionError} className="calendar-load-error" />
        )}

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
              {monthSummary.cardioDistance > 0 && (
                <div className="calendar-month-summary__chip">
                  <span className="calendar-month-summary__value">{monthSummary.cardioDistance} km</span>
                  <span className="calendar-month-summary__label">Cardio</span>
                </div>
              )}
              {monthSummary.cardioMinutes > 0 && (
                <div className="calendar-month-summary__chip">
                  <span className="calendar-month-summary__value">{monthSummary.cardioMinutes}m</span>
                  <span className="calendar-month-summary__label">Cardio Time</span>
                </div>
              )}
            </div>
          )}

          {!loading && plannedWorkouts.length > 0 && (
            <div className="planner-analytics">
              <button
                type="button"
                className="planner-analytics__toggle"
                onClick={() => setPlannerStatsOpen((v) => !v)}
                aria-expanded={plannerStatsOpen}
                aria-controls="planner-summary-panel"
              >
                Planner Summary
                <ChevronDown
                  size={14}
                  strokeWidth={2}
                  className={`planner-analytics__chevron ${plannerStatsOpen ? "planner-analytics__chevron--open" : ""}`}
                />
              </button>
              {plannerStatsOpen && (
                <div className="planner-analytics__chips" id="planner-summary-panel">
                  <div className="planner-analytics__chip">
                    <CalendarClock size={13} strokeWidth={2} />
                    <span className="planner-analytics__value">{plannerAnalytics.plannedThisWeek}</span>
                    <span className="planner-analytics__key">This Week</span>
                  </div>
                  <div className="planner-analytics__chip">
                    <CheckCircle2 size={13} strokeWidth={2} />
                    <span className="planner-analytics__value">{plannerAnalytics.completed}</span>
                    <span className="planner-analytics__key">Completed</span>
                  </div>
                  <div className="planner-analytics__chip planner-analytics__chip--warning">
                    <Ban size={13} strokeWidth={2} />
                    <span className="planner-analytics__value">{plannerAnalytics.missed}</span>
                    <span className="planner-analytics__key">Missed</span>
                  </div>
                  <div className="planner-analytics__chip">
                    <Repeat size={13} strokeWidth={2} />
                    <span className="planner-analytics__value">{plannerAnalytics.rescheduled}</span>
                    <span className="planner-analytics__key">Rescheduled</span>
                  </div>
                  {plannerAnalytics.completionRate != null && (
                    <div className="planner-analytics__chip">
                      <span className="planner-analytics__value">{plannerAnalytics.completionRate}%</span>
                      <span className="planner-analytics__key">Completion Rate</span>
                    </div>
                  )}
                  {plannerAnalytics.currentStreak > 0 && (
                    <div className="planner-analytics__chip planner-analytics__chip--streak">
                      <Flame size={13} strokeWidth={2} />
                      <span className="planner-analytics__value">{plannerAnalytics.currentStreak}</span>
                      <span className="planner-analytics__key">
                        Week{plannerAnalytics.currentStreak !== 1 ? "s" : ""} Streak
                      </span>
                    </div>
                  )}
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

                  const dayAccentColors = hasWorkout
                    ? [...new Set(daySessions.map((s) => s.sessionType || "default"))].map(
                        (t) => getSessionTypeColor(t).text
                      )
                    : [];
                  const accentBackground =
                    dayAccentColors.length > 1
                      ? `linear-gradient(90deg, ${dayAccentColors
                          .map((c, i) => {
                            const step = 100 / dayAccentColors.length;
                            return `${c} ${(i * step).toFixed(2)}%, ${c} ${((i + 1) * step).toFixed(2)}%`;
                          })
                          .join(", ")})`
                      : dayAccentColors[0] || null;

                  const dayPlans = (plannedByDateKey.get(dateKey) || []).filter(
                    (p) => p.status !== PLANNED_STATUS.CANCELLED
                  );
                  const hasMissedPlan = dayPlans.some((p) => p.status === PLANNED_STATUS.MISSED);
                  const hasActivePlan = dayPlans.some((p) => p.status === PLANNED_STATUS.PLANNED);
                  const planIndicator = hasMissedPlan ? "missed" : hasActivePlan ? "planned" : null;
                  const hasHoverContent = hasWorkout || dayPlans.length > 0;

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
                        isPrDay ? "is-pr-day" : "",
                        connectPrev ? "connect-prev" : "",
                        connectNext ? "connect-next" : "",
                      ].join(" ").trim()}
                      onClick={() => setSelectedDate(dateKey)}
                      onMouseEnter={(e) => hasHoverContent && handleCellHover(dateKey, e)}
                      onMouseLeave={() => setHoveredDateKey(null)}
                      aria-label={`${day}${hasWorkout ? ", workout logged" : ""}${
                        planIndicator === "missed"
                          ? ", workout missed"
                          : planIndicator === "planned"
                          ? ", workout planned"
                          : ""
                      }`}
                    >
                      {connectPrev && <span className="calendar-cell__connector calendar-cell__connector--prev" />}
                      {connectNext && <span className="calendar-cell__connector calendar-cell__connector--next" />}
                      <span className="calendar-cell-day">{day}</span>
                      {hasWorkout && sessionCount === 1 && (
                        <div className="calendar-dot" />
                      )}
                      {hasWorkout && sessionCount > 1 && (
                        <span className="calendar-session-count-badge">
                          {sessionCount}
                        </span>
                      )}
                      {planIndicator && (
                        <span
                          className={`calendar-plan-indicator calendar-plan-indicator--${planIndicator}`}
                          title={planIndicator === "missed" ? "Missed workout" : "Workout planned"}
                        />
                      )}
                      {accentBackground && (
                        <span
                          className="calendar-cell__accent"
                          style={{ background: accentBackground }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {hoveredDateKey &&
                ((sessionsByDateKey.get(hoveredDateKey) || []).length > 0 ||
                  (plannedByDateKey.get(hoveredDateKey) || []).length > 0) && (
                  <CalendarHoverPreview
                    sessions={sessionsByDateKey.get(hoveredDateKey)}
                    plans={(plannedByDateKey.get(hoveredDateKey) || []).filter(
                      (p) => p.status !== PLANNED_STATUS.CANCELLED
                    )}
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
            {selectedDate && !isSelectedDateInPast && (
              <button
                type="button"
                className="calendar-details-header__plan-btn"
                onClick={() => handleOpenCreatePlan(selectedDate, null)}
              >
                <Plus size={13} strokeWidth={2.2} />
                Plan workout
              </button>
            )}
          </div>

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
              <button type="button" className="go-empty-btn" onClick={() => navigate("/dashboard")}>
                Go to Dashboard
              </button>
            </div>
          )}

          {selectedDate && selectedPlans.length > 0 && (
            <div className="planned-workout-list">
              {selectedPlans.map((plan) => (
                <PlannedWorkoutCard
                  key={plan._id}
                  plan={plan}
                  isToday={isSelectedDateToday}
                  busy={actionBusyId === plan._id}
                  hasReminder={reminderPlanIds.has(plan._id)}
                  onStart={handleStartPlannedWorkout}
                  onEdit={handleOpenEditPlan}
                  onReschedule={handleReschedulePlan}
                  onMarkComplete={handleMarkPlanComplete}
                  onDuplicate={handleDuplicatePlan}
                  onCancel={handleCancelPlan}
                  onDelete={handleDeletePlan}
                />
              ))}
            </div>
          )}

          {selectedDate && selectedSessions.length === 0 && selectedPlans.length === 0 && (
            isSelectedDateInPast ? (
              <div className="go-empty">
                <div className="go-empty-icon">
                  <Flame size={20} strokeWidth={1.8} />
                </div>
                <p className="go-empty-title">Rest day</p>
                <p className="go-empty-sub">No workouts logged on this day.</p>
              </div>
            ) : (
              <div className="calendar-plan-prompt">
                <div className="go-empty-icon">
                  <Plus size={20} strokeWidth={1.8} />
                </div>
                <p className="go-empty-title">
                  {isSelectedDateToday ? "Nothing planned for today" : "Plan a workout"}
                </p>
                <p className="go-empty-sub">Quick templates, or build a custom plan.</p>
                <div className="calendar-plan-prompt__templates">
                  {BUILT_IN_TEMPLATES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      className="calendar-plan-prompt__template-btn"
                      onClick={() => handleOpenCreatePlan(selectedDate, t)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="calendar-plan-prompt__custom-btn"
                  onClick={() => handleOpenCreatePlan(selectedDate, null)}
                >
                  <Plus size={14} strokeWidth={2} />
                  Custom plan
                </button>
              </div>
            )
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
              const hasStrengthEntries = exerciseCount > 0;
              const typeLabel = getSessionTypeLabel(session);
              const typeColor = getSessionTypeColor(session.sessionType);
              const isDeletingSession = deletingSessionKey === session.key;
              const sessionTime = formatClockTime(session.date);
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
                          {formatDurationLong(session.sessionDuration)}
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
                                      {getCardioActivityLabel(w)}
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

      {plannerModal && (
        <PlannedWorkoutModal
          mode={plannerModal.mode}
          initialDateKey={plannerModal.initialDateKey}
          templatePrefill={plannerModal.templatePrefill}
          editingPlan={plannerModal.editingPlan}
          onClose={handleClosePlannerModal}
          onSaved={handlePlannerSaved}
        />
      )}

      <ConfirmDialog
        open={pendingAction?.type === "deleteSession"}
        title="Delete Session?"
        body={
          pendingAction?.type === "deleteSession"
            ? `Delete this entire ${getSessionTypeLabel(pendingAction.session)}? This will remove all ${
                pendingAction.session.workouts.length
              } entr${pendingAction.session.workouts.length !== 1 ? "ies" : "y"} in this session.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={handleConfirmPendingAction}
        onCancel={handleCancelPendingAction}
      />

      <ConfirmDialog
        open={pendingAction?.type === "deletePlan"}
        title="Delete Planned Workout?"
        body={pendingAction?.type === "deletePlan" ? `Permanently delete "${pendingAction.plan.title}"?` : ""}
        confirmLabel="Delete"
        onConfirm={handleConfirmPendingAction}
        onCancel={handleCancelPendingAction}
      />

      <ConfirmDialog
        open={pendingAction?.type === "reschedulePlan"}
        danger={false}
        icon={CalendarClock}
        title="Reschedule Workout"
        body={pendingAction?.type === "reschedulePlan" ? `Choose a new date for "${pendingAction.plan.title}".` : ""}
        confirmLabel="Reschedule"
        confirmDisabled={pendingAction?.type === "reschedulePlan" && !pendingAction.date}
        onConfirm={handleConfirmPendingAction}
        onCancel={handleCancelPendingAction}
      >
        {pendingAction?.type === "reschedulePlan" && (
          <input
            type="date"
            className="confirm-dialog-date-input"
            value={pendingAction.date}
            onChange={(e) => handlePendingDateChange(e.target.value)}
          />
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={pendingAction?.type === "duplicatePlan"}
        danger={false}
        icon={Copy}
        title="Duplicate Workout"
        body={pendingAction?.type === "duplicatePlan" ? `Choose a date to duplicate "${pendingAction.plan.title}" to.` : ""}
        confirmLabel="Duplicate"
        confirmDisabled={pendingAction?.type === "duplicatePlan" && !pendingAction.date}
        onConfirm={handleConfirmPendingAction}
        onCancel={handleCancelPendingAction}
      >
        {pendingAction?.type === "duplicatePlan" && (
          <input
            type="date"
            className="confirm-dialog-date-input"
            value={pendingAction.date}
            onChange={(e) => handlePendingDateChange(e.target.value)}
          />
        )}
      </ConfirmDialog>

      {pendingAction?.type === "cancelPlan" && pendingAction.plan.recurrenceGroupId ? (
        <CancelRecurringPlanDialog
          plan={pendingAction.plan}
          onCancelOccurrence={() => {
            const plan = pendingAction.plan;
            setPendingAction(null);
            runCancelPlan(plan, "only");
          }}
          onCancelSeries={() => {
            const plan = pendingAction.plan;
            setPendingAction(null);
            runCancelPlan(plan, "series");
          }}
          onDismiss={handleCancelPendingAction}
        />
      ) : (
        <ConfirmDialog
          open={pendingAction?.type === "cancelPlan"}
          title="Cancel Planned Workout?"
          body={pendingAction?.type === "cancelPlan" ? `Cancel "${pendingAction.plan.title}"?` : ""}
          confirmLabel="Cancel Workout"
          cancelLabel="Never Mind"
          onConfirm={handleConfirmPendingAction}
          onCancel={handleCancelPendingAction}
        />
      )}
    </div>
  );
}

function CancelRecurringPlanDialog({ plan, onCancelOccurrence, onCancelSeries, onDismiss }) {
  useModalEscapeAndFocus(true, onDismiss);

  return (
    <div className="confirm-dialog-overlay">
      <div
        className="confirm-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-recurring-dialog-title"
      >
        <div className="confirm-dialog-icon confirm-dialog-icon--danger">
          <AlertTriangle size={22} strokeWidth={1.8} />
        </div>
        <p className="confirm-dialog-title" id="cancel-recurring-dialog-title">Cancel "{plan.title}"?</p>
        <p className="confirm-dialog-body">This is part of a recurring series.</p>

        <div className="confirm-dialog-actions confirm-dialog-actions--stacked">
          <button type="button" className="confirm-dialog-btn confirm-dialog-btn--danger" onClick={onCancelOccurrence}>
            Cancel This Occurrence
          </button>
          <button type="button" className="confirm-dialog-btn confirm-dialog-btn--danger" onClick={onCancelSeries}>
            Cancel Entire Series
          </button>
          <button type="button" className="confirm-dialog-btn confirm-dialog-btn--cancel" onClick={onDismiss}>
            Never Mind
          </button>
        </div>
      </div>
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

function PlannedWorkoutCard({
  plan,
  isToday,
  busy,
  hasReminder,
  onStart,
  onEdit,
  onReschedule,
  onMarkComplete,
  onDuplicate,
  onCancel,
  onDelete,
}) {
  const isMissed = plan.status === PLANNED_STATUS.MISSED;
  const isCancelled = plan.status === PLANNED_STATUS.CANCELLED;
  const isCompleted = plan.status === PLANNED_STATUS.COMPLETED;
  const isActivePlan = plan.status === PLANNED_STATUS.PLANNED;

  return (
    <div
      className={`planned-workout-card planned-workout-card--${plan.status.toLowerCase()} ${
        busy ? "planned-workout-card--busy" : ""
      }`}
    >
      <div className="planned-workout-card__top">
        <span className={`planned-badge ${STATUS_BADGE_CLASS[plan.status]}`}>
          {plan.status}
        </span>
        {hasReminder && (
          <span
            className="planned-workout-card__reminder-tag"
            role="img"
            aria-label="Has an active reminder"
            title="Has an active reminder"
          >
            <Bell size={11} strokeWidth={2} />
          </span>
        )}
        {plan.recurrenceGroupId && (
          <span
            className="planned-workout-card__recurring-tag"
            title={`Recurring — ${RECURRENCE_LABEL_BY_TYPE[plan.recurrence?.type] || "series"}`}
          >
            <Repeat size={11} strokeWidth={2} />
            {RECURRENCE_LABEL_BY_TYPE[plan.recurrence?.type] || "Recurring"}
          </span>
        )}
        {plan.priority === "High" && (
          <span className="planned-workout-card__priority planned-workout-card__priority--high">High</span>
        )}
      </div>

      <p className="planned-workout-card__title">{plan.title}</p>
      <p className="planned-workout-card__meta">
        {plan.scheduledTime ? `${plan.scheduledTime} · ` : ""}
        {plan.workoutType}
        {plan.cardioActivityType ? ` (${plan.cardioActivityType})` : ""}
        {plan.estimatedDuration ? ` · ${plan.estimatedDuration} min` : ""}
        {plan.exercises?.length ? ` · ${plan.exercises.length} exercises` : ""}
      </p>
      {plan.notes && <p className="planned-workout-card__notes">{plan.notes}</p>}

      <div className="planned-workout-card__actions">
        {isActivePlan && isToday && (
          <button type="button" className="planned-workout-card__btn planned-workout-card__btn--primary" onClick={() => onStart(plan)}>
            <Play size={13} strokeWidth={2.2} />
            Start Planned Workout
          </button>
        )}
        {isActivePlan && (
          <>
            <button type="button" className="planned-workout-card__btn" onClick={() => onEdit(plan)} disabled={busy}>
              Edit
            </button>
            <button type="button" className="planned-workout-card__btn" onClick={() => onReschedule(plan)} disabled={busy}>
              <CalendarClock size={12} strokeWidth={2} />
              Reschedule
            </button>
            <button type="button" className="planned-workout-card__btn planned-workout-card__btn--danger" onClick={() => onCancel(plan)} disabled={busy}>
              <Ban size={12} strokeWidth={2} />
              Cancel
            </button>
          </>
        )}
        {isMissed && (
          <>
            <button type="button" className="planned-workout-card__btn" onClick={() => onReschedule(plan)} disabled={busy}>
              <CalendarClock size={12} strokeWidth={2} />
              Reschedule
            </button>
            <button type="button" className="planned-workout-card__btn" onClick={() => onMarkComplete(plan)} disabled={busy}>
              <CheckCircle2 size={12} strokeWidth={2} />
              Mark Complete
            </button>
            <button type="button" className="planned-workout-card__btn" onClick={() => onDuplicate(plan)} disabled={busy}>
              <Copy size={12} strokeWidth={2} />
              Duplicate
            </button>
            <button type="button" className="planned-workout-card__btn planned-workout-card__btn--danger" onClick={() => onDelete(plan)} disabled={busy}>
              <Trash2 size={12} strokeWidth={2} />
              Delete
            </button>
          </>
        )}
        {(isCompleted || isCancelled) && (
          <button type="button" className="planned-workout-card__btn" onClick={() => onDuplicate(plan)} disabled={busy}>
            <Copy size={12} strokeWidth={2} />
            Duplicate
          </button>
        )}
      </div>
    </div>
  );
}

function CalendarHoverPreview({ sessions = [], plans = [], isPrDay, pos }) {
  const totalExercises = sessions.reduce(
    (sum, s) => sum + s.stats.exerciseCount + s.stats.cardioCount,
    0
  );
  const totalVolume = sessions.reduce((sum, s) => sum + (s.stats.volume || 0), 0);
  const types = [...new Set(sessions.map((s) => getSessionTypeLabel(s)))];
  const hasCompleted = sessions.length > 0;

  return (
    <div className="calendar-hover-preview" style={{ left: pos.x, top: pos.y }}>
      {hasCompleted && (
        <>
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
        </>
      )}
      {plans.map((p) => (
        <div className="calendar-hover-preview__plan" key={p._id}>
          <span className="calendar-hover-preview__title calendar-hover-preview__title--plan">
            <CalendarClock size={11} strokeWidth={2} />
            {p.title}
            {p.status === PLANNED_STATUS.MISSED && (
              <span className="calendar-hover-preview__missed-tag">Missed</span>
            )}
          </span>
          <span className="calendar-hover-preview__row">
            {p.scheduledTime ? `${p.scheduledTime} · ` : ""}
            {p.workoutType}
            {p.estimatedDuration ? ` · ${p.estimatedDuration} min` : ""}
          </span>
          {p.priority && p.priority !== "Medium" && (
            <span className="calendar-hover-preview__row">{p.priority} priority</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default CalendarPage;