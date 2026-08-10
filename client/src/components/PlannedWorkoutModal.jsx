import { useEffect, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import api from "../services/api";
import { createPlannedWorkout, updatePlannedWorkout } from "../services/plannedWorkoutService";
import { SESSION_TYPES } from "../constants/sessionTypes";
import { CARDIO_ACTIVITY_TYPES } from "../constants/cardioMetadata";
import {
  PRIORITY_OPTIONS,
  RECURRENCE_TYPES,
  RECURRENCE_TYPE_OPTIONS,
  WEEKDAY_OPTIONS,
  EDIT_SCOPE_OPTIONS,
} from "../constants/plannedWorkoutTypes";
import "./PlannedWorkoutModal.css";

const getDefaultFormData = (initialDateKey) => ({
  title: "",
  workoutType: SESSION_TYPES[0],
  cardioActivityType: "",
  scheduledDate: initialDateKey || "",
  scheduledTime: "",
  estimatedDuration: "",
  notes: "",
  priority: "Medium",
  exercises: [],
  recurrenceType: RECURRENCE_TYPES.NONE,
  weekdays: [],
  interval: 1,
  endDate: "",
});

function PlannedWorkoutModal({ mode, initialDateKey, templatePrefill, editingPlan, onClose, onSaved }) {
  const [formData, setFormData] = useState(() => getDefaultFormData(initialDateKey));
  const [editScope, setEditScope] = useState("only");
  const [exercises, setExercises] = useState([]);
  const [exercisePickerId, setExercisePickerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/exercises")
      .then((res) => setExercises(res.data))
      .catch((err) => console.log(err));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (mode === "edit" && editingPlan) {
      setFormData({
        title: editingPlan.title,
        workoutType: editingPlan.workoutType,
        cardioActivityType: editingPlan.cardioActivityType || "",
        scheduledDate: new Date(editingPlan.scheduledDate).toISOString().slice(0, 10),
        scheduledTime: editingPlan.scheduledTime || "",
        estimatedDuration: editingPlan.estimatedDuration ?? "",
        notes: editingPlan.notes || "",
        priority: editingPlan.priority,
        exercises: (editingPlan.exercises || []).map((e) => ({
          exercise: e.exercise,
          targetSets: e.targetSets ?? "",
          notes: e.notes || "",
        })),
        recurrenceType: editingPlan.recurrence?.type || RECURRENCE_TYPES.NONE,
        weekdays: editingPlan.recurrence?.weekdays || [],
        interval: editingPlan.recurrence?.interval || 1,
        endDate: editingPlan.recurrence?.endDate
          ? new Date(editingPlan.recurrence.endDate).toISOString().slice(0, 10)
          : "",
      });
    } else if (templatePrefill) {
      setFormData((prev) => ({
        ...prev,
        title: templatePrefill.label,
        workoutType: templatePrefill.workoutType,
        cardioActivityType: templatePrefill.cardioActivityType || "",
        estimatedDuration: templatePrefill.estimatedDuration || "",
      }));
    }
  }, [mode, editingPlan, templatePrefill]);

  const isEditingRecurringInstance = mode === "edit" && !!editingPlan?.recurrenceGroupId;
  const isCardio = formData.workoutType === "Cardio";
  const isRecurring = formData.recurrenceType !== RECURRENCE_TYPES.NONE;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleWeekday = (day) => {
    setFormData((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter((d) => d !== day)
        : [...prev.weekdays, day].sort(),
    }));
  };

  const handleAddExercise = () => {
    if (!exercisePickerId) return;
    const ex = exercises.find((e) => e._id === exercisePickerId);
    if (!ex) return;
    if (formData.exercises.some((e) => (e.exercise._id || e.exercise) === ex._id)) return;
    setFormData((prev) => ({
      ...prev,
      exercises: [...prev.exercises, { exercise: ex, targetSets: "", notes: "" }],
    }));
    setExercisePickerId("");
  };

  const handleRemoveExercise = (exerciseId) => {
    setFormData((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((e) => (e.exercise._id || e.exercise) !== exerciseId),
    }));
  };

  const handleTargetSetsChange = (exerciseId, value) => {
    setFormData((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e) =>
        (e.exercise._id || e.exercise) === exerciseId ? { ...e, targetSets: value } : e
      ),
    }));
  };

  const buildPayload = () => ({
    title: formData.title.trim(),
    workoutType: formData.workoutType,
    cardioActivityType: isCardio ? formData.cardioActivityType || null : null,
    scheduledDate: formData.scheduledDate,
    scheduledTime: formData.scheduledTime || null,
    exercises: formData.exercises.map((e) => ({
      exercise: e.exercise._id || e.exercise,
      targetSets: e.targetSets === "" ? null : Number(e.targetSets),
      notes: e.notes || null,
    })),
    estimatedDuration: formData.estimatedDuration === "" ? null : Number(formData.estimatedDuration),
    notes: formData.notes || null,
    priority: formData.priority,
    recurrence: {
      type: formData.recurrenceType,
      weekdays: formData.weekdays,
      interval: Number(formData.interval) || 1,
      endDate: formData.endDate || null,
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }
    if (!formData.scheduledDate) {
      setError("Date is required");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (mode === "edit") {
        await updatePlannedWorkout(editingPlan._id, buildPayload(), editScope);
      } else {
        await createPlannedWorkout(buildPayload());
      }
      onSaved();
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to save planned workout.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="planner-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Planned workout"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="planner-modal-card">
        <div className="planner-modal-header">
          <p className="planner-modal-title">{mode === "edit" ? "Edit Planned Workout" : "Plan a Workout"}</p>
          <button type="button" className="planner-modal-close" onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="planner-modal-body">
          <input
            type="text"
            name="title"
            placeholder="Workout title"
            value={formData.title}
            onChange={handleChange}
            required
          />

          <div className="planner-modal-row">
            <select name="workoutType" value={formData.workoutType} onChange={handleChange}>
              {SESSION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {isCardio && (
              <select name="cardioActivityType" value={formData.cardioActivityType} onChange={handleChange}>
                <option value="">Select activity (optional)</option>
                {CARDIO_ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
          </div>

          <div className="planner-modal-row">
            <label className="planner-modal-field-label">
              Date
              <input type="date" name="scheduledDate" value={formData.scheduledDate} onChange={handleChange} required />
            </label>
            <label className="planner-modal-field-label">
              Time (optional)
              <input type="time" name="scheduledTime" value={formData.scheduledTime} onChange={handleChange} />
            </label>
          </div>

          <div className="planner-modal-row">
            <label className="planner-modal-field-label">
              Estimated duration (min)
              <input
                type="number"
                name="estimatedDuration"
                min="0"
                value={formData.estimatedDuration}
                onChange={handleChange}
              />
            </label>
            <label className="planner-modal-field-label">
              Priority
              <select name="priority" value={formData.priority} onChange={handleChange}>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="planner-modal-exercises">
            <p className="planner-modal-field-label">Exercises (optional)</p>
            {formData.exercises.map((e) => {
              const id = e.exercise._id || e.exercise;
              const name = e.exercise.name || "Exercise";
              return (
                <div className="planner-modal-exercise-row" key={id}>
                  <span className="planner-modal-exercise-name">{name}</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Sets"
                    className="planner-modal-exercise-sets"
                    value={e.targetSets}
                    onChange={(ev) => handleTargetSetsChange(id, ev.target.value)}
                  />
                  <button type="button" onClick={() => handleRemoveExercise(id)} aria-label={`Remove ${name}`}>
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                </div>
              );
            })}
            <div className="planner-modal-row">
              <select value={exercisePickerId} onChange={(e) => setExercisePickerId(e.target.value)}>
                <option value="">Select exercise to add...</option>
                {exercises.map((ex) => (
                  <option key={ex._id} value={ex._id}>
                    {ex.name} ({ex.muscleGroup})
                  </option>
                ))}
              </select>
              <button type="button" className="planner-modal-add-exercise-btn" onClick={handleAddExercise}>
                <Plus size={13} strokeWidth={2.2} />
                Add
              </button>
            </div>
          </div>

          <textarea
            name="notes"
            placeholder="Notes (optional)"
            value={formData.notes}
            onChange={handleChange}
            rows={2}
          />

          {mode === "create" && (
            <div className="planner-modal-recurrence">
              <label className="planner-modal-field-label">
                Repeat
                <select name="recurrenceType" value={formData.recurrenceType} onChange={handleChange}>
                  {RECURRENCE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>

              {(formData.recurrenceType === RECURRENCE_TYPES.WEEKLY ||
                formData.recurrenceType === RECURRENCE_TYPES.CUSTOM_WEEKDAYS) && (
                <div className="planner-modal-weekdays">
                  {WEEKDAY_OPTIONS.map((w) => (
                    <button
                      type="button"
                      key={w.value}
                      className={`planner-modal-weekday-btn ${
                        formData.weekdays.includes(w.value) ? "planner-modal-weekday-btn--active" : ""
                      }`}
                      aria-pressed={formData.weekdays.includes(w.value)}
                      onClick={() => toggleWeekday(w.value)}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              )}

              {isRecurring && (
                <div className="planner-modal-row">
                  <label className="planner-modal-field-label">
                    Every
                    <input
                      type="number"
                      name="interval"
                      min="1"
                      value={formData.interval}
                      onChange={handleChange}
                    />
                  </label>
                  <label className="planner-modal-field-label">
                    Ends (optional)
                    <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} />
                  </label>
                </div>
              )}
            </div>
          )}

          {isEditingRecurringInstance && (
            <label className="planner-modal-field-label">
              Apply changes to
              <select value={editScope} onChange={(e) => setEditScope(e.target.value)}>
                {EDIT_SCOPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          )}

          {error && <p className="planner-modal-error">{error}</p>}

          <div className="planner-modal-actions">
            <button type="button" className="planner-modal-btn planner-modal-btn--cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="planner-modal-btn planner-modal-btn--submit" disabled={saving}>
              {saving ? "Saving..." : mode === "edit" ? "Save Changes" : "Create Plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PlannedWorkoutModal;
