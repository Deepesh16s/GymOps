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
import { getDashboardSummaryData } from "../services/dashboardService";
import { getWorkouts } from "../services/workoutService";
import {
  buildSessionSummaries,
  sortSessions,
  formatSessionDate,
  getSessionTypeLabel,
  isCardioEntry,
  getCardioActivityName,
  formatCardioSummary,
  formatSetBreakdown,
  getSetCount,
  getWorkoutVolume,
} from "../utils/workoutUtils";
import { getSessionTypeColor } from "../constants/sessionTypes";

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Presentation-only: no new data fetched, just a friendlier read of the
// clock and the already-stored user name (same localStorage value
// ProfileDropdown already reads) instead of a static "Welcome back".
function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getFirstName() {
  try {
    const stored = JSON.parse(localStorage.getItem("user") || "null");
    return stored?.name?.trim().split(/\s+/)[0] || null;
  } catch {
    return null;
  }
}

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

// Last Session card. session is a buildSessionSummaries() entry — the
// same shape/data already fetched for Recent Sessions (recentSessions[0]
// is the latest one), reused here instead of the coarser
// /dashboard/session-summary aggregate so every exercise's actual sets
// (and every cardio entry's full metric breakdown) can be shown, not
// just exercise-name chips. No new request, no backend change — this
// is data the page already has.
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
      <div className="last-session-card last-session-card--empty dash-fade-in">
        <div className="empty-state__icon">
          <Dumbbell size={24} strokeWidth={1.6} />
        </div>
        <p>No sessions completed yet.</p>
      </div>
    );
  }

  const typeColor = getSessionTypeColor(session.sessionType);
  const label = getSessionTypeLabel(session);

  const strengthEntries = session.workouts.filter((w) => !isCardioEntry(w));
  const cardioEntries = session.workouts.filter((w) => isCardioEntry(w));

  const sessionTime = new Date(session.date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="last-session-card dash-fade-in">
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

      <div className="last-session-card__footer">
        {session.stats.exerciseCount > 0 && (
          <div className="last-session-card__stat">
            <span className="last-session-card__stat-label">Volume</span>
            <span className="last-session-card__stat-value">
              {session.stats.volume.toLocaleString()} kg
            </span>
          </div>
        )}
        {session.stats.muscles.length > 0 && (
          <div className="last-session-card__muscles">
            {session.stats.muscles.map((m) => (
              <span className="last-session-card__muscle-tag" key={m}>
                {m}
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          className="last-session-card__expand-btn"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide" : "View"} full details
          <ChevronDown
            size={14}
            strokeWidth={2}
            className={expanded ? "rotated" : ""}
          />
        </button>
      </div>

      {expanded && (
        <div className="last-session-card__detail-list">
          {strengthEntries.map((w) => (
            <div className="last-session-card__detail-item" key={w._id}>
              <div className="last-session-card__detail-item-head">
                <span className="last-session-card__detail-item-name">
                  <Dumbbell size={13} strokeWidth={1.8} />
                  {w.exercise?.name || "Unknown exercise"}
                </span>
                {w.exercise?.muscleGroup && (
                  <span className="last-session-card__detail-item-muscle">
                    {w.exercise.muscleGroup}
                  </span>
                )}
              </div>
              <p className="last-session-card__detail-item-sets">
                {formatSetBreakdown(w)}
              </p>
              <div className="last-session-card__detail-item-meta">
                <span>{getSetCount(w)} sets</span>
                <span>{getWorkoutVolume(w).toLocaleString()} kg</span>
              </div>
            </div>
          ))}

          {cardioEntries.map((w) => (
            <div className="last-session-card__detail-item" key={w._id}>
              <div className="last-session-card__detail-item-head">
                <span className="last-session-card__detail-item-name">
                  <HeartPulse size={13} strokeWidth={1.8} />
                  {getCardioActivityName(w)}
                </span>
              </div>
              <p className="last-session-card__detail-item-sets">
                {formatCardioSummary(w)
                  .map((m) => m.text)
                  .join(" · ")}
              </p>
            </div>
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

  // Raw workout documents (Muscle Body Map enhancement) — fetched once
  // alongside the rest of the dashboard data, so the map's Week/Month/
  // 90 Days/Lifetime toggle can be computed client-side (all 4 windows
  // derived from this same array) instead of firing a new backend
  // request per range switch.
  const [muscleWorkouts, setMuscleWorkouts] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [summaryData, workoutsRes] = await Promise.all([
        getDashboardSummaryData(),
        getWorkouts(500),
      ]);

      const [
        summary,
        streak,
        topExercise,
        topMuscle,
        records,
        weeklyVol,
        recentSessionsRes,
      ] = summaryData;

      setMuscleWorkouts(workoutsRes.data);

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
      // fetchDashboardData already refetches raw workouts, which is what
      // the muscle map derives its breakdown from — no separate refetch
      // needed.
      await fetchDashboardData();
    }
  };

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

  const firstName = getFirstName();

  // Contextual, data-driven sub-line instead of static copy — reads
  // stats already fetched above, no new requests or business logic.
  const heroSubtitle = loading
    ? "Loading your progress..."
    : stats.currentStreak > 0
    ? `You're on a ${stats.currentStreak}-day streak — keep the momentum going.`
    : "Ready to crush today's session?";

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
            <h1 className="hero-card__title">
              {getTimeGreeting()}
              {firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="hero-card__sub">{heroSubtitle}</p>
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
          <div
            className={`primary-grid${!loading ? " dash-fade-in" : ""}`}
            key={loading ? "primary-loading" : "primary-loaded"}
          >
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
          <LastSessionCard session={recentSessions[0] || null} loading={loading} />
        </section>

        <section className="section charts-row">
          <div className="chart-card chart-card--pie">
            <MuscleBodyMap
              workouts={muscleWorkouts}
              loading={loading}
              personalRecords={stats.personalRecords}
              onSelectMuscle={(muscle) =>
                navigate(`/progression?muscle=${encodeURIComponent(muscle)}`)
              }
            />
          </div>

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
                <defs>
                  <linearGradient id="dashVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--go-primary)" stopOpacity={1} />
                    <stop offset="100%" stopColor="var(--go-primary)" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
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
                <Bar
                  dataKey="volume"
                  fill="url(#dashVolumeGradient)"
                  radius={[6, 6, 0, 0]}
                  animationDuration={500}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="section">
          <p className="section__label">Breakdown</p>
          <div
            className={`secondary-grid${!loading ? " dash-fade-in" : ""}`}
            key={loading ? "secondary-loading" : "secondary-loaded"}
          >
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
              <div className="empty-state dash-fade-in">
                <div className="empty-state__icon">
                  <Dumbbell size={26} strokeWidth={1.6} />
                </div>
                <p>No sessions logged yet.</p>
                <button className="empty-btn" onClick={handleEmptyStateAddWorkout}>
                  Log your first workout
                </button>
              </div>
            ) : (
              <div className="activity-list dash-fade-in">
                {recentSessions.map((session) => (
                  <RecentSessionRow key={session.key} session={session} />
                ))}
              </div>
            )}
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