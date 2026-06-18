import "./dashboard.css";
import { useState, useEffect } from "react";
import {
  Dumbbell,
  Flame,
  Activity,
  CalendarDays,
  BarChart2,
  Zap,
  Trophy,
  CalendarCheck,
  CalendarRange,
  TrendingUp,
  Plus,
  ChevronRight,
  Repeat2,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import Navbar from "../components/Navbar";
import AddWorkoutModal from "../components/AddWorkoutModal";
import api from "../services/api";

/* ─── colour tokens for Recharts ─── */
const EMERALD = "#10b981";
const PIE_COLORS = [
  "#10b981",
  "#34d399",
  "#6ee7b7",
  "#a7f3d0",
  "#059669",
  "#047857",
];

/* ─── Ordered days for the bar chart (Sun-first from backend, reordered Mon-first) ─── */
const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ─── Stat card variants ─── */
function PrimaryCard({ title, value, icon: Icon, accent }) {
  return (
    <div className={`primary-card ${accent ? "primary-card--accent" : ""}`}>
      <div className="primary-card__icon">
        <Icon size={22} strokeWidth={1.8} />
      </div>
      <div className="primary-card__body">
        <span className="primary-card__label">{title}</span>
        <span className="primary-card__value">{value ?? <SkeletonVal />}</span>
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

/* ─── Inline skeleton for individual values ─── */
function SkeletonVal() {
  return <span className="skeleton" style={{ width: 64, height: 22, display: "inline-block", borderRadius: 6 }} />;
}

/* ─── Custom Recharts tooltips ─── */
function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{label}</p>
      <p className="chart-tooltip__value">{Number(payload[0].value).toLocaleString()} kg</p>
    </div>
  );
}

function CustomPieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{payload[0].name}</p>
      <p className="chart-tooltip__value">{payload[0].value} sets</p>
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════ */
function Dashboard() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  /* ── delete-flow state ──
     deletingId: which workout row shows a spinner right now
     deleteError: surfaced inline above Recent Workouts if a delete fails */
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const [stats, setStats] = useState({
    totalWorkouts:    null,
    totalVolume:      null,
    totalExercises:   null,
    recentWorkouts:   [],
    currentStreak:    null,
    favoriteExercise: "",
    favoriteCount:    0,
    averageVolume:    null,
    topExercise:      "",
    topExerciseCount: 0,
    topMuscle:        "",
    topMuscleCount:   0,
    weeklyWorkouts:   null,
    monthlyWorkouts:  null,
    personalRecords:  {},
  });

  /* chart data lives separately — arrays, not scalars */
  const [weeklyVolumeData, setWeeklyVolumeData] = useState([]);
  const [muscleData, setMuscleData]             = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token  = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [
        workouts, volume, exercises, recent,
        streak, favorite, average,
        topExercise, topMuscle, weekly, monthly, records,
        weeklyVol, muscleDist,
      ] = await Promise.all([
        api.get("/dashboard/total-workouts",     config),
        api.get("/dashboard/total-volume",       config),
        api.get("/dashboard/total-exercises",    config),
        api.get("/dashboard/recent-workouts",    config),
        api.get("/dashboard/current-streak",     config),
        api.get("/dashboard/favorite-exercise",  config),
        api.get("/dashboard/average-volume",     config),
        api.get("/dashboard/top-exercise",       config),
        api.get("/dashboard/top-muscle",         config),
        api.get("/dashboard/weekly-workouts",    config),
        api.get("/dashboard/monthly-workouts",   config),
        api.get("/dashboard/personal-records",   config),
        api.get("/dashboard/weekly-volume",      config),
        api.get("/dashboard/muscle-distribution",config),
      ]);

      setStats({
        totalWorkouts:    workouts.data.totalWorkouts,
        totalVolume:      volume.data.totalVolume,
        totalExercises:   exercises.data.totalExercises,
        recentWorkouts:   recent.data,
        currentStreak:    streak.data.currentStreak,
        favoriteExercise: favorite.data.favoriteExercise,
        favoriteCount:    favorite.data.count,
        /* round to avoid floats like 3847.333... */
        averageVolume:    Math.round(average.data.averageVolume),
        topExercise:      topExercise.data.exercise,
        topExerciseCount: topExercise.data.count,
        topMuscle:        topMuscle.data.topMuscle,
        topMuscleCount:   topMuscle.data.count,
        weeklyWorkouts:   weekly.data.weeklyWorkouts,
        monthlyWorkouts:  monthly.data.monthlyWorkouts,
        personalRecords:  records.data,
      });

      /* ── weekly volume: backend returns [{day, volume}] Mon-first.
         Re-map defensively in case ordering ever changes. ── */
      const rawWeekly = weeklyVol.data; // [{day:"Mon",volume:0}, ...]
      const sortedWeekly = DAY_ORDER.map((d) => {
        const found = rawWeekly.find((r) => r.day === d);
        return { day: d, volume: found ? found.volume : 0 };
      });
      setWeeklyVolumeData(sortedWeekly);

      /* ── muscle distribution: backend returns [{muscle, sets}].
         Recharts Pie needs [{name, value}]. ── */
      const rawMuscle = muscleDist.data; // [{muscle:"Chest", sets:18}, ...]
      const mappedMuscle = rawMuscle.map((m) => ({
        name:  m.muscle,
        value: m.sets,
      }));
      setMuscleData(mappedMuscle);

    } catch (err) {
      console.error("Dashboard Error:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ─────────────────────────────────────────
     DELETE WORKOUT
     1. confirm()
     2. DELETE /api/workouts/:id with Bearer token
     3. on success → re-run fetchDashboardData() to refresh
        every stat, both charts, and the recent list in one go
  ───────────────────────────────────────── */
  const handleDeleteWorkout = async (workoutId) => {
    const confirmed = window.confirm("Delete this workout?");
    if (!confirmed) return;

    setDeleteError("");
    setDeletingId(workoutId);

    try {
      const token  = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };

      await api.delete(`/workouts/${workoutId}`, config);

      /* full refresh — reuses the exact same fetch that powers
         every card and chart on first load, so nothing drifts
         out of sync with the rest of the dashboard */
      await fetchDashboardData();
    } catch (err) {
      console.error("Delete Workout Error:", err);
      setDeleteError("Couldn't delete that workout. Try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const prEntries = Object.entries(stats.personalRecords);

  /* ── chart empty-state placeholder so charts don't show blank ── */
  const barChartData = weeklyVolumeData.length > 0
    ? weeklyVolumeData
    : DAY_ORDER.map((d) => ({ day: d, volume: 0 }));

  return (
    <div className="dash-page">
      {/* ambient orbs */}
      <div className="dash-bg" aria-hidden="true">
        <div className="orb orb--1" />
        <div className="orb orb--2" />
        <div className="orb orb--3" />
      </div>

      <Navbar />

      <main className="dash-main">

        {/* ── HERO ── */}
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
            <button className="cta-btn" onClick={() => setShowModal(true)}>
              <Plus size={16} strokeWidth={2.5} />
              New Workout
            </button>
          </div>
        </section>

        {/* ── PRIMARY STATS ── */}
        <section className="section">
          <p className="section__label">Overview</p>
          <div className="primary-grid">
            <PrimaryCard
              title="Total Workouts"
              value={loading ? null : stats.totalWorkouts}
              icon={Dumbbell}
              accent
            />
            <PrimaryCard
              title="Total Volume"
              value={loading ? null : `${stats.totalVolume?.toLocaleString()} kg`}
              icon={Flame}
            />
            <PrimaryCard
              title="Exercises Logged"
              value={loading ? null : stats.totalExercises}
              icon={Activity}
            />
            <PrimaryCard
              title="Current Streak"
              value={loading ? null : `${stats.currentStreak}d`}
              icon={CalendarDays}
            />
          </div>
        </section>

        {/* ── CHARTS ── */}
        <section className="section charts-row">

          {/* Weekly Volume Bar Chart */}
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
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<CustomBarTooltip />}
                  cursor={{ fill: "rgba(16,185,129,0.06)" }}
                />
                <Bar dataKey="volume" fill={EMERALD} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Muscle Split Pie Chart */}
          <div className="chart-card chart-card--pie">
            <div className="chart-card__head">
              <div>
                <p className="chart-card__title">Muscle Split</p>
                <p className="chart-card__sub">Sets distribution by muscle group</p>
              </div>
            </div>
            {muscleData.length === 0 && !loading ? (
              <div className="chart-empty">
                <Activity size={28} strokeWidth={1.4} />
                <p>No muscle data yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={muscleData}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {muscleData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(val) => (
                      <span style={{ fontSize: 12, color: "#64748b" }}>{val}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

        </section>

        {/* ── SECONDARY STATS ── */}
        <section className="section">
          <p className="section__label">Breakdown</p>
          <div className="secondary-grid">
            <SecondaryCard
              title="Avg Volume"
              value={loading ? null : `${stats.averageVolume?.toLocaleString()} kg`}
              icon={BarChart2}
            />
            <SecondaryCard
              title="Top Muscle"
              value={loading ? null : (stats.topMuscle || "—")}
              sub={stats.topMuscleCount ? `${stats.topMuscleCount} sets` : null}
              icon={Zap}
            />
            <SecondaryCard
              title="Top Exercise"
              value={loading ? null : (stats.topExercise || "—")}
              sub={stats.topExerciseCount ? `${stats.topExerciseCount}× performed` : null}
              icon={Trophy}
            />
            <SecondaryCard
              title="Weekly Workouts"
              value={loading ? null : stats.weeklyWorkouts}
              icon={CalendarCheck}
            />
            <SecondaryCard
              title="Monthly"
              value={loading ? null : stats.monthlyWorkouts}
              icon={CalendarRange}
            />
          </div>
        </section>

        {/* ── ACTIVITY SECTION ── */}
        <section className="section activity-row">

          {/* Recent Workouts */}
          <div className="activity-card activity-card--wide">
            <div className="activity-card__head">
              <p className="activity-card__title">Recent Workouts</p>
              <button className="activity-card__link">
                View all <ChevronRight size={14} />
              </button>
            </div>

            {deleteError && (
              <p className="delete-error">{deleteError}</p>
            )}

            {loading ? (
              <div className="activity-list">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="workout-row workout-row--skeleton">
                    <span className="skeleton" style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0 }} />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <span className="skeleton" style={{ width: "55%", height: 13, borderRadius: 5 }} />
                      <span className="skeleton" style={{ width: "38%", height: 11, borderRadius: 5 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats.recentWorkouts.length === 0 ? (
              <div className="empty-state">
                <Dumbbell size={28} strokeWidth={1.4} />
                <p>No workouts logged yet.</p>
                <button className="empty-btn" onClick={() => setShowModal(true)}>
                  Log your first workout
                </button>
              </div>
            ) : (
              <div className="activity-list">
                {stats.recentWorkouts.map((w) => {
                  const isDeleting = deletingId === w._id;
                  return (
                    <div
                      key={w._id}
                      className={`workout-row ${isDeleting ? "workout-row--deleting" : ""}`}
                    >
                      <div className="workout-row__icon">
                        <Dumbbell size={15} strokeWidth={1.8} />
                      </div>
                      <div className="workout-row__info">
                        <p className="workout-row__name">{w.exercise?.name}</p>
                        <p className="workout-row__meta">
                          {w.sets} sets · {w.reps} reps · {w.weight} kg
                        </p>
                      </div>
                      <span className="workout-row__vol">
                        {(w.sets * w.reps * w.weight).toLocaleString()} kg
                      </span>

                      <button
                        className="delete-btn"
                        aria-label="Delete workout"
                        disabled={isDeleting}
                        onClick={() => handleDeleteWorkout(w._id)}
                      >
                        {isDeleting ? (
                          <Loader2 size={15} strokeWidth={2} className="delete-btn__spinner" />
                        ) : (
                          <Trash2 size={15} strokeWidth={1.8} />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Favorite Exercise */}
          <div className="activity-card activity-card--fav">
            <p className="activity-card__title">Top Pick</p>
            <div className="fav-body">
              <div className="fav-icon">
                <Repeat2 size={24} strokeWidth={1.6} />
              </div>
              <p className="fav-name">{stats.favoriteExercise || "No data yet"}</p>
              <p className="fav-count">
                Performed <strong>{stats.favoriteCount}</strong> times
              </p>
            </div>
          </div>

          {/* Personal Records */}
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

        </section>

      </main>

      {showModal && (
        <AddWorkoutModal
          closeModal={() => setShowModal(false)}
          fetchDashboardData={fetchDashboardData}
        />
      )}
    </div>
  );
}

export default Dashboard;