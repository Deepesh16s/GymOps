import "./goals.css";
import { useEffect, useMemo } from "react";
import api from "../services/api";
import { useState } from "react";
import {
  Plus,
  Dumbbell,
  Flame,
  CalendarDays,
  Trophy,
  Target,
  Lock,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import Navbar from "../components/Navbar";

/* ════════════════════════════════════════════════════════════
   STATE-DRIVEN DATA
   No demo/sample goals. The page starts empty and renders
   purely from state, so wiring a real /api/goals fetch later
   just means replacing the initial useState value (and adding
   a loading flag), same pattern as Dashboard.jsx.
═══════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   DATA-DRIVEN OVERVIEW + ACHIEVEMENTS
   Both are now derived from real /goals and /workouts data
   instead of hardcoded placeholders. No goal/workout schema
   changes were made — these are pure read-side computations.
═══════════════════════════════════════════════════════════ */

/* Goal model has no explicit "category" field, so overview cards
   are matched to a goal by keywords in its title (case-insensitive,
   all keywords must appear). If no goal matches a category, the
   OverviewCard already renders "No goal set" whenever target is 0 —
   so an unmatched category naturally falls back to that, unchanged. */
const findGoalForCategory = (goals, keywords) =>
  goals.find((g) =>
    keywords.every((kw) => g.title.toLowerCase().includes(kw))
  );

const buildOverviewStats = (goals) => {
  const weeklyGoal = findGoalForCategory(goals, ["weekly", "workout"]);
  const monthlyGoal = findGoalForCategory(goals, ["monthly", "volume"]);
  const streakGoal = findGoalForCategory(goals, ["streak"]);
  const prGoal =
    findGoalForCategory(goals, ["personal", "record"]) ||
    findGoalForCategory(goals, ["pr"]);

  return {
    weeklyWorkouts: weeklyGoal
      ? { current: weeklyGoal.current, target: weeklyGoal.target }
      : { current: 0, target: 0 },
    monthlyVolume: monthlyGoal
      ? { current: monthlyGoal.current, target: monthlyGoal.target }
      : { current: 0, target: 0 },
    streak: streakGoal
      ? { current: streakGoal.current, target: streakGoal.target }
      : { current: 0, target: 0 },
    pr: prGoal
      ? {
          current: prGoal.current,
          target: prGoal.target,
          exercise: prGoal.exercise || "",
        }
      : { current: 0, target: 0, exercise: "" },
  };
};

/* total volume + workout streak, derived from raw workout history */
const computeWorkoutStats = (workouts) => {
  let totalVolume = 0;
  const dayKeys = new Set();

  workouts.forEach((w) => {
    const day = new Date(w.date || w.createdAt);
    day.setHours(0, 0, 0, 0);
    dayKeys.add(day.getTime());

    (w.workoutSets || []).forEach((s) => {
      totalVolume += (s.weight || 0) * (s.reps || 0);
    });
  });

  // streak = consecutive days with a workout, counting back from the
  // most recent workout day (so an old streak doesn't linger forever,
  // but a rest day "today" doesn't zero out yesterday's streak either)
  const days = Array.from(dayKeys).sort((a, b) => b - a);
  let streak = 0;
  if (days.length) {
    let expected = days[0];
    const ONE_DAY = 24 * 60 * 60 * 1000;
    for (const day of days) {
      if (day === expected) {
        streak += 1;
        expected -= ONE_DAY;
      } else {
        break;
      }
    }
  }

  return { totalWorkouts: workouts.length, totalVolume, streak };
};

const buildAchievements = (goals, workouts) => {
  const { totalWorkouts, totalVolume, streak } = computeWorkoutStats(workouts);

  // a "PR goal" is any goal tied to a specific exercise that has
  // reached Completed status
  const hasCompletedPRGoal = goals.some(
    (g) => g.status === "Completed" && g.exercise && g.exercise.trim() !== ""
  );

  return [
    { id: "a1", label: "First Workout", icon: "🔥", unlocked: totalWorkouts >= 1 },
    { id: "a2", label: "1000 kg Lifted", icon: "🏋️", unlocked: totalVolume >= 1000 },
    { id: "a3", label: "7 Day Streak", icon: "📅", unlocked: streak >= 7 },
    { id: "a4", label: "New PR", icon: "💪", unlocked: hasCompletedPRGoal },
  ];
};

/* ── helpers ── */
const pct = (current, target) =>
  target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

const statusClass = (status) => {
  if (status === "Completed") return "goal-badge--completed";
  if (status === "Behind") return "goal-badge--behind";
  return "goal-badge--progress";
};

/* ════════════════════════════════════════════════════════════
   SMALL COMPONENTS
═══════════════════════════════════════════════════════════ */
function ProgressBar({ value, variant }) {
  return (
    <div className={`progress-track ${variant ? `progress-track--${variant}` : ""}`}>
      <div className="progress-fill" style={{ width: `${value}%` }} />
    </div>
  );
}

function OverviewCard({ icon: Icon, label, current, target, suffix, footnote }) {
  const hasTarget = target > 0;
  const percent = pct(current, target);
  return (
    <div className="go-card overview-card">
      <div className="overview-card__head">
        <div className="overview-card__icon">
          <Icon size={20} strokeWidth={1.8} />
        </div>
        <span className="overview-card__label">{label}</span>
      </div>
      <p className="overview-card__value">
        {hasTarget ? (
          <>
            {current} <span className="overview-card__target">/ {target}{suffix ? ` ${suffix}` : ""}</span>
          </>
        ) : (
          <span className="overview-card__target">No goal set</span>
        )}
      </p>
      {footnote && <p className="overview-card__footnote">{footnote}</p>}
      <ProgressBar value={percent} />
      <span className="overview-card__pct">{percent}%</span>
    </div>
  );
}

function GoalCard({ goal, onEdit, onDelete }) {
  const percent = pct(goal.current, goal.target);
  return (
    <div className="go-card goal-card">
      <div className="goal-card__head">
        <div>
          <p className="goal-card__title">{goal.title}</p>
          <span className="goal-type-badge">{goal.type}</span>
        </div>
        <span className={`goal-badge ${statusClass(goal.status)}`}>{goal.status}</span>
      </div>

      <div className="goal-card__progress-row">
        <span className="goal-card__progress-text">
          {goal.current.toLocaleString()} / {goal.target.toLocaleString()} {goal.unit}
        </span>
        <span className="goal-card__pct">{percent}%</span>
      </div>

      <ProgressBar
        value={percent}
        variant={goal.status === "Behind" ? "behind" : goal.status === "Completed" ? "completed" : undefined}
      />

      <div className="goal-card-actions">
        <button
          type="button"
          className="goal-edit-btn"
          onClick={() => onEdit(goal)}
        >
          Edit
        </button>
        <button
          type="button"
          className="goal-delete-btn"
          onClick={() => onDelete(goal)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function AchievementCard({ achievement }) {
  return (
    <div className={`achievement-card ${achievement.unlocked ? "achievement-card--unlocked" : "achievement-card--locked"}`}>
      <div className="achievement-card__icon">
        {achievement.unlocked ? achievement.icon : <Lock size={18} strokeWidth={1.8} />}
      </div>
      <p className="achievement-card__label">{achievement.label}</p>
      <span className="achievement-card__status">
        {achievement.unlocked ? "Unlocked" : "Locked"}
      </span>
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="goals-empty">
      <Target size={36} strokeWidth={1.4} />
      <p>No goals yet</p>
      <p className="goals-empty__sub">Create your first fitness goal.</p>
      <button className="cta-btn" onClick={onAdd}>
        <Plus size={16} strokeWidth={2.5} />
        Create your first goal
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
function Goals() {
  /* Starts empty — no demo/placeholder goals. Replace this
     useState with a real fetch + loading state when the
     backend goals API exists. */
  const [goals, setGoals] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const overviewStats = useMemo(() => buildOverviewStats(goals), [goals]);
  const achievements = useMemo(
    () => buildAchievements(goals, workouts),
    [goals, workouts]
  );
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    type: "Strength",
    target: "",
    unit: "",
    exercise: "",
    deadline: "",
  });

  const fetchGoals = async () => {
    try {
      const res = await api.get("/goals");
      setGoals(res.data);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  /* Reuses the existing GET /workouts endpoint (no backend changes) —
     a high limit is passed so achievement math (total volume, streak)
     sees full history rather than just the first paginated page. */
  const fetchWorkouts = async () => {
    try {
      const res = await api.get("/workouts?limit=1000");
      setWorkouts(res.data);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    fetchGoals();
    fetchWorkouts();
  }, []);

  const handleAddGoal = () => {
    setEditingGoal(null);
    setFormData({
      title: "",
      type: "Strength",
      target: "",
      unit: "",
      exercise: "",
      deadline: "",
    });
    setShowModal(true);
  };

  const handleEditGoal = (goal) => {
    setEditingGoal(goal);
    setFormData({
      title: goal.title,
      type: goal.type,
      target: goal.target,
      unit: goal.unit,
      exercise: goal.exercise || "",
      deadline: goal.deadline ? goal.deadline.slice(0, 10) : "",
    });
    setShowModal(true);
  };

  const handleDeleteGoal = async (goal) => {
    if (!window.confirm("Delete this goal?")) return;

    try {
      await api.delete(`/goals/${goal._id}`);
      setGoals((prev) => prev.filter((g) => g._id !== goal._id));
    } catch (error) {
      console.log(error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingGoal) {
        const res = await api.put(`/goals/${editingGoal._id}`, formData);

        setGoals((prev) =>
          prev.map((g) => (g._id === editingGoal._id ? res.data : g))
        );

        setEditingGoal(null);
      } else {
        const res = await api.post("/goals", formData);

        setGoals((prev) => [
          res.data,
          ...prev,
        ]);
      }

      setFormData({
        title: "",
        type: "Strength",
        target: "",
        unit: "",
        exercise: "",
        deadline: "",
      });

      setShowModal(false);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="goals-page">
      <div className="goals-bg" aria-hidden="true">
        <div className="orb orb--1" />
        <div className="orb orb--2" />
        <div className="orb orb--3" />
      </div>

      <Navbar />

      <main className="goals-main">

        {/* ── HEADER ── */}
        <section className="goals-header">
          <div>
            <h1 className="goals-header__title">Fitness Goals</h1>
            <p className="goals-header__sub">Track your progress and stay accountable.</p>
          </div>
          <button className="cta-btn" onClick={handleAddGoal}>
            <Plus size={16} strokeWidth={2.5} />
            Add Goal
          </button>
        </section>

        {/* ── OVERVIEW CARDS ── */}
        <section className="section">
          <p className="section__label">Overview</p>
          <div className="overview-grid">
            <OverviewCard
              icon={Dumbbell}
              label="Weekly Workout Goal"
              current={overviewStats.weeklyWorkouts.current}
              target={overviewStats.weeklyWorkouts.target}
              suffix="workouts"
            />
            <OverviewCard
              icon={Flame}
              label="Monthly Volume Goal"
              current={overviewStats.monthlyVolume.current}
              target={overviewStats.monthlyVolume.target}
              suffix="kg"
            />
            <OverviewCard
              icon={CalendarDays}
              label="Current Streak Goal"
              current={overviewStats.streak.current}
              target={overviewStats.streak.target}
              suffix="days"
            />
            <OverviewCard
              icon={Trophy}
              label="Personal Record Goal"
              current={overviewStats.pr.current}
              target={overviewStats.pr.target}
              suffix="kg"
              footnote={overviewStats.pr.exercise || null}
            />
          </div>
        </section>

        {/* ── MAIN GOALS GRID ── */}
        <section className="section">
          <p className="section__label">Your Goals</p>
          {loading ? (
            <p className="goals-empty__sub">Loading goals...</p>
          ) : goals.length === 0 ? (
            <EmptyState onAdd={handleAddGoal} />
          ) : (
            <div className="goals-grid">
              {goals.map((goal) => (
                <GoalCard
                  key={goal._id}
                  goal={goal}
                  onEdit={handleEditGoal}
                  onDelete={handleDeleteGoal}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── ACHIEVEMENTS ── */}
        <section className="section">
          <p className="section__label">
            <TrendingUp size={12} strokeWidth={2.2} style={{ marginRight: 5, verticalAlign: -1 }} />
            Achievements
          </p>
          <div className="achievements-row">
            {achievements.map((a) => (
              <AchievementCard key={a.id} achievement={a} />
            ))}
          </div>
        </section>

      </main>

      {/* ── ADD / EDIT GOAL MODAL ── */}
      {showModal && (
        <div className="goal-modal-overlay">
          <div className="goal-modal">
            <h2>{editingGoal ? "Edit Goal" : "Create Goal"}</h2>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                name="title"
                placeholder="Goal Title"
                value={formData.title}
                onChange={handleChange}
                required
              />

              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
              >
                <option value="Strength">Strength</option>
                <option value="Cardio">Cardio</option>
                <option value="Endurance">Endurance</option>
                <option value="Weight">Weight</option>
                <option value="Habit">Habit</option>
              </select>

              <input
                type="number"
                name="target"
                placeholder="Target"
                value={formData.target}
                onChange={handleChange}
                required
              />

              <input
                type="text"
                name="unit"
                placeholder="Unit (kg, reps, days...)"
                value={formData.unit}
                onChange={handleChange}
                required
              />

              <input
                type="text"
                name="exercise"
                placeholder="Exercise (optional)"
                value={formData.exercise}
                onChange={handleChange}
              />

              <input
                type="date"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
              />

              <div className="modal-buttons">
                <button
                  type="button"
                  className="modal-btn modal-btn--cancel"
                  onClick={() => {
                    setShowModal(false);
                    setEditingGoal(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-btn modal-btn--submit"
                >
                  {editingGoal ? "Update Goal" : "Create Goal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Goals;