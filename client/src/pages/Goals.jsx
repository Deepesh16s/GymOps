import "./goals.css";
import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import {
  Plus,
  Target,
  ListChecks,
  CheckCircle2,
} from "lucide-react";
import {
  GOAL_CATEGORIES,
  TYPE_LABELS,
  TARGET_LABEL,
  FIXED_UNIT,
  CARDIO_UNITS,
  WEIGHT_UNITS,
  MANUAL_GOAL_TYPES as MANUAL_TYPES,
} from "../constants/goalTypes";
import { getGoalAnalytics } from "../utils/goalAnalytics";
import GoalCard from "../components/GoalCard";

// Catch-all for any goal whose type predates this redesign (e.g. the old
// "Weekly Workout" / "Monthly Volume" types) so existing goals don't just
// disappear from the page. Not selectable when creating a goal.
const OTHER_CATEGORY = {
  key: "other",
  label: "Other Goals",
  shortLabel: "Other",
  types: [],
};

const SELECTABLE_CATEGORIES = GOAL_CATEGORIES;

const getKnownTypes = () => SELECTABLE_CATEGORIES.flatMap((c) => c.types);

const getCategoryKeyForType = (type) => {
  const match = SELECTABLE_CATEGORIES.find((c) => c.types.includes(type));
  return match ? match.key : SELECTABLE_CATEGORIES[0].key;
};

const getTypesForCategory = (categoryKey) => {
  const cat = SELECTABLE_CATEGORIES.find((c) => c.key === categoryKey);
  return cat ? cat.types : [];
};

// Groups goals into the 4 fixed categories, plus an "Other" bucket for
// legacy types. Empty categories are skipped entirely. This is the
// DEFAULT view — see isFilterOrSortActive below for when it's bypassed
// in favor of a single flattened, filtered/sorted list.
const groupGoalsByCategory = (goals) => {
  const knownTypes = getKnownTypes();

  const known = GOAL_CATEGORIES.map((cat) => ({
    ...cat,
    goals: goals.filter((g) => cat.types.includes(g.type)),
  }));

  const other = {
    ...OTHER_CATEGORY,
    goals: goals.filter((g) => !knownTypes.includes(g.type)),
  };

  return [...known, other].filter((cat) => cat.goals.length > 0);
};

// Status filter options. Only real goal.status values now — Ahead/On
// Track/Behind were removed after the health badge was disabled for
// every goal type (see usesHealthBadge in goalAnalytics.js).
const STATUS_FILTER_OPTIONS = ["All", "In Progress", "Completed"];

const DEFAULT_SORT_KEY = "recent";
const SORT_OPTIONS = [
  { key: "recent", label: "Recently Updated" },
  { key: "progress", label: "Progress %" },
  { key: "deadline", label: "Deadline" },
];

const sortGoalEntries = (entries, sortKey) => {
  const sorted = [...entries];

  if (sortKey === "progress") {
    sorted.sort((a, b) => b.analytics.percent - a.analytics.percent);
  } else if (sortKey === "deadline") {
    sorted.sort((a, b) => {
      if (!a.goal.deadline && !b.goal.deadline) return 0;
      if (!a.goal.deadline) return 1; // no-deadline goals sort last
      if (!b.goal.deadline) return -1;
      return new Date(a.goal.deadline) - new Date(b.goal.deadline);
    });
  } else {
    sorted.sort(
      (a, b) =>
        new Date(b.goal.lastUpdated || b.goal.updatedAt) -
        new Date(a.goal.lastUpdated || a.goal.updatedAt)
    );
  }

  return sorted;
};

// Converts an ISO date string from the API into the "YYYY-MM-DD" shape
// <input type="date"> requires.
const toDateInputValue = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

function GoalStatCard({ label, value, icon: Icon }) {
  return (
    <div className="go-card goal-stat-card">
      <span className="goal-stat-card__label">
        {Icon && <Icon size={13} strokeWidth={2} style={{ marginRight: 5 }} />}
        {label}
      </span>
      <span className="goal-stat-card__value">{value}</span>
    </div>
  );
}

// Aggregate stats row. Purely derived client-side from the already-
// fetched goals list via goalsWithAnalytics below; no new endpoint, no
// extra query, same pattern as Dashboard.jsx's PrimaryCard/SecondaryCard
// grid. Ahead/Behind cards were removed along with the health badge —
// see usesHealthBadge in goalAnalytics.js.
function GoalStatsHeader({ stats }) {
  return (
    <div className="goal-stats-header">
      <GoalStatCard label="Total Goals" value={stats.total} icon={ListChecks} />
      <GoalStatCard label="Completed" value={stats.completed} icon={CheckCircle2} />
      <GoalStatCard label="Avg Progress" value={`${stats.avgPercent}%`} />
    </div>
  );
}

