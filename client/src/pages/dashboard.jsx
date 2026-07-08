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
} from "recharts";

import Navbar from "../components/Navbar";
import AddWorkoutModal from "../components/AddWorkoutModal";
import MuscleBodyMap from "../components/MuscleBodyMap";
import api from "../services/api";

const EMERALD = "#10b981";
const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const RANGE_OPTIONS = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

const getWorkoutVolume = (w) =>
  (w.workoutSets || []).reduce((sum, s) => sum + s.reps * s.weight, 0);

function PrimaryCard({ title, value, icon: Icon, accent, onClick }) {
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

function Dashboard() {
  const navigate = useNavigate();

  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const [stats, setStats] = useState({
    totalWorkouts: null,
    totalVolume: null,
    totalExercises: null,
    recentWorkouts: [],
    currentStreak: null,
    favoriteExercise: "",
    favoriteCount: 0,
    averageVolume: null,
    topExercise: "",
    topExerciseCount: 0,
    topMuscle: "",
    topMuscleCount: 0,
    weeklyWorkouts: null,
    monthlyWorkouts: null,
    personalRecords: {},
  });

  const [weeklyVolumeData, setWeeklyVolumeData] = useState([]);

  // Muscle Split has its own state so switching the range doesn't reload the whole dashboard
  const [muscleRange, setMuscleRange] = useState("month"); // "week" | "month" | "year"
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
        workouts,
        volume,
        exercises,
        recent,
        streak,
        favorite,
        average,
        topExercise,
        topMuscle,
        weekly,
        monthly,
        records,
        weeklyVol,
      ] = await Promise.all([
        api.get("/dashboard/total-workouts", config),
        api.get("/dashboard/total-volume", config),
        api.get("/dashboard/total-exercises", config),
        api.get("/dashboard/recent-workouts", config),
        api.get("/dashboard/current-streak", config),
        api.get("/dashboard/favorite-exercise", config),
        api.get("/dashboard/average-volume", config),
        api.get("/dashboard/top-exercise", config),
        api.get("/dashboard/top-muscle", config),
        api.get("/dashboard/weekly-workouts", config),
        api.get("/dashboard/monthly-workouts", config),
        api.get("/dashboard/personal-records", config),
        api.get("/dashboard/weekly-volume", config),
      ]);

      setStats({
        totalWorkouts: workouts.data.totalWorkouts,
        totalVolume: volume.data.totalVolume,
        totalExercises: exercises.data.totalExercises,
        recentWorkouts: recent.data,
        currentStreak: streak.data.currentStreak,
        favoriteExercise: favorite.data.favoriteExercise,
        favoriteCount: favorite.data.count,
        averageVolume: Math.round(average.data.averageVolume),
        topExercise: topExercise.data.exercise,
        topExerciseCount: topExercise.data.count,
        topMuscle: topMuscle.data.topMuscle,
        topMuscleCount: topMuscle.data.count,
        weeklyWorkouts: weekly.data.weeklyWorkouts,
        monthlyWorkouts: monthly.data.monthlyWorkouts,
        personalRecords: records.data,
      });

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

  const handleDeleteWorkout = async (workoutId) => {
    const confirmed = window.confirm("Delete this workout?");
    if (!confirmed) return;

    setDeleteError("");
    setDeletingId(workoutId);

    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };

      await api.delete(`/workouts/${workoutId}`, config);

      await fetchDashboardData();
    } catch (err) {
      console.error("Delete Workout Error:", err);
      setDeleteError("Couldn't delete that workout. Try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const prEntries = Object.entries(stats.personalRecords);

  const barChartData =
    weeklyVolumeData.length > 0
      ? weeklyVolumeData
      : DAY_ORDER.map((d) => ({ day: d, volume: 0 }));

  return (
    <div className="dash-page">
      <div className="dash-bg" aria-hidden="true">
        <div className="orb orb--1" />
        <div className="orb orb--2" />
        <div className="orb orb--3" />
      </div>

      <Navbar />

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
            <button className="cta-btn" onClick={() => setShowModal(true)}>
              <Plus size={16} strokeWidth={2.5} />
              New Workout
            </button>
          </div>
        </section>

        <section className="section">
          <p className="section__label">Overview</p>
          <div className="primary-grid">
            <PrimaryCard
              title="Total Workouts"
              value={loading ? null : stats.totalWorkouts}
              icon={Dumbbell}
              accent
              onClick={() => navigate("/workouts")}
            />
            <PrimaryCard
              title="Total Volume"
              value={loading ? null : `${stats.totalVolume?.toLocaleString()} kg`}
              icon={Flame}
              onClick={() => navigate("/analytics")}
            />
            <PrimaryCard
              title="Exercises Logged"
              value={loading ? null : stats.totalExercises}
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
            <MuscleBodyMap muscleData={muscleData} loading={muscleLoading} />
          </div>
        </section>

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

        <section className="activity-row">
          <div className="activity-card activity-card--recent">
            <div className="activity-card__head">
              <p className="activity-card__title">Recent Workouts</p>
              <button className="view-all-btn" onClick={() => navigate("/workouts")}>
                View all <ChevronRight size={14} />
              </button>
            </div>

            {deleteError && <p className="delete-error">{deleteError}</p>}

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
                {stats.recentWorkouts.slice(0, 5).map((w) => {
                  const isDeleting = deletingId === w._id;
                  const setCount = w.workoutSets?.length || 0;
                  const volume = getWorkoutVolume(w);

                  const setBreakdown = (w.workoutSets || [])
                    .map((s) => `${s.weight}kg×${s.reps}`)
                    .join(", ");

                  return (
                    <div
                      key={w._id}
                      className={`workout-row ${
                        isDeleting ? "workout-row--deleting" : ""
                      }`}
                    >
                      <div className="workout-row__icon">
                        <Dumbbell size={15} strokeWidth={1.8} />
                      </div>
                      <div className="workout-row__info">
                        <p className="workout-row__name">{w.exercise?.name}</p>
                        <p className="workout-row__meta">
                          {setCount} {setCount === 1 ? "set" : "sets"} ·{" "}
                          {volume.toLocaleString()} kg volume
                        </p>
                        <p className="workout-row__sets">{setBreakdown}</p>
                      </div>
                      <span className="workout-row__vol">
                        {volume.toLocaleString()} kg
                      </span>

                      <button
                        className="delete-btn"
                        aria-label="Delete workout"
                        disabled={isDeleting}
                        onClick={() => handleDeleteWorkout(w._id)}
                      >
                        {isDeleting ? (
                          <Loader2
                            size={15}
                            strokeWidth={2}
                            className="delete-btn__spinner"
                          />
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

          <div className="activity-side">
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