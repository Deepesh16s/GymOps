import { useEffect, useState } from "react";
import { Dumbbell, Plus, X, CheckCircle2, Loader2 } from "lucide-react";
import ExerciseSessionCard from "./ExerciseSessionCard";
import "./WorkoutSession.css";

const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const formatMinutesLabel = (ms) => {
  const minutes = Math.floor(Math.max(0, ms) / 60000);
  return minutes < 1 ? "<1 min" : `${minutes} min`;
};

function WorkoutSession({
  startTime,
  exerciseCount,
  exercises,
  onAddExercise,
  onDiscard,
  onRemoveExercise,
  onAddSet,
  onDeleteSet,
  onUpdateSet,
  onFinishWorkout,
  isSaving,
  saveError,
}) {
  const [now, setNow] = useState(Date.now());
  const [showConfirm, setShowConfirm] = useState(false);

  // Lifted up from ExerciseSessionCard so only one set editor (whether
  // adding a new set or editing an existing one, in any exercise) can be
  // open across the whole session at once. { exerciseId, setId } where
  // setId === null means "adding a new set" for that exercise; null
  // overall means nothing is being edited.
  const [editingTarget, setEditingTarget] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsed = startTime ? now - startTime : 0;
  const hasExercises = exercises.length > 0;
  const isEditingActive = editingTarget !== null;
  const totalSets = exercises.reduce((sum, entry) => sum + entry.sets.length, 0);

  const handleStartAddSet = (exerciseId) => {
    if (isSaving || isEditingActive) return;
    setEditingTarget({ exerciseId, setId: null });
  };

  const handleStartEditSet = (exerciseId, setId) => {
    if (isSaving || isEditingActive) return;
    setEditingTarget({ exerciseId, setId });
  };

  const handleCancelEdit = () => {
    if (isSaving) return;
    setEditingTarget(null);
  };

  const handleSaveNewSet = (exerciseId, set) => {
    onAddSet(exerciseId, set);
    setEditingTarget(null);
  };

  const handleSaveEditSet = (exerciseId, setId, updatedSet) => {
    onUpdateSet(exerciseId, setId, updatedSet);
    setEditingTarget(null);
  };

  // Deleting the last remaining set of an exercise removes the exercise
  // itself (see useWorkoutSession.deleteSet), so that specific case gets
  // an explicit confirmation. Any other set is deleted immediately.
  const handleDeleteSet = (exerciseId, setId) => {
    if (isSaving || isEditingActive) return;

    const exercise = exercises.find((entry) => entry.id === exerciseId);
    const isLastSet = exercise && exercise.sets.length === 1;

    if (isLastSet) {
      const confirmed = window.confirm(
        "Deleting this set will remove the exercise. Continue?"
      );
      if (!confirmed) return;
    }

    onDeleteSet(exerciseId, setId);
  };

  const handleDeleteExercise = (exerciseId) => {
    if (isSaving || isEditingActive) return;

    const confirmed = window.confirm(
      "Remove this exercise from the current workout?"
    );
    if (!confirmed) return;

    onRemoveExercise(exerciseId);
  };

  const handleAddExerciseClick = () => {
    if (isSaving || isEditingActive) return;
    onAddExercise();
  };

  const handleDiscardClick = () => {
    if (isSaving || isEditingActive) return;
    onDiscard();
  };

  const handleFinishClick = () => {
    if (isSaving || !hasExercises || isEditingActive) return;
    setShowConfirm(true);
  };

  const handleCancelConfirm = () => {
    if (isSaving) return;
    setShowConfirm(false);
  };

  const handleConfirmFinish = async () => {
    if (isSaving) return;
    setShowConfirm(false);
    await onFinishWorkout();
  };

  return (
    <section className="session-card">
      <div className="session-card__top">
        <div className="session-card__info">
          <div className="session-card__icon">
            <Dumbbell size={20} strokeWidth={1.8} />
          </div>
          <div>
            <p className="session-card__title">Workout Session</p>
            <div className="session-card__stats">
              <span>{formatDuration(elapsed)}</span>
              <span className="session-card__dot" />
              <span>
                {exerciseCount} {exerciseCount === 1 ? "exercise" : "exercises"}
              </span>
            </div>
          </div>
        </div>

        <div className="session-card__actions">
          <button
            type="button"
            className="cta-btn"
            onClick={handleAddExerciseClick}
            disabled={isSaving || isEditingActive}
          >
            <Plus size={16} strokeWidth={2.5} />
            Add Exercise
          </button>
          <button
            type="button"
            className="session-finish-btn"
            onClick={handleFinishClick}
            disabled={isSaving || !hasExercises || isEditingActive}
          >
            {isSaving ? (
              <>
                <Loader2 size={15} strokeWidth={2} className="session-btn-spinner" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 size={16} strokeWidth={2} />
                Finish Workout
              </>
            )}
          </button>
          <button
            type="button"
            className="session-discard-btn"
            onClick={handleDiscardClick}
            disabled={isSaving || isEditingActive}
          >
            <X size={15} strokeWidth={2} />
            Discard Session
          </button>
        </div>
      </div>

      {saveError && (
        <p className="session-error" role="alert">
          {saveError}
        </p>
      )}

      {hasExercises && (
        <div className="session-card__exercises">
          {exercises.map((entry) => (
            <ExerciseSessionCard
              key={entry.id}
              entry={entry}
              disabled={isSaving}
              editingTarget={editingTarget}
              onStartAddSet={handleStartAddSet}
              onStartEditSet={handleStartEditSet}
              onCancelEdit={handleCancelEdit}
              onSaveNewSet={handleSaveNewSet}
              onSaveEditSet={handleSaveEditSet}
              onDeleteSet={handleDeleteSet}
              onDelete={handleDeleteExercise}
            />
          ))}
        </div>
      )}

      {showConfirm && (
        <div className="finish-confirm-overlay">
          <div className="finish-confirm-card">
            <div className="finish-confirm-icon">
              <CheckCircle2 size={22} strokeWidth={1.8} />
            </div>
            <p className="finish-confirm-title">Finish Workout?</p>

            <div className="finish-confirm-summary">
              <div className="finish-confirm-summary__row">
                <span>Exercises</span>
                <strong>{exercises.length}</strong>
              </div>
              <div className="finish-confirm-summary__row">
                <span>Sets</span>
                <strong>{totalSets}</strong>
              </div>
              <div className="finish-confirm-summary__row">
                <span>Duration</span>
                <strong>{formatMinutesLabel(elapsed)}</strong>
              </div>
            </div>

            <div className="finish-confirm-actions">
              <button
                type="button"
                className="finish-confirm-btn finish-confirm-btn--cancel"
                onClick={handleCancelConfirm}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="finish-confirm-btn finish-confirm-btn--confirm"
                onClick={handleConfirmFinish}
                disabled={isSaving}
              >
                Finish Workout
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default WorkoutSession;