function GoalCategorySection({ label, goals, analyticsById, onEdit, onDelete }) {
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
            analytics={analyticsById.get(goal._id)}
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

// Phase 8C — distinct from the "no goals at all" EmptyState above: goals
// exist, but the current status filter matches none of them.
function FilteredEmptyState({ onClear }) {
  return (
    <div className="goals-empty goals-empty--filtered">
      <Target size={30} strokeWidth={1.4} />
      <p>No goals match these filters</p>
      <p className="goals-empty__sub">Try a different status, or clear your filters.</p>
      <button type="button" className="goal-filters-clear-btn" onClick={onClear}>
        Clear filters
      </button>
    </div>
  );
}

const DEFAULT_CATEGORY_KEY = SELECTABLE_CATEGORIES[0].key;
const DEFAULT_TYPE = getTypesForCategory(DEFAULT_CATEGORY_KEY)[0];

const getInitialFormData = (type) => ({
  title: "",
  type,
  target: "",
  exercise: "",
  weightUnit: "kg",
  cardioUnit: "Minutes",
  current: "",
  deadline: "",
});

function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Phase 8C — filter/sort state. Per product decision, an active
  // filter or a non-default sort switches the page from the default
  // category-grouped view to a single flattened list.
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortKey, setSortKey] = useState(DEFAULT_SORT_KEY);

  // Phase 8C — computed ONCE per goals-array change and reused
  // everywhere: the stats header, the status filter, sorting, and every
  // GoalCard's expanded panel all read from this instead of each calling
  // getGoalAnalytics independently.
  const goalsWithAnalytics = useMemo(
    () => goals.map((goal) => ({ goal, analytics: getGoalAnalytics(goal) })),
    [goals]
  );

  const analyticsById = useMemo(
    () => new Map(goalsWithAnalytics.map(({ goal, analytics }) => [goal._id, analytics])),
    [goalsWithAnalytics]
  );

  const goalStats = useMemo(() => {
    const total = goalsWithAnalytics.length;
    const completed = goalsWithAnalytics.filter(({ goal }) => goal.status === "Completed").length;
    const avgPercent = total
      ? Math.round(
          goalsWithAnalytics.reduce((sum, { analytics }) => sum + analytics.percent, 0) / total
        )
      : 0;
    return { total, completed, avgPercent };
  }, [goalsWithAnalytics]);

  const isFilterOrSortActive = statusFilter !== "All" || sortKey !== DEFAULT_SORT_KEY;

  const filteredSortedEntries = useMemo(() => {
    let entries = goalsWithAnalytics;
    if (statusFilter !== "All") {
      // Health badge is disabled for every goal type now (see
      // usesHealthBadge in goalAnalytics.js), so the only statuses left
      // to filter by are the real, reliable goal.status values.
      entries = entries.filter(({ goal }) => goal.status === statusFilter);
    }
    return sortGoalEntries(entries, sortKey);
  }, [goalsWithAnalytics, statusFilter, sortKey]);

  const categorizedGoals = useMemo(() => groupGoalsByCategory(goals), [goals]);

  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORY_KEY);
  const [formData, setFormData] = useState(getInitialFormData(DEFAULT_TYPE));

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
  const isManual = MANUAL_TYPES.includes(formData.type);

  const handleAddGoal = () => {
    setEditingGoal(null);
    setSelectedCategory(DEFAULT_CATEGORY_KEY);
    setFormData(getInitialFormData(DEFAULT_TYPE));
    setShowModal(true);
  };

  const handleEditGoal = (goal) => {
    setEditingGoal(goal);
    setSelectedCategory(getCategoryKeyForType(goal.type));
    setFormData({
      title: goal.title,
      type: goal.type,
      target: goal.target,
      exercise: goal.exercise?._id || "",
      weightUnit: goal.type === "Strength PR" ? goal.unit || "kg" : "kg",
      cardioUnit: goal.type === "Cardio Goal" ? goal.unit || "Minutes" : "Minutes",
      current: MANUAL_TYPES.includes(goal.type) ? goal.current : "",
      deadline: toDateInputValue(goal.deadline),
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

  const handleCategoryChange = (e) => {
    const newCategoryKey = e.target.value;
    const newTypes = getTypesForCategory(newCategoryKey);
    const newType = newTypes[0];

    setSelectedCategory(newCategoryKey);
    setFormData((prev) => ({
      ...getInitialFormData(newType),
      title: prev.title,
      deadline: prev.deadline,
    }));
  };

  const handleTypeChange = (e) => {
    const newType = e.target.value;
    setFormData((prev) => ({
      ...getInitialFormData(newType),
      title: prev.title,
      deadline: prev.deadline,
    }));
  };

  const buildPayload = () => {
    let unit;
    if (formData.type === "Strength PR") unit = formData.weightUnit;
    else if (formData.type === "Cardio Goal") unit = formData.cardioUnit;
    else unit = FIXED_UNIT[formData.type];

    const payload = {
      title: formData.title,
      type: formData.type,
      target: formData.target,
      unit,
      // Phase 8C: the backend has always accepted `deadline` (see
      // goalController.createGoal's `deadline: deadline || null`), but
      // the form never sent it. This is the fix — same field, no
      // backend change needed.
      deadline: formData.deadline || null,
    };

    if (formData.type === "Strength PR") {
      payload.exercise = formData.exercise;
    }

    if (isManual && formData.current !== "") {
      payload.current = formData.current;
    }

    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.type === "Strength PR" && !formData.exercise) {
      alert("Please select an exercise for a Strength PR goal");
      return;
    }

    const payload = buildPayload();

    try {
      if (editingGoal) {
        const res = await api.put(`/goals/${editingGoal._id}`, payload);

        setGoals((prev) =>
          prev.map((g) => (g._id === editingGoal._id ? res.data : g))
        );

        setEditingGoal(null);
      } else {
        const res = await api.post("/goals", payload);

        setGoals((prev) => [
          res.data,
          ...prev,
        ]);
      }

      setFormData(getInitialFormData(DEFAULT_TYPE));
      setSelectedCategory(DEFAULT_CATEGORY_KEY);

      setShowModal(false);
    } catch (error) {
      console.log(error);
      alert(error.response?.data?.message || "Failed to save goal");
    }
  };

  const clearFilters = () => {
    setStatusFilter("All");
    setSortKey(DEFAULT_SORT_KEY);
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

        {!loading && goals.length > 0 && <GoalStatsHeader stats={goalStats} />}

        {!loading && goals.length > 0 && (
          <div className="goal-filters-bar">
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_FILTER_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "All" ? "All Statuses" : s}
                </option>
              ))}
            </select>

            <select
              aria-label="Sort goals"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>

            {isFilterOrSortActive && (
              <button type="button" className="goal-filters-clear-btn" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        )}

        {loading ? (
          <p className="goals-empty__sub">Loading goals...</p>
        ) : goals.length === 0 ? (
          <EmptyState onAdd={handleAddGoal} />
        ) : isFilterOrSortActive ? (
          filteredSortedEntries.length === 0 ? (
            <FilteredEmptyState onClear={clearFilters} />
          ) : (
            <section className="section">
              <p className="section__label">Goals ({filteredSortedEntries.length})</p>
              <div className="goals-grid">
                {filteredSortedEntries.map(({ goal, analytics }) => (
                  <GoalCard
                    key={goal._id}
                    goal={goal}
                    analytics={analytics}
                    onEdit={handleEditGoal}
                    onDelete={handleDeleteGoal}
                  />
                ))}
              </div>
            </section>
          )
        ) : (
          categorizedGoals.map((cat) => (
            <GoalCategorySection
              key={cat.key}
              label={cat.label}
              goals={cat.goals}
              analyticsById={analyticsById}
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
                onChange={handleTypeChange}
              >
                {availableTypes.map((type) => (
                  <option key={type} value={type}>
                    {TYPE_LABELS[type]}
                  </option>
                ))}
              </select>

              {/* Strength PR only: exercise picker */}
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

              <input
                type="number"
                name="target"
                placeholder={TARGET_LABEL[formData.type] || "Target"}
                value={formData.target}
                onChange={handleChange}
                required
              />

              {/* Strength PR only: weight unit */}
              {formData.type === "Strength PR" && (
                <select
                  name="weightUnit"
                  value={formData.weightUnit}
                  onChange={handleChange}
                >
                  {WEIGHT_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              )}

              {/* Cardio Goal only: unit (Minutes / Kilometers / Runs) */}
              {formData.type === "Cardio Goal" && (
                <select
                  name="cardioUnit"
                  value={formData.cardioUnit}
                  onChange={handleChange}
                >
                  {CARDIO_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              )}

              {/* Manual types only (Cardio Goal, Weight Goal): log progress */}
              {isManual && (
                <input
                  type="number"
                  name="current"
                  placeholder={
                    formData.type === "Weight Goal"
                      ? "Current Weight (kg)"
                      : "Current Progress"
                  }
                  value={formData.current}
                  onChange={handleChange}
                />
              )}

              {/* Phase 8C: deadline, generic to every goal type — the
                  backend field already existed; this is the missing UI
                  for it, and what makes the new analytics meaningful. */}
              <label className="goal-field-label">
                Deadline (optional)
                <input
                  type="date"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleChange}
                />
              </label>

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