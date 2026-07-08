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
  TrendingUp,
} from "lucide-react";

import Navbar from "../components/Navbar";

const buildOverviewStats = (goals) => {
  const weeklyGoal = goals.find((g) => g.type === "Weekly Workout");
  const monthlyGoal = goals.find((g) => g.type === "Monthly Volume");
  const streakGoal = goals.find((g) => g.type === "Current Streak");
  const prGoal = goals.find((g) => g.type === "Strength PR");

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
          exercise: prGoal.exercise?.name || "",
        }
      : { current: 0, target: 0, exercise: "" },
  };
};

const computeMaxWeightByExercise = (workouts) => {
  const max = {};

  workouts.forEach((w) => {
    if (!w.exercise) return;
    const name = w.exercise.name;

    const heaviestSet = (w.workoutSets || []).reduce(
      (m, s) => (s.weight > m ? s.weight : m),
      0
    );

    if (!max[name] || heaviestSet > max[name]) max[name] = heaviestSet;
  });

  return max;
};

const buildAchievements = (workouts) => {
  const maxByExercise = computeMaxWeightByExercise(workouts);

  return [
    {
      id: "a1",
      label: "Bench Press 100kg",
      icon: "🏋️",
      unlocked: (maxByExercise["Bench Press"] || 0) >= 100,
    },
    {
      id: "a2",
      label: "Deadlift 150kg",
      icon: "🔥",
      unlocked: (maxByExercise["Deadlift"] || 0) >= 150,
    },
    {
      id: "a3",
      label: "Squat 100kg",
      icon: "💪",
      unlocked: (maxByExercise["Squat"] || 0) >= 100,
    },
  ];
};

const pct = (current, target) =>
  target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

const statusClass = (status) => {
  if (status === "Completed") return "goal-badge--completed";
  if (status === "Behind") return "goal-badge--behind";
  return "goal-badge--progress";
};

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
          <span className="goal-type-badge">
            {goal.type}
            {goal.type === "Strength PR" && goal.exercise?.name
              ? ` · ${goal.exercise.name}`
              : ""}
          </span>
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

function Goals() {
  const [goals, setGoals] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const overviewStats = useMemo(() => buildOverviewStats(goals), [goals]);
  const achievements = useMemo(
    () => buildAchievements(workouts),
    [workouts]
  );
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    type: "Weight",
    target: "",
    unit: "",
    exercise: "",
  });

  const [exercises, setExercises] = useState([]);

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

  const fetchWorkouts = async () => {
    try {
      const res = await api.get("/workouts?limit=1000");
      setWorkouts(res.data);
    } catch (error) {
      console.log(error);
    }
  };

  const fetchExercises = async () => {
    try {
      const res = await api.get("/exercises");
      setExercises(res.data);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    fetchGoals();
    fetchWorkouts();
    fetchExercises();
  }, []);

  const uniqueExercises = exercises.filter((exercise, index, arr) => {
    const key = exercise.name.trim().toLowerCase();
    return (
      arr.findIndex((e) => e.name.trim().toLowerCase() === key) === index
    );
  });

  const handleAddGoal = () => {
    setEditingGoal(null);
    setFormData({
      title: "",
      type: "Weight",
      target: "",
      unit: "",
      exercise: "",
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
      exercise: goal.exercise?._id || "",
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

    if (formData.type === "Strength PR" && !formData.exercise) {
      alert("Please select an exercise for a Strength PR goal");
      return;
    }

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
        type: "Weight",
        target: "",
        unit: "",
        exercise: "",
      });

      setShowModal(false);
    } catch (error) {
      console.log(error);
      alert(error.response?.data?.message || "Failed to save goal");
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
                <option value="Strength PR">Strength PR Goal (Auto)</option>
                <option value="Weekly Workout">Weekly Workout Goal (Auto)</option>
                <option value="Monthly Volume">Monthly Volume Goal (Auto)</option>
                <option value="Current Streak">Current Streak Goal (Auto)</option>
                <option value="Weight">Weight Goal</option>
                <option value="Cardio">Cardio Goal</option>
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

              {formData.type === "Strength PR" && (
                <select
                  name="exercise"
                  value={formData.exercise}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Exercise</option>
                  {uniqueExercises.map((ex) => (
                    <option key={ex._id} value={ex._id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
              )}

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