import { useEffect, useState, useMemo, useCallback } from "react";
import { Dumbbell, Plus, Activity, X, CheckCircle2, Loader2, StickyNote } from "lucide-react";
import ExerciseSessionCard from "./ExerciseSessionCard";
import CardioEntryCard from "./CardioEntryCard";
import RestTimer from "./RestTimer";
import ExerciseHistoryDrawer from "./ExerciseHistoryDrawer";
import { calculateVolume } from "../utils/strengthUtils";
import { getDefaultRestSeconds } from "../progression/liveWorkoutEngine";
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
  entryCount,
  entries,
  historicalWorkouts = [],
  onAddExercise,
  onAddCardio,
  onDiscard,
  onRemoveEntry,
  onAddSet,
  onDeleteSet,
  onUpdateSet,
  onReorderEntry,
  onDuplicateEntry,
  onReplaceEntry,
  sessionNote,
  onSessionNoteChange,
  onUpdateEntryNote,
  onFinishWorkout,
  isSaving,
  saveError,
}) {
  const [now, setNow] = useState(Date.now());
  const [showConfirm, setShowConfirm] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const [showNoteField, setShowNoteField] = useState(false);
  const [historyEntryId, setHistoryEntryId] = useState(null);

  // Stable across the elapsed-clock's every-second re-render (unlike an
  // inline arrow function, which would be a new reference every tick and
  // defeat ExerciseHistoryDrawer's memo — see that file's export comment).
  const handleCloseHistory = useCallback(() => setHistoryEntryId(null), []);
  const handleUpdateHistoryNote = useCallback(
    (note) => onUpdateEntryNote(historyEntryId, note),
    [historyEntryId, onUpdateEntryNote]
  );

  // A card only reports itself here while it's mid-edit of an
  // already-completed set (the always-visible pending row never counts —
  // see ExerciseSessionCard) — so Finish/Discard/Add stay usable during
  // normal set logging, matching Strong/Hevy's fluid feel, while still
  // protecting an in-progress correction to a past set from being
  // silently abandoned by a navigation click.
  const [editingEntryIds, setEditingEntryIds] = useState(() => new Set());
  const isEditingActive = editingEntryIds.size > 0;

  // One shared rest timer for the whole session (Batch 3) — null until
  // the first set is completed, then re-armed on every subsequent
  // completion regardless of which exercise it came from.
  const [restTimer, setRestTimer] = useState(null);
  // Distinct exercises (by _id, not by PR-event count) that had at least
  // one set flagged as some kind of PR this session — "PR in 2
  // exercises" reads more meaningfully than a raw event count, which
  // would double-count an exercise where multiple sets in the same
  // session each broke the record. Captured here (not recomputed later)
  // since this is the only place with access to each exercise's live PR
  // check as it happens; passed up via onFinishWorkout since this
  // component unmounts once the session finishes.
  const [prExerciseIds, setPrExerciseIds] = useState(() => new Set());
  const handleSetCompleted = (exercise, pr) => {
    setRestTimer({ seconds: getDefaultRestSeconds(exercise?.name), trigger: Date.now() });
    if (pr && exercise?._id) {
      setPrExerciseIds((prev) => new Set(prev).add(exercise._id));
    }
  };

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsed = startTime ? now - startTime : 0;
  const hasEntries = entries.length > 0;

  // Total sets only counts strength entries — cardio entries have no
  // `sets` array.
  const totalSets = entries.reduce(
    (sum, entry) =>
      sum + (entry.entryType === "cardio" ? 0 : entry.sets.length),
    0
  );

  const totalVolume = useMemo(
    () =>
      entries.reduce(
        (sum, entry) =>
          sum + (entry.entryType === "cardio" ? 0 : calculateVolume(entry.sets)),
        0
      ),
    [entries]
  );

  const handleEntryEditingChange = (entryId, isEditing) => {
    setEditingEntryIds((prev) => {
      const next = new Set(prev);
      if (isEditing) next.add(entryId);
      else next.delete(entryId);
      return next;
    });
  };

  // Deleting the last remaining set of an exercise removes the exercise
  // itself (see useWorkoutSession.deleteSet), so that specific case gets
  // an explicit confirmation. Any other set is deleted immediately.
  const handleDeleteSet = (exerciseId, setId) => {
    if (isSaving) return;

    const entry = entries.find((e) => e.id === exerciseId);
    const isLastSet =
      entry && entry.entryType !== "cardio" && entry.sets.length === 1;

    if (isLastSet) {
      const confirmed = window.confirm(
        "Deleting this set will remove the exercise. Continue?"
      );
      if (!confirmed) return;
    }

    onDeleteSet(exerciseId, setId);
  };

  const handleDeleteExercise = (exerciseId) => {
    if (isSaving) return;

    const confirmed = window.confirm(
      "Remove this exercise from the current workout?"
    );
    if (!confirmed) return;

    onRemoveEntry(exerciseId);
  };

  const handleDeleteCardioEntry = (entryId) => {
    if (isSaving) return;

    const confirmed = window.confirm(
      "Remove this cardio entry from the current workout?"
    );
    if (!confirmed) return;

    onRemoveEntry(entryId);
  };

  const handleToggleCollapse = (entryId) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const handleAddExerciseClick = () => {
    if (isSaving || isEditingActive) return;
    onAddExercise();
  };

  const handleAddCardioClick = () => {
    if (isSaving || isEditingActive) return;
    onAddCardio();
  };

  const handleDiscardClick = () => {
    if (isSaving || isEditingActive) return;
    onDiscard();
  };

  const handleFinishClick = () => {
    if (isSaving || !hasEntries || isEditingActive) return;
    setShowConfirm(true);
  };

  const handleCancelConfirm = () => {
    if (isSaving) return;
    setShowConfirm(false);
  };

  const handleConfirmFinish = async () => {
    if (isSaving) return;
    setShowConfirm(false);
    await onFinishWorkout({
      durationMinutes: Math.round(elapsed / 60000),
      totalVolume,
      exerciseCount: entries.length,
      setCount: totalSets,
      prExerciseCount: prExerciseIds.size,
    });
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
                {entryCount} {entryCount === 1 ? "entry" : "entries"}
              </span>
              <span className="session-card__dot" />
              <span>
                {totalSets} {totalSets === 1 ? "set" : "sets"}
              </span>
              <span className="session-card__dot" />
              <span>{Math.round(totalVolume).toLocaleString()} kg</span>
            </div>
          </div>
        </div>

        <div className="session-card__actions">
          <button
            type="button"
            className="cta-btn"
            onClick={() => setShowNoteField((prev) => !prev)}
            disabled={isSaving}
          >
            <StickyNote size={16} strokeWidth={2.5} />
            {sessionNote ? "Edit Note" : "Add Note"}
          </button>
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
            className="cta-btn"
            onClick={handleAddCardioClick}
            disabled={isSaving || isEditingActive}
          >
            <Activity size={16} strokeWidth={2.5} />
            Add Cardio
          </button>
          <button
            type="button"
            className="session-finish-btn"
            onClick={handleFinishClick}
            disabled={isSaving || !hasEntries || isEditingActive}
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

      {showNoteField && (
        <textarea
          className="session-note-field"
          placeholder="How did this workout feel? (e.g. Felt strong today.)"
          value={sessionNote || ""}
          onChange={(e) => onSessionNoteChange(e.target.value)}
          disabled={isSaving}
          rows={2}
        />
      )}

      {hasEntries && (
        <div className="session-card__exercises">
          {entries.map((entry, index) =>
            entry.entryType === "cardio" ? (
              <CardioEntryCard
                key={entry.id}
                entry={entry}
                disabled={isSaving}
                onDelete={handleDeleteCardioEntry}
              />
            ) : (
              <ExerciseSessionCard
                key={entry.id}
                entry={entry}
                disabled={isSaving}
                historicalWorkouts={historicalWorkouts}
                onAddSet={onAddSet}
                onUpdateSet={onUpdateSet}
                onDeleteSet={handleDeleteSet}
                onDelete={handleDeleteExercise}
                onMoveUp={() => onReorderEntry(entry.id, "up")}
                onMoveDown={() => onReorderEntry(entry.id, "down")}
                isFirst={index === 0}
                isLast={index === entries.length - 1}
                onDuplicateExercise={onDuplicateEntry}
                onReplaceExercise={onReplaceEntry}
                onOpenHistory={(e) => setHistoryEntryId(e.id)}
                isCollapsed={collapsedIds.has(entry.id)}
                onToggleCollapse={() => handleToggleCollapse(entry.id)}
                onEditingChange={handleEntryEditingChange}
                onSetCompleted={handleSetCompleted}
                onUpdateNote={(note) => onUpdateEntryNote(entry.id, note)}
              />
            )
          )}
        </div>
      )}

      {restTimer && (
        <RestTimer initialSeconds={restTimer.seconds} restartTrigger={restTimer.trigger} />
      )}

      {historyEntryId !== null && (
        <ExerciseHistoryDrawer
          open
          onClose={handleCloseHistory}
          entry={entries.find((e) => e.id === historyEntryId) || null}
          historicalWorkouts={historicalWorkouts}
          onUpdateNote={handleUpdateHistoryNote}
        />
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
                <span>Entries</span>
                <strong>{entries.length}</strong>
              </div>
              <div className="finish-confirm-summary__row">
                <span>Sets</span>
                <strong>{totalSets}</strong>
              </div>
              <div className="finish-confirm-summary__row">
                <span>Volume</span>
                <strong>{Math.round(totalVolume).toLocaleString()} kg</strong>
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