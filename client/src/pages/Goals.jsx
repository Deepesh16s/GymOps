import "./goals.css";
import { useEffect, useMemo } from "react";
import api from "../services/api";
import { useState } from "react";
import { Plus, Target } from "lucide-react";

// ---- Category configuration (single source of truth for grouping + modal) ----
const GOAL_CATEGORIES = [
  {
    key: "strength",
    label: "Strength Goals",
    shortLabel: "Strength",
    types: ["Strength PR"],
  },
  {
    key: "activity",
    label: "Activity Goals",
    shortLabel: "Activity",
    types: ["Weekly Workout", "Monthly Volume"],
  },
  {
    key: "consistency",
    label: "Consistency Goals",
    shortLabel: "Consistency",
    types: ["Current Streak"],
  },
  {
    key: "body",
    label: "Body Goals",
    shortLabel: "Body",
    types: ["Weight"],
  },
  {
    key: "health",
    label: "Health Goals",
    shortLabel: "Health",
    types: ["Cardio"],
  },
  {
    key: "other",
    label: "Other",
    shortLabel: "Other",
    types: [], // catch-all for any type not listed above; excluded from modal dropdowns
  },
];

const TYPE_LABELS = {
  "Strength PR": "Strength PR Goal",
  "Weekly Workout": "Weekly Workout Goal",
  "Monthly Volume": "Monthly Volume Goal",
  "Current Streak": "Current Streak Goal",
  Weight: "Weight Goal",
  Cardio: "Cardio Goal",
};

// Categories that are actually selectable when creating/editing a goal
const SELECTABLE_CATEGORIES = GOAL_CATEGORIES.filter((c) => c.types.length > 0);

const getKnownTypes = () => SELECTABLE_CATEGORIES.flatMap((c) => c.types);

// Given a goal type, find which category it belongs to (used to preselect
// Dropdown 1 when editing an existing goal).
const getCategoryKeyForType = (type) => {
  const match = SELECTABLE_CATEGORIES.find((c) => c.types.includes(type));
  return match ? match.key : SELECTABLE_CATEGORIES[0].key;
};

const getTypesForCategory = (categoryKey) => {
  const cat = SELECTABLE_CATEGORIES.find((c) => c.key === categoryKey);
  return cat ? cat.types : [];
};

// Groups goals into categories, skipping empty categories entirely.
const groupGoalsByCategory = (goals) => {
  const knownTypes = getKnownTypes();

  return GOAL_CATEGORIES.map((cat) => ({
    ...cat,
    goals:
      cat.key === "other"
        ? goals.filter((g) => !knownTypes.includes(g.type))
        : goals.filter((g) => cat.types.includes(g.type)),
  })).filter((cat) => cat.goals.length > 0);
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

// Renders one category's heading (with goal count) + grid. Skipped entirely
// by the caller if the category has no goals.
function GoalCategorySection({ label, goals, onEdit, onDelete }) {
  return (
    <section className="section">
      <p className="section__label">
        {label} ({goals.length})
      </p>
      <div className="goals-grid">
        {goals.map((goal) => (
          <GoalCard
            key={goal._id}
            goal={goal}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
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

const DEFAULT_CATEGORY_KEY = SELECTABLE_CATEGORIES[0].key;
const DEFAULT_TYPE = getTypesForCategory(DEFAULT_CATEGORY_KEY)[0];

function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  const categorizedGoals = useMemo(() => groupGoalsByCategory(goals), [goals]);

  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  // selectedCategory drives Dropdown 1 and is local UI state only —
  // it is never sent to the backend, only formData.type is.
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORY_KEY);
  const [formData, setFormData] = useState({
    title: "",
    type: DEFAULT_TYPE,
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
    fetchExercises();
  }, []);

  const uniqueExercises = exercises.filter((exercise, index, arr) => {
    const key = exercise.name.trim().toLowerCase();
    return (
      arr.findIndex((e) => e.name.trim().toLowerCase() === key) === index
    );
  });

  const availableTypes = getTypesForCategory(selectedCategory);

  const handleAddGoal = () => {
    setEditingGoal(null);
    setSelectedCategory(DEFAULT_CATEGORY_KEY);
    setFormData({
      title: "",
      type: DEFAULT_TYPE,
      target: "",
      unit: "",
      exercise: "",
    });
    setShowModal(true);
  };

  const handleEditGoal = (goal) => {
    setEditingGoal(goal);
    setSelectedCategory(getCategoryKeyForType(goal.type));
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

  // Dropdown 1 (category) handler: updates selectedCategory and resets
  // Dropdown 2 (type) to the first type available in the new category.
  const handleCategoryChange = (e) => {
    const newCategoryKey = e.target.value;
    const newTypes = getTypesForCategory(newCategoryKey);
    const newType = newTypes[0];

    setSelectedCategory(newCategoryKey);
    setFormData((prev) => ({
      ...prev,
      type: newType,
      // Only Strength goals use an exercise picker; clear it otherwise
      exercise: newType === "Strength PR" ? prev.exercise : "",
    }));
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
        type: DEFAULT_TYPE,
        target: "",
        unit: "",
        exercise: "",
      });
      setSelectedCategory(DEFAULT_CATEGORY_KEY);

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

        {loading ? (
          <p className="goals-empty__sub">Loading goals...</p>
        ) : goals.length === 0 ? (
          <EmptyState onAdd={handleAddGoal} />
        ) : (
          categorizedGoals.map((cat) => (
            <GoalCategorySection
              key={cat.key}
              label={cat.label}
              goals={cat.goals}
              onEdit={handleEditGoal}
              onDelete={handleDeleteGoal}
            />
          ))
        )}

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

              {/* Dropdown 1: Goal Category */}
              <select
                name="category"
                value={selectedCategory}
                onChange={handleCategoryChange}
              >
                {SELECTABLE_CATEGORIES.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {cat.shortLabel}
                  </option>
                ))}
              </select>

              {/* Dropdown 2: Goal Type, filtered by selected category */}
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
              >
                {availableTypes.map((type) => (
                  <option key={type} value={type}>
                    {TYPE_LABELS[type]}
                  </option>
                ))}
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