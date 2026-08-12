import { useState, useMemo, useEffect } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Repeat,
  Trash2,
  History,
  Sparkles,
  StickyNote,
} from "lucide-react";
import SetRow from "./SetRow";
import PRCelebration from "./PRCelebration";
import {
  getExerciseHistorySnapshot,
  getNextSetSuggestion,
  detectSetPRs,
} from "../progression/liveWorkoutEngine";
import "./ExerciseSessionCard.css";

function ExerciseSessionCard({
  entry,
  disabled = false,
  historicalWorkouts = [],
  onAddSet,
  onUpdateSet,
  onDeleteSet,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
  onDuplicateExercise,
  onReplaceExercise,
  onOpenHistory,
  isCollapsed = false,
  onToggleCollapse,
  onEditingChange,
  onSetCompleted,
  onUpdateNote,
}) {
  const { exercise, sets } = entry;

  const [editingSetId, setEditingSetId] = useState(null);
  const [celebratingPR, setCelebratingPR] = useState(null);
  const [showNoteField, setShowNoteField] = useState(false);

  useEffect(() => {
    onEditingChange?.(entry.id, editingSetId !== null);
  }, [editingSetId, entry.id, onEditingChange]);

  const snapshot = useMemo(
    () => getExerciseHistorySnapshot(historicalWorkouts, exercise._id),
    [historicalWorkouts, exercise._id]
  );

  useEffect(() => {
    if (entry.sets.length > 0) {
      const firstSet = entry.sets[0];
      const pr = detectSetPRs(snapshot, firstSet, []);
      if (pr) setCelebratingPR(pr);
      onSetCompleted?.(exercise, pr);
    }
  }, []);

  const suggestion = useMemo(() => getNextSetSuggestion(snapshot, sets), [snapshot, sets]);

  const autofill = useMemo(() => {
    const lastInSession = sets[sets.length - 1];
    if (lastInSession) return { weight: lastInSession.weight, reps: lastInSession.reps };

    const historical = snapshot?.lastSession;
    if (historical?.length) {
      const match = historical[sets.length] || historical[historical.length - 1];
      if (match) return { weight: match.weight, reps: match.reps };
    }

    return null;
  }, [sets, snapshot]);

  const [pendingWeight, setPendingWeight] = useState(autofill?.weight ?? "");
  const [pendingReps, setPendingReps] = useState(autofill?.reps ?? "");

  useEffect(() => {
    setPendingWeight(autofill?.weight ?? "");
    setPendingReps(autofill?.reps ?? "");
  }, [sets]);

  const handleCompletePending = (set) => {
    onAddSet(entry.id, set);
    const pr = detectSetPRs(snapshot, set, sets);
    if (pr) setCelebratingPR(pr);
    onSetCompleted?.(exercise, pr);
  };

  const handleUseSuggestion = () => {
    if (!suggestion) return;
    setPendingWeight(String(suggestion.weight));
    setPendingReps(String(suggestion.reps));
  };

  const showSuggestionChip =
    suggestion &&
    (!autofill || suggestion.weight !== autofill.weight || suggestion.reps !== autofill.reps);

  const lastWorkoutLabel = snapshot?.lastSession?.length
    ? snapshot.lastSession.map((s) => `${s.weight}×${s.reps}`).join(", ")
    : null;

  return (
    <div className="ex-session-card">
      <div className="ex-session-card__head">
        <button
          type="button"
          className="ex-session-card__collapse-btn"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? "Expand exercise" : "Collapse exercise"}
        >
          {isCollapsed ? (
            <ChevronRight size={15} strokeWidth={2} />
          ) : (
            <ChevronDown size={15} strokeWidth={2} />
          )}
        </button>

        <div className="ex-session-card__title">
          <p className="ex-session-card__name">{exercise.name}</p>
          {exercise.muscleGroup && (
            <span className="ex-session-card__muscle">{exercise.muscleGroup}</span>
          )}
        </div>

        <div className="ex-session-card__head-actions">
          <button
            type="button"
            className="ex-session-icon-btn"
            onClick={onMoveUp}
            disabled={disabled || isFirst}
            aria-label="Move exercise up"
            title="Move up"
          >
            <ChevronUp size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="ex-session-icon-btn"
            onClick={onMoveDown}
            disabled={disabled || isLast}
            aria-label="Move exercise down"
            title="Move down"
          >
            <ChevronDown size={14} strokeWidth={2} />
          </button>
          {onOpenHistory && (
            <button
              type="button"
              className="ex-session-icon-btn"
              onClick={() => onOpenHistory(entry)}
              disabled={disabled}
              aria-label="View exercise history"
              title="View history"
            >
              <History size={14} strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            className="ex-session-icon-btn"
            onClick={() => setShowNoteField((prev) => !prev)}
            disabled={disabled}
            aria-label="Add exercise note"
            title="Add note"
          >
            <StickyNote size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="ex-session-icon-btn"
            onClick={() => onDuplicateExercise?.(entry.id)}
            disabled={disabled}
            aria-label="Duplicate exercise"
            title="Duplicate exercise"
          >
            <Copy size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="ex-session-icon-btn"
            onClick={() => onReplaceExercise?.(entry.id)}
            disabled={disabled}
            aria-label="Replace exercise"
            title="Replace exercise"
          >
            <Repeat size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="ex-session-icon-btn ex-session-icon-btn--danger"
            onClick={() => onDelete(entry.id)}
            disabled={disabled}
            aria-label="Remove exercise"
            title="Remove exercise"
          >
            <Trash2 size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {(lastWorkoutLabel || snapshot?.bestSet) && (
            <div className="ex-session-card__history">
              {lastWorkoutLabel && (
                <span>
                  <strong>Last Workout</strong> {lastWorkoutLabel}
                </span>
              )}
              {snapshot?.bestSet && (
                <span>
                  <strong>Best Set</strong> {snapshot.bestSet.weight}×{snapshot.bestSet.reps}
                </span>
              )}
            </div>
          )}

          {celebratingPR && (
            <PRCelebration
              pr={celebratingPR}
              exerciseName={exercise.name}
              onDismiss={() => setCelebratingPR(null)}
            />
          )}

          {showNoteField && (
            <textarea
              className="ex-session-card__note-field"
              placeholder="Note for this exercise (e.g. Shoulder slightly sore.)"
              value={entry.note || ""}
              onChange={(e) => onUpdateNote?.(e.target.value)}
              disabled={disabled}
              rows={2}
            />
          )}

          <div className="ex-session-card__sets">
            <div className="ex-session-card__sets-head">
              <span>Set</span>
              <span>Weight</span>
              <span>Reps</span>
              <span />
            </div>

            {sets.map((set, index) =>
              editingSetId === set.id ? (
                <SetRow
                  key={set.id}
                  index={index + 1}
                  weight={set.weight}
                  reps={set.reps}
                  status="completed"
                  isEditing
                  onCancelEdit={() => setEditingSetId(null)}
                  onComplete={(updated) => {
                    onUpdateSet(entry.id, set.id, updated);
                    setEditingSetId(null);
                  }}
                  onDelete={() => onDeleteSet(entry.id, set.id)}
                  disabled={disabled}
                />
              ) : (
                <SetRow
                  key={set.id}
                  index={index + 1}
                  weight={set.weight}
                  reps={set.reps}
                  status="completed"
                  onStartEdit={() => setEditingSetId(set.id)}
                  onDelete={() => onDeleteSet(entry.id, set.id)}
                  disabled={disabled}
                />
              )
            )}

            <SetRow
              key={`pending-${sets.length}`}
              index={sets.length + 1}
              weight={pendingWeight}
              reps={pendingReps}
              status="pending"
              onComplete={handleCompletePending}
              onDelete={() => {
                setPendingWeight("");
                setPendingReps("");
              }}
              disabled={disabled}
              autoFocus
            />
          </div>

          <div className="ex-session-card__quick-actions">
            {autofill && (
              <button
                type="button"
                className="ex-session-quick-btn"
                onClick={() => handleCompletePending({ weight: autofill.weight, reps: autofill.reps })}
                disabled={disabled}
              >
                Duplicate Previous Set
              </button>
            )}
            {showSuggestionChip && (
              <button
                type="button"
                className="ex-session-quick-btn ex-session-quick-btn--suggestion"
                onClick={handleUseSuggestion}
                disabled={disabled}
              >
                <Sparkles size={12} strokeWidth={2} />
                Suggestion: {suggestion.weight} kg × {suggestion.reps}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ExerciseSessionCard;
