import "./dashboard.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dumbbell,
  Flame,
  Activity,
  CalendarDays,
  BarChart2,
  Zap,
  Trophy,
  CalendarRange,
  TrendingUp,
  Plus,
  ChevronRight,
  ChevronDown,
  Timer,
  HeartPulse,
  CheckCircle2,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import AddWorkoutModal from "../components/AddWorkoutModal";
import AddCardioModal from "../components/AddCardioModal";
import MuscleBodyMap from "../components/MuscleBodyMap";
import WorkoutSession from "../components/WorkoutSession";
import StartWorkoutModal from "../components/StartWorkoutModal";
import useWorkoutSession from "../hooks/useWorkoutSession";
import api from "../services/api";
import {
  buildSessionSummaries,
  sortSessions,
  formatSessionDate,
  getSessionTypeLabel,
  isCardioEntry,
  getCardioActivityName,
  formatCardioSummary,
} from "../utils/workoutUtils";
import { getSessionTypeColor } from "../constants/sessionTypes";

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const RANGE_OPTIONS = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function PrimaryCard({ title, value, sub, icon: Icon, accent, onClick }) {
  return (
    <div
      className={`primary-card ${accent ? "primary-card--accent" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="primary-card__icon">
        <Icon size={22} strokeWidth={1.8} />
      </div>
      <div className="primary-card__body">
        <span className="primary-card__label">{title}</span>
        <span className="primary-card__value">{value ?? <SkeletonVal />}</span>
        {sub && <span className="primary-card__sub">{sub}</span>}
      </div>
      <ChevronRight className="primary-card__arrow" size={16} />
    </div>
  );
}

function SecondaryCard({ title, value, sub, icon: Icon }) {
  return (
    <div className="secondary-card">
      <div className="secondary-card__head">
        <Icon size={16} strokeWidth={1.8} className="secondary-card__icon" />
        <span className="secondary-card__label">{title}</span>
      </div>
      <span className="secondary-card__value">{value ?? <SkeletonVal />}</span>
      {sub && <span className="secondary-card__sub">{sub}</span>}
    </div>
  );
}

function SkeletonVal() {
  return (
    <span
      className="skeleton"
      style={{ width: 64, height: 22, display: "inline-block", borderRadius: 6 }}
    />
  );
}

function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{label}</p>
      <p className="chart-tooltip__value">
        {Number(payload[0].value).toLocaleString()} kg
      </p>
    </div>
  );
}

// Phase 9 — Last Session card. Local to Dashboard.jsx (not extracted as
// a shared component yet, per architecture decision). Handles strength-
// only, cardio-only, and mixed sessions using the presentation-ready
// payload the backend already built (no recomputation here).
//
// NOTE: this component intentionally does NOT use the workoutUtils
// cardio helpers (isCardioEntry / getCardioActivityName /
// formatCardioSummary). Those helpers are typed against raw Workout
// documents (workout.entryType, workout.cardio.activityType,
// workout.cardio.data). This component instead consumes
// stats.lastSession, the backend's /dashboard/session-summary payload,
// whose shape (exercises, cardioActivities: [{activityType, data}],
// volume, muscleGroups, ...) is a different, backend-precomputed
// contract. Forcing reuse here would require building synthetic
// Workout-shaped wrapper objects purely to satisfy the helpers' input
// contract, which adds complexity without removing real duplication.
function LastSessionCard({ session, loading }) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="last-session-card">
        <span
          className="skeleton"
          style={{ width: "40%", height: 20, borderRadius: 6 }}
        />
        <span
          className="skeleton"
          style={{
            width: "100%",
            height: 60,
            borderRadius: 10,
            marginTop: 16,
            display: "block",
          }}
        />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="last-session-card last-session-card--empty">
        <Dumbbell size={26} strokeWidth={1.4} />
        <p>No sessions completed yet.</p>
      </div>
    );
  }

  const typeColor = getSessionTypeColor(session.sessionType);
  const label =
    session.sessionType === "Other"
      ? session.customSessionType || "Session"
      : session.sessionType || "Session";

  const hasStrength = session.exerciseCount > 0;
  const hasCardio = session.cardioCount > 0;

  const sessionTime = new Date(session.date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="last-session-card">
      <div className="last-session-card__top">
        <div className="last-session-card__title-row">
          <span
            className="last-session-card__badge"
            style={{ background: typeColor.bg, color: typeColor.text }}
          >
            {label}
          </span>
          <span className="last-session-card__date">
            {formatSessionDate(session.date)} · {sessionTime}
          </span>
        </div>
        {session.sessionDuration != null && (
          <span className="last-session-card__duration">
            <Timer size={14} strokeWidth={1.8} />
            {session.sessionDuration} min
          </span>
        )}
      </div>

      <div className="last-session-card__body">
        {hasStrength && (
          <div className="last-session-card__group">
            <p className="last-session-card__group-label">
              <Dumbbell size={13} strokeWidth={1.8} /> Strength
            </p>
            <div className="last-session-card__chips">
              {session.exercises.map((ex, i) => (
                <span
                  className="last-session-card__chip"
                  key={`${ex.name}-${i}`}
                >
                  {ex.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {hasCardio && (
          <div className="last-session-card__group">
            <p className="last-session-card__group-label">
              <HeartPulse size={13} strokeWidth={1.8} /> Cardio
            </p>
            <div className="last-session-card__chips">
              {session.cardioActivities.map((c, i) => (
                <span
                  className="last-session-card__chip last-session-card__chip--cardio"
                  key={`${c.activityType}-${i}`}
                >
                  {c.activityType}
                  {c.data?.duration ? ` · ${c.data.duration} min` : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="last-session-card__footer">
        {hasStrength && (
          <div className="last-session-card__stat">
            <span className="last-session-card__stat-label">Volume</span>
            <span className="last-session-card__stat-value">
              {session.volume.toLocaleString()} kg
            </span>
          </div>
        )}
        {session.muscleGroups.length > 0 && (
          <button
            className="last-session-card__expand-btn"
            onClick={() => setExpanded((v) => !v)}
          >
            {session.muscleGroups.length} muscle group
            {session.muscleGroups.length === 1 ? "" : "s"}
            <ChevronDown
              size={14}
              strokeWidth={2}
              className={expanded ? "rotated" : ""}
            />
          </button>
        )}
      </div>

      {expanded && session.muscleGroups.length > 0 && (
        <div className="last-session-card__muscles">
          {session.muscleGroups.map((m) => (
            <span className="last-session-card__muscle-tag" key={m}>
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Phase 9 — one Recent Sessions row. Reuses buildSessionSummaries'
// output shape and getSessionStats (already computed as session.stats)
// rather than recomputing volume/set-count/muscles itself.
//
// Phase 8A.1: session.workouts here are raw Workout documents (same
// shape consumed by WorkoutHistory.jsx / calendar.jsx), so cardio
// detection and formatting go through the centralized workoutUtils
// helpers instead of reimplementing them locally.
function RecentSessionRow({ session }) {
  const [expanded, setExpanded] = useState(false);
  const { stats } = session;
  const typeColor = getSessionTypeColor(session.sessionType);
  const label = getSessionTypeLabel(session);

  const strengthEntries = session.workouts.filter((w) => !isCardioEntry(w));
  const cardioEntries = session.workouts.filter((w) => isCardioEntry(w));

  return (
    <div className="recent-session-row">
      <div
        className="recent-session-row__main"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <span
          className="recent-session-row__badge"
          style={{ background: typeColor.bg, color: typeColor.text }}
        >
          {label}
        </span>

        <div className="recent-session-row__info">
          <p className="recent-session-row__meta">
            {session.sessionDuration != null &&
              `${session.sessionDuration} min · `}
            {strengthEntries.length > 0 &&
              `${strengthEntries.length} exercise${
                strengthEntries.length === 1 ? "" : "s"
              }`}
            {strengthEntries.length > 0 && cardioEntries.length > 0 && " · "}
            {cardioEntries.length > 0 &&
              `${cardioEntries.length} cardio activit${
                cardioEntries.length === 1 ? "y" : "ies"
              }`}
          </p>
          <p className="recent-session-row__time">
            Completed {timeAgo(session.date)}
          </p>
        </div>

        {stats.volume > 0 && (
          <span className="recent-session-row__volume">
            {stats.volume.toLocaleString()} kg
          </span>
        )}

        <ChevronDown
          size={16}
          strokeWidth={2}
          className={`recent-session-row__chevron ${expanded ? "rotated" : ""}`}
        />
      </div>

      {expanded && (
        <div className="recent-session-row__detail">
          {strengthEntries.map((w) => (
            <div className="recent-session-row__detail-item" key={w._id}>
              <Dumbbell size={13} strokeWidth={1.8} />
              <span>{w.exercise?.name}</span>
            </div>
          ))}
          {cardioEntries.map((w) => {
            const durationMetric = formatCardioSummary(w).find(
              (m) => m.key === "duration"
            );
            return (
              <div className="recent-session-row__detail-item" key={w._id}>
                <HeartPulse size={13} strokeWidth={1.8} />
                <span>
                  {getCardioActivityName(w)}
                  {durationMetric ? ` · ${durationMetric.text}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();

  const [showModal, setShowModal] = useState(false);
  const [showCardioModal, setShowCardioModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const workoutSession = useWorkoutSession();

  const [showStartModal, setShowStartModal] = useState(false);
  const [pendingAddModal, setPendingAddModal] = useState(false);

  const [stats, setStats] = useState({
    totalSessions: null,
    sessionsLast7Days: null,
    sessionsLast30Days: null,
    currentStreak: null,
    lastSession: null,
    averageVolumeRecent: null,
    averageSessionDuration: null,
    topExercise: "",
    topExerciseCount: 0,
    topMuscle: "",
    topMuscleCount: 0,
    personalRecords: {},
  });

  const [recentSessions, setRecentSessions] = useState([]);

  const [weeklyVolumeData, setWeeklyVolumeData] = useState([]);

  // Phase 9 Dashboard Refinement — default changed from "week" to
  // "month". Most training splits don't touch every muscle group within
  // a single week, so Week frequently reads as sparse/misleading right
  // after a rest day or split rotation. Month gives a more representative
  // first-load picture. The Week/Month/Year toggle itself is unchanged.
  const [muscleRange, setMuscleRange] = useState("month");
  const [muscleData, setMuscleData] = useState([]);
  const [muscleLoading, setMuscleLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    fetchMuscleDistribution(muscleRange);
  }, [muscleRange]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [
        summary,
        streak,
        topExercise,
        topMuscle,
        records,
        weeklyVol,
        recentSessionsRes,
      ] = await Promise.all([
        api.get("/dashboard/session-summary", config),
        api.get("/dashboard/current-streak", config),
        api.get("/dashboard/top-exercise", config),
        api.get("/dashboard/top-muscle", config),
        api.get("/dashboard/personal-records", config),
        api.get("/dashboard/weekly-volume", config),
        api.get("/dashboard/recent-sessions?limit=6", config),
      ]);

      setStats({
        totalSessions: summary.data.totalSessions,
        sessionsLast7Days: summary.data.sessionsLast7Days,
        sessionsLast30Days: summary.data.sessionsLast30Days,
        lastSession: summary.data.lastSession,
        averageVolumeRecent: Math.round(summary.data.averageVolumeRecent || 0),
        // Bug fix (Phase 9 follow-up): averageSessionDuration can be
        // `null` (no recent session has a recorded duration) or a real
        // number that may itself legitimately be 0. Coercing with
        // `|| 0` here would make those two cases indistinguishable by
        // the time they reach render — so we only round when a real
        // value exists, and pass null straight through otherwise.
        averageSessionDuration:
          summary.data.averageSessionDuration != null
            ? Math.round(summary.data.averageSessionDuration)
            : null,
        currentStreak: streak.data.currentStreak,
        topExercise: topExercise.data.exercise,
        topExerciseCount: topExercise.data.count,
        topMuscle: topMuscle.data.topMuscle,
        topMuscleCount: topMuscle.data.count,
        personalRecords: records.data,
      });

      // sortSessions is the existing Workout History ordering utility —
      // reused here rather than having the backend guess display order.
      setRecentSessions(
        sortSessions(buildSessionSummaries(recentSessionsRes.data), "newest")
      );

      const rawWeekly = weeklyVol.data;
      const sortedWeekly = DAY_ORDER.map((d) => {
        const found = rawWeekly.find((r) => r.day === d);
        return { day: d, volume: found ? found.volume : 0 };
      });
      setWeeklyVolumeData(sortedWeekly);
    } catch (err) {
      console.error("Dashboard Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMuscleDistribution = async (range) => {
    setMuscleLoading(true);
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const res = await api.get(
        `/dashboard/muscle-distribution?range=${range}`,
        config
      );

      const mapped = res.data.map((m) => ({
        name: m.muscle,
        value: m.sets,
      }));
      setMuscleData(mapped);
    } catch (err) {
      console.error("Muscle Distribution Error:", err);
    } finally {
      setMuscleLoading(false);
    }
  };

  const handleAddExercise = (payload) => {
    workoutSession.addExercise(payload);
    setShowModal(false);
  };

  const handleAddCardio = (payload) => {
    workoutSession.addCardioEntry(payload);
    setShowCardioModal(false);
  };

  const handleOpenStartModal = () => {
    if (workoutSession.active) return;
    setPendingAddModal(false);
    setShowStartModal(true);
  };

  const handleEmptyStateAddWorkout = () => {
    if (workoutSession.active) {
      setShowModal(true);
      return;
    }
    setPendingAddModal(true);
    setShowStartModal(true);
  };

  const handleStartModalClose = () => {
    setShowStartModal(false);
    setPendingAddModal(false);
  };

  const handleStartModalConfirm = (sessionType, customSessionType) => {
    workoutSession.startSession(sessionType, customSessionType);
    setShowStartModal(false);
    if (pendingAddModal) {
      setShowModal(true);
      setPendingAddModal(false);
    }
  };

  const handleFinishWorkout = async () => {
    const success = await workoutSession.finishWorkout();
    if (success) {
      setShowModal(false);
      await Promise.all([
        fetchDashboardData(),
        fetchMuscleDistribution(muscleRange),
      ]);
    }
  };

  const prEntries = Object.entries(stats.personalRecords);

  const barChartData =
    weeklyVolumeData.length > 0
      ? weeklyVolumeData
      : DAY_ORDER.map((d) => ({ day: d, volume: 0 }));

  const lastSessionVolumeValue = (() => {
    const ls = stats.lastSession;
    if (!ls) return "—";
    if (ls.exerciseCount > 0) return `${ls.volume.toLocaleString()} kg`;
    if (ls.cardioCount > 0) return ls.cardioActivities[0]?.activityType || "Cardio";
    return "—";
  })();

  const lastSessionVolumeSub = (() => {
    const ls = stats.lastSession;
    if (!ls) return null;
    if (ls.exerciseCount > 0 && ls.cardioCount > 0) {
      return `+${ls.cardioCount} Cardio Activit${ls.cardioCount === 1 ? "y" : "ies"}`;
    }
    if (ls.exerciseCount === 0 && ls.cardioCount > 0) {
      return ls.sessionDuration != null ? `${ls.sessionDuration} min` : null;
    }
    return "Previous Session";
  })();

  // Bug fix (Phase 9 follow-up): previously checked `> 0`, which treated
  // a genuinely-computed average of 0 minutes the same as "no data" and
  // always rendered "—" for it. Now only `null` (true absence of any
  // recorded duration among the last 5 sessions) falls back to "—" — a
  // real average, including 0, is displayed as-is.
  const avgSessionDurationValue =
    stats.averageSessionDuration != null
      ? `${stats.averageSessionDuration} min`
      : "—";

  return (
    <div className="dash-page">
      <div className="dash-bg" aria-hidden="true">
        <div className="orb orb--1" />
        <div className="orb orb--2" />
        <div className="orb orb--3" />
      </div>

      <main className="dash-main">
        <section className="hero-card">
          <div className="hero-card__left">
            <span className="hero-card__eyebrow">
              <span className="hero-card__dot" />
              Live dashboard
            </span>
            <h1 className="hero-card__title">Welcome back</h1>
            <p className="hero-card__sub">
              Track your progress and crush your fitness goals.
            </p>
          </div>
          <div className="hero-card__right">
            <div className="hero-streak">
              <Flame size={18} strokeWidth={1.8} />
              <span>
                {stats.currentStreak !== null
                  ? `${stats.currentStreak} day streak`
                  : "—"}
              </span>
            </div>
            <button
              className="cta-btn"
              onClick={handleOpenStartModal}
              disabled={workoutSession.active || workoutSession.isSaving}
            >
              <Plus size={16} strokeWidth={2.5} />
              New Workout
            </button>
          </div>
        </section>

        {!workoutSession.active && workoutSession.saveSuccess && (
          <div className="save-success-banner" role="status">
            <CheckCircle2 size={18} strokeWidth={2} />
            <span>{workoutSession.saveSuccess}</span>
            <button
              type="button"
              className="save-success-banner__close"
              onClick={workoutSession.clearSaveSuccess}
              aria-label="Dismiss"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        )}

        {workoutSession.active && (
          <WorkoutSession
            startTime={workoutSession.startTime}
            entryCount={workoutSession.entries.length}
            entries={workoutSession.entries}
            onAddExercise={() => setShowModal(true)}
            onAddCardio={() => setShowCardioModal(true)}
            onDiscard={() => workoutSession.discardSession()}
            onRemoveEntry={workoutSession.removeEntry}
            onAddSet={workoutSession.addSet}
            onDeleteSet={workoutSession.deleteSet}
            onUpdateSet={workoutSession.updateSet}
            onFinishWorkout={handleFinishWorkout}
            isSaving={workoutSession.isSaving}
            saveError={workoutSession.saveError}
          />
        )}

        <section className="section">
          <p className="section__label">Overview</p>
          <div className="primary-grid">
            <PrimaryCard
              title="Total Sessions"
              value={loading ? null : stats.totalSessions}
              icon={Dumbbell}
              accent
              onClick={() => navigate("/workouts")}
            />
            <PrimaryCard
              title="Last Session Volume"
              value={loading ? null : lastSessionVolumeValue}
              sub={loading ? null : lastSessionVolumeSub}
              icon={Flame}
              onClick={() => navigate("/analytics")}
            />
            <PrimaryCard
              title="Sessions Logged"
              value={loading ? null : `${stats.sessionsLast7Days} (7d)`}
              icon={Activity}
              onClick={() => navigate("/workouts")}
            />
            <PrimaryCard
              title="Current Streak"
              value={loading ? null : `${stats.currentStreak}d`}
              icon={CalendarDays}
              onClick={() => navigate("/calendar")}
            />
          </div>
        </section>

        <section className="section">
          <p className="section__label">Last Session</p>
          <LastSessionCard session={stats.lastSession} loading={loading} />
        </section>

        <section className="section charts-row">
          <div className="chart-card chart-card--bar">
            <div className="chart-card__head">
              <div>
                <p className="chart-card__title">Weekly Volume</p>
                <p className="chart-card__sub">Total weight lifted per day (kg)</p>
              </div>
              <span className="chart-badge">
                <TrendingUp size={14} strokeWidth={2} /> This week
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={barChartData}
                barSize={26}
                margin={{ top: 8, right: 0, left: -20, bottom: 0 }}
              >
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: "var(--go-text-faint)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--go-text-faint)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<CustomBarTooltip />}
                  cursor={{ fill: "var(--go-primary-50)" }}
                />
                <Bar dataKey="volume" fill="var(--go-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card chart-card--pie">
            <div className="chart-card__head">
              <div>
                <p className="chart-card__title">Muscle Split</p>
                <p className="chart-card__sub">Sets distribution by muscle group</p>
              </div>
              <div className="range-toggle">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    className={`range-toggle__btn ${
                      muscleRange === opt.key ? "range-toggle__btn--active" : ""
                    }`}
                    onClick={() => setMuscleRange(opt.key)}
                    disabled={muscleLoading && muscleRange === opt.key}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <MuscleBodyMap
              muscleData={muscleData}
              loading={muscleLoading}
              rangeLabel={RANGE_OPTIONS.find((o) => o.key === muscleRange)?.label}
            />
          </div>
        </section>

        <section className="section">
          <p className="section__label">Breakdown</p>
          <div className="secondary-grid">
            <SecondaryCard
              title="Avg Volume (Last 5)"
              value={
                loading ? null : `${stats.averageVolumeRecent?.toLocaleString()} kg`
              }
              icon={BarChart2}
            />
            <SecondaryCard
              title="Avg Session Duration (Last 5)"
              value={loading ? null : avgSessionDurationValue}
              icon={Timer}
            />
            <SecondaryCard
              title="Top Muscle"
              value={loading ? null : stats.topMuscle || "—"}
              sub={stats.topMuscleCount ? `${stats.topMuscleCount} sets` : null}
              icon={Zap}
            />
            <SecondaryCard
              title="Top Exercise"
              value={loading ? null : stats.topExercise || "—"}
              sub={
                stats.topExerciseCount
                  ? `${stats.topExerciseCount}× performed`
                  : null
              }
              icon={Trophy}
            />
            <SecondaryCard
              title="Sessions (30d)"
              value={loading ? null : stats.sessionsLast30Days}
              icon={CalendarRange}
            />
          </div>
        </section>

        <section className="activity-row">
          <div className="activity-card activity-card--recent">
            <div className="activity-card__head">
              <p className="activity-card__title">Recent Sessions</p>
              <button className="view-all-btn" onClick={() => navigate("/workouts")}>
                View all <ChevronRight size={14} />
              </button>
            </div>

            {loading ? (
              <div className="activity-list">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="workout-row workout-row--skeleton">
                    <span
                      className="skeleton"
                      style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0 }}
                    />
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <span
                        className="skeleton"
                        style={{ width: "55%", height: 13, borderRadius: 5 }}
                      />
                      <span
                        className="skeleton"
                        style={{ width: "38%", height: 11, borderRadius: 5 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentSessions.length === 0 ? (
              <div className="empty-state">
                <Dumbbell size={28} strokeWidth={1.4} />
                <p>No sessions logged yet.</p>
                <button className="empty-btn" onClick={handleEmptyStateAddWorkout}>
                  Log your first workout
                </button>
              </div>
            ) : (
              <div className="activity-list">
                {recentSessions.map((session) => (
                  <RecentSessionRow key={session.key} session={session} />
                ))}
              </div>
            )}
          </div>

          <div className="activity-side">
            <div className="activity-card activity-card--pr">
              <div className="activity-card__head">
                <p className="activity-card__title">Personal Records</p>
                <Trophy size={16} strokeWidth={1.8} className="pr-trophy" />
              </div>
              {prEntries.length === 0 ? (
                <div className="empty-state">
                  <Trophy size={28} strokeWidth={1.4} />
                  <p>No PRs recorded yet.</p>
                </div>
              ) : (
                <div className="activity-list">
                  {prEntries.map(([exercise, weight]) => (
                    <div key={exercise} className="pr-row">
                      <p className="pr-row__name">{exercise}</p>
                      <span className="pr-row__badge">{weight} kg</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <StartWorkoutModal
        open={showStartModal}
        onClose={handleStartModalClose}
        onStart={handleStartModalConfirm}
      />

      {showModal && (
        <AddWorkoutModal
          closeModal={() => setShowModal(false)}
          onAddExercise={handleAddExercise}
        />
      )}

      {showCardioModal && (
        <AddCardioModal
          closeModal={() => setShowCardioModal(false)}
          onAddCardio={handleAddCardio}
        />
      )}
    </div>
  );
}

export default Dashboard;