import "./calendar.css";
import { useEffect, useState, useMemo, useRef } from "react";
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
import { getMuscleRecoveryScores } from "../intelligence/recoveryEngine";
import { MUSCLES, MUSCLE_SPLIT_CATEGORY } from "../constants/muscles";
import ConfidenceBadge from "../components/ConfidenceBadge";

// Phase 14B, section 7 — maps a plan's workoutType to the muscles it
// trains, reusing the SAME Push/Pull/Legs/Core categorization
// MUSCLE_SPLIT_CATEGORY already establishes (no second taxonomy). Only
// covers workoutType values that have a real muscle-group meaning;
// "Cardio"/"Other" are deliberately absent — there's no muscle-recovery
// signal to check either against.
const WORKOUT_TYPE_MUSCLES = {
  Push: MUSCLES.filter((m) => MUSCLE_SPLIT_CATEGORY[m] === "Push"),
  Pull: MUSCLES.filter((m) => MUSCLE_SPLIT_CATEGORY[m] === "Pull"),
  Legs: MUSCLES.filter((m) => MUSCLE_SPLIT_CATEGORY[m] === "Legs"),
  Upper: MUSCLES.filter((m) => ["Push", "Pull"].includes(MUSCLE_SPLIT_CATEGORY[m])),
  Lower: MUSCLES.filter((m) => MUSCLE_SPLIT_CATEGORY[m] === "Legs"),
  "Full Body": MUSCLES,
};

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  // Phase 13B — Workout Planner state. plannedWorkouts is fetched
  // alongside completed workouts (same "fetch everything for this user,
  // bucket by day client-side" shape dashboard/calendar-workouts already
  // established — see plannedByDateKey below).
  const [plannedWorkouts, setPlannedWorkouts] = useState([]);
  const [plannerModal, setPlannerModal] = useState(null); // { mode: "create"|"edit", initialDateKey, editingPlan }
  const [actionBusyId, setActionBusyId] = useState(null);
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
    }
  };

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
    fetchPlannedWorkouts();
  }, []);

  // Deep linking (section 12): Notifications -> Calendar -> planned
  // workout. Applied once — after that, the user's own clicks own
  // selectedDate/viewMonth/viewYear, same "runs exactly once" contract
  // the existing auto-select effect below already follows.
  useEffect(() => {
    if (hasAppliedDeepLink.current) return;
    const dateParam = searchParams.get("date");
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return;
    hasAppliedDeepLink.current = true;
    hasAutoSelected.current = true; // pre-empt the "auto-select today" effect below

    const [y, m] = dateParam.split("-").map(Number);
    setViewYear(y);
    setViewMonth(m - 1);
    setSelectedDate(dateParam);
  }, [searchParams]);

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

  // Phase 13B — every planned workout bucketed by its scheduled day,
  // same shape sessionsByDateKey above already uses for completed
  // sessions. Includes every status (Planned/Completed/Missed/
  // Cancelled) — callers filter by status as needed rather than this
  // memo pre-deciding what's relevant.
  const plannedByDateKey = useMemo(() => {
    const map = new Map();
    plannedWorkouts.forEach((p) => {
      const key = getLocalDateKey(p.scheduledDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    });
    return map;
  }, [plannedWorkouts]);

  // Phase 13C, section 14 — "Calendar highlights reminder-related
  // planned workouts": reuses the exact same generators the Notification
  // Center reads from (reminders/workoutReminders.js,
  // reminders/plannerReminders.js) rather than re-deriving "is this plan
  // worth flagging" here. Any plan referenced by ANY generated reminder
  // (today/starting soon/overdue/missed/reschedule warning/overlap)
  // gets the badge — the badge doesn't distinguish which reminder,
  // matching PlannedWorkoutCard's existing status badge for the "what"
  // and leaving the "why" to the Notification Center itself.
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

  // Phase 14B, section 7 — Planner confidence badge + conflict warning.
  // Reuses intelligence/recoveryEngine.js's per-muscle recovery scores
  // directly (called ONCE here, never re-derived per plan) to flag
  // upcoming PLANNED strength workouts whose target muscle(s) are still
  // recovering. A plan with no itemized exercises and a workoutType with
  // no muscle mapping (Cardio/Other) is simply absent from this map —
  // no confidence/conflict badge renders for it, rather than a guess.
  const planRecoveryByPlanId = useMemo(() => {
    const recoveryScores = getMuscleRecoveryScores(workouts);
    const byMuscle = new Map(recoveryScores.map((r) => [r.muscle, r]));
    const map = new Map();

    plannedWorkouts.forEach((plan) => {
      if (plan.status !== PLANNED_STATUS.PLANNED) return;

      const muscleSet = new Set();
      (plan.exercises || []).forEach((e) => {
        if (e.exercise?.muscleGroup) muscleSet.add(e.exercise.muscleGroup);
      });
      if (!muscleSet.size && WORKOUT_TYPE_MUSCLES[plan.workoutType]) {
        WORKOUT_TYPE_MUSCLES[plan.workoutType].forEach((m) => muscleSet.add(m));
      }
      if (!muscleSet.size) return;

      const muscleScores = Array.from(muscleSet)
        .map((m) => byMuscle.get(m))
        .filter(Boolean);
      if (!muscleScores.length) return;

      const worst = [...muscleScores].sort((a, b) => a.recoveryScore - b.recoveryScore)[0];
      const avgScore = Math.round(
        muscleScores.reduce((s, r) => s + r.recoveryScore, 0) / muscleScores.length
      );

      // User feedback ⭐1 — "standardize confidence everywhere" surfaced
      // that this badge was actually a READINESS read (how recovered is
      // this plan's muscle group, bucketed off the average score) wearing
      // the word "confidence" — a different concept from the standardized
      // data-confidence every intelligence engine now returns (how much
      // real history backs the number). Both are real and worth showing,
      // just as two separate badges: `readiness` keeps this exact avg-
      // score bucketing (renamed, not recomputed), and `confidence` is
      // the genuine per-muscle confidence field from getMuscleRecoveryScores
      // — the LOWEST among the muscles involved, a conservative aggregate
      // (the read is only as trustworthy as its least-confident input).
      const CONFIDENCE_RANK = { Low: 0, Medium: 1, High: 2 };
      const leastConfident = muscleScores.reduce((worstConf, r) =>
        CONFIDENCE_RANK[r.confidence] < CONFIDENCE_RANK[worstConf.confidence] ? r : worstConf
      );

      map.set(plan._id, {
        readiness: avgScore >= 85 ? "High" : avgScore >= 50 ? "Medium" : "Low",
        confidence: leastConfident.confidence,
        confidenceReason: leastConfident.confidenceReason,
        conflict: worst.recoveryScore < 50 ? `${worst.muscle} still recovering — recommend rescheduling` : null,
      });
    });

    return map;
  }, [plannedWorkouts, workouts]);

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
  // String comparison is safe here — both sides are "YYYY-MM-DD" keys,
  // which sort identically to their underlying dates.
  const isSelectedDateInPast = selectedDate ? selectedDate < todayKey : false;
  const isSelectedDateToday = selectedDate === todayKey;

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

    // Cardio has no "volume" (kg) equivalent, so it gets its own rollup
    // pair (distance/duration) rather than being folded into `hours`,
    // which is sessionDuration-derived and already spans both entry
    // types. Summed straight off the raw cardio entries for this month
    // rather than session.stats (which only ever tracked strength
    // volume/setCount/muscles — see getSessionStats), so no existing
    // stat shape needs touching.
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

  // Phase 13B — Planner Analytics: stats about the planning process
  // itself (Planned this week / Completed / Missed / Rescheduled /
  // Completion rate / Current planning streak), computed purely from
  // plannedWorkouts via utils/plannedWorkoutAnalytics.js. Deliberately
  // separate from monthSummary above (workout analytics) — see that
  // module's header comment for why the two are never mixed.
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

  // Half of the preview's own CSS max-width (200px) — clamping the
  // anchor point keeps the centered tooltip from overflowing past the
  // grid's left/right edge on cells in the Sun/Sat columns, where a long
  // combined session-type title would otherwise get clipped or covered.
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

  // ------------------------------------------------------------------
  // Phase 13B — Planner actions. Every handler refetches the full
  // planned-workouts list on success rather than hand-patching local
  // state: reschedule/cancel/duplicate can all touch more than one
  // sibling document (an editScope="series" cancel, for instance), so a
  // single source of truth (a refetch) is simpler and safer than trying
  // to replicate the server's scoped-update logic client-side.
  // ------------------------------------------------------------------

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

  const handleReschedulePlan = async (plan) => {
    const input = window.prompt(
      `Reschedule "${plan.title}" to (YYYY-MM-DD):`,
      getLocalDateKey(plan.scheduledDate)
    );
    if (!input) return;
    setActionBusyId(plan._id);
    try {
      await reschedulePlannedWorkout(plan._id, { scheduledDate: input });
      await fetchPlannedWorkouts();
    } catch (error) {
      console.log(error);
      alert(error.response?.data?.message || "Failed to reschedule.");
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

  const handleDuplicatePlan = async (plan) => {
    const input = window.prompt(
      `Duplicate "${plan.title}" to (YYYY-MM-DD):`,
      getLocalDateKey(plan.scheduledDate)
    );
    if (!input) return;
    setActionBusyId(plan._id);
    try {
      await duplicatePlannedWorkout(plan._id, { scheduledDate: input });
      await fetchPlannedWorkouts();
    } catch (error) {
      console.log(error);
      alert(error.response?.data?.message || "Failed to duplicate.");
    } finally {
      setActionBusyId(null);
    }
  };

  const handleCancelPlan = async (plan) => {
    const editScope =
      plan.recurrenceGroupId &&
      window.confirm("This is part of a recurring series. Cancel the ENTIRE series?\n\nOK = entire series, Cancel = just this one")
        ? "series"
        : "only";
    if (!window.confirm(`Cancel "${plan.title}"?`)) return;
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

  const handleDeletePlan = async (plan) => {
    if (!window.confirm(`Permanently delete "${plan.title}"? This cannot be undone.`)) return;
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
              <span className="planner-analytics__label">Planner Analytics</span>
              <div className="planner-analytics__chips">
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

                  // One accent bar per day, split into equal segments when
                  // more than one distinct session type occurred that day
                  // (e.g. a Push session + a separate Cardio session) —
                  // previously this silently showed only daySessions[0]'s
                  // color, so a mixed day looked identical to a single-type
                  // day. Full per-type detail still lives in the hover
                  // preview; this is just "how many kinds of day was it".
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

                  // Phase 13B — planned-workout indicator, visually
                  // distinct from the completed-session dot/accent above
                  // (section 7: outlined for Planned, warning-outline for
                  // Missed — Cancelled/Completed plans don't need their
                  // own cell marker; a completed one already shows via
                  // the real logged session, and a cancelled one simply
                  // has nothing to flag on the grid).
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

          {/* Phase 13B — planned workouts for this day render first,
              above any completed sessions: a day can have both (a plan
              that's now Completed alongside its real logged session, or
              a Missed plan sitting next to an unrelated session). */}
          {selectedDate && selectedPlans.length > 0 && (
            <div className="planned-workout-list">
              {selectedPlans.map((plan) => (
                <PlannedWorkoutCard
                  key={plan._id}
                  plan={plan}
                  isToday={isSelectedDateToday}
                  busy={actionBusyId === plan._id}
                  hasReminder={reminderPlanIds.has(plan._id)}
                  intel={planRecoveryByPlanId.get(plan._id)}
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
              // Same rule as WorkoutHistory.jsx: a cardio-only session has
              // no meaningful Sets/Volume, so those stats are hidden
              // rather than showing "0 Sets" / "0 kg".
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

// Phase 13B — one planned workout, rendered in the day-details panel.
// Action set changes by status (section 9: Missed gets Reschedule/Mark
// Complete/Delete/Duplicate; an active Planned instance for TODAY gets
// the prominent "Start Planned Workout" action from section 8; any
// other Planned instance gets Edit/Reschedule/Cancel; Completed/
// Cancelled are read-only references).
function PlannedWorkoutCard({
  plan,
  isToday,
  busy,
  hasReminder,
  intel,
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
        {/* Phase 13C, section 14 — flags a plan the reminder engine has
            an active reminder for (workout today/starting soon/overdue,
            reschedule warning, overlap). See Calendar's reminderPlanIds
            memo for the shared generator call this reads from. */}
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
        {/* Phase 14B, section 7 — readiness badge: how recovered this
            plan's target muscle(s) are right now, per
            intelligence/recoveryEngine.js. Absent for cardio plans/plans
            with no muscle data to check (see Calendar's
            planRecoveryByPlanId memo). */}
        {intel && (
          <span
            className={`planned-workout-card__readiness planned-workout-card__readiness--${intel.readiness.toLowerCase()}`}
          >
            {intel.readiness} readiness
          </span>
        )}
      </div>
      {/* User feedback ⭐1 — standardized data-confidence (distinct from
          the readiness badge above): how much real recovery history
          backs that read, reusing the SAME ConfidenceBadge every other
          intelligence surface uses. */}
      {intel && (
        <ConfidenceBadge level={intel.confidence} reason={intel.confidenceReason} label="Recovery estimate" />
      )}

      <p className="planned-workout-card__title">{plan.title}</p>
      <p className="planned-workout-card__meta">
        {plan.scheduledTime ? `${plan.scheduledTime} · ` : ""}
        {plan.workoutType}
        {plan.cardioActivityType ? ` (${plan.cardioActivityType})` : ""}
        {plan.estimatedDuration ? ` · ${plan.estimatedDuration} min` : ""}
        {plan.exercises?.length ? ` · ${plan.exercises.length} exercises` : ""}
      </p>
      {plan.notes && <p className="planned-workout-card__notes">{plan.notes}</p>}
      {intel?.conflict && (
        <p className="planned-workout-card__conflict">
          <AlertTriangle size={12} strokeWidth={2} />
          {intel.conflict}
        </p>
      )}

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

// Hover-only quick glance at a day's sessions — no click required. Shown
// beside whichever cell is currently hovered, positioned via the same
// wrap-relative x/y technique MuscleBodyMap uses for its own tooltip.
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
      {/* Phase 13B — section 7: hover preview shows scheduled time,
          workout type, estimated duration, and priority for a planned
          day. Rendered below any completed-session info, one line per
          plan (usually just one). */}
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