import "./goals.css";
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

/* Overview stat definitions: each maps to a goal "category".
   current/target start at 0 until real workout/goal data exists. */
const initialOverviewStats = {
  weeklyWorkouts: { current: 0, target: 0 },
  monthlyVolume: { current: 0, target: 0 },
  streak: { current: 0, target: 0 },
  pr: { current: 0, target: 0, exercise: "" },
};

/* Achievement definitions stay (they're derived from workout
   activity, not fake goal data) but start fully locked since
   there is no workout history wired in on this page yet. */
const initialAchievements = [
  { id: "a1", label: "First Workout", icon: "🔥", unlocked: false },
  { id: "a2", label: "1000 kg Lifted", icon: "🏋️", unlocked: false },
  { id: "a3", label: "7 Day Streak", icon: "📅", unlocked: false },
  { id: "a4", label: "New PR", icon: "💪", unlocked: false },
];

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

function GoalCard({ goal }) {
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
  const [overviewStats] = useState(initialOverviewStats);
  const [achievements] = useState(initialAchievements);
  const [showModalStub, setShowModalStub] = useState(false);

  const handleAddGoal = () => {
    // Stub only — wiring a real "Add Goal" modal/flow is a follow-up task.
    setShowModalStub(true);
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

        {showModalStub && (
          <p className="goals-stub-note">
            <Sparkles size={14} strokeWidth={2} />
            Add Goal flow coming soon.
          </p>
        )}

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
          {goals.length === 0 ? (
            <EmptyState onAdd={handleAddGoal} />
          ) : (
            <div className="goals-grid">
              {goals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
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
    </div>
  );
}

export default Goals;