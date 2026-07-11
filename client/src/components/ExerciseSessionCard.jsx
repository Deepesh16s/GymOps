import { Pencil, Trash2 } from "lucide-react";
import SetEditor from "./SetEditor";
import "./ExerciseSessionCard.css";

function ExerciseSessionCard({
  entry,
  disabled = false,
  editingTarget,
  onStartAddSet,
  onStartEditSet,
  onCancelEdit,
  onSaveNewSet,
  onSaveEditSet,
  onDeleteSet,
  onDelete,
}) {
  const { exercise, sets } = entry;

  const isAnyEditing = !!editingTarget;
  const isThisAdding =
    editingTarget?.exerciseId === entry.id && editingTarget.setId === null;
  const isThisSetEditing = (setId) =>
    editingTarget?.exerciseId === entry.id && editingTarget?.setId === setId;

  const addSetDisabled = disabled || (isAnyEditing && !isThisAdding);
  const deleteExerciseDisabled = disabled || isAnyEditing;

  return (
    <div className="ex-session-card">
      <div className="ex-session-card__head">
        <div>
          <p className="ex-session-card__name">{exercise.name}</p>
          {exercise.muscleGroup && (
            <span className="ex-session-card__muscle">
              {exercise.muscleGroup}
            </span>
          )}
        </div>
      </div>

      <div className="ex-session-card__sets">
        {sets.map((set, index) =>
          isThisSetEditing(set.id) ? (
            <SetEditor
              key={set.id}
              initialWeight={set.weight}
              initialReps={set.reps}
              onSave={(updated) => onSaveEditSet(entry.id, set.id, updated)}
              onCancel={onCancelEdit}
              disabled={disabled}
            />
          ) : (
            <div className="ex-session-card__set" key={set.id}>
              <span className="ex-session-card__set-label">
                Set {index + 1}
              </span>
              <span className="ex-session-card__set-value">
                {set.weight} kg × {set.reps}
              </span>
              <div className="ex-session-card__set-actions">
                <button
                  type="button"
                  className="ex-session-set-btn"
                  onClick={() => onStartEditSet(entry.id, set.id)}
                  disabled={disabled || isAnyEditing}
                  aria-label={`Edit set ${index + 1}`}
                >
                  <Pencil size={13} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="ex-session-set-btn ex-session-set-btn--danger"
                  onClick={() => onDeleteSet(entry.id, set.id)}
                  disabled={disabled || isAnyEditing}
                  aria-label={`Delete set ${index + 1}`}
                >
                  <Trash2 size={13} strokeWidth={2} />
                </button>
              </div>
            </div>
          )
        )}
      </div>

      {isThisAdding && (
        <SetEditor
          onSave={(set) => onSaveNewSet(entry.id, set)}
          onCancel={onCancelEdit}
          disabled={disabled}
        />
      )}

      <div className="ex-session-card__actions">
        {!isThisAdding && (
          <button
            type="button"
            className="ex-session-btn"
            onClick={() => onStartAddSet(entry.id)}
            disabled={addSetDisabled}
          >
            Add Set
          </button>
        )}
        <button
          type="button"
          className="ex-session-btn ex-session-btn--danger"
          onClick={() => onDelete(entry.id)}
          disabled={deleteExerciseDisabled}
        >
          Delete Exercise
        </button>
      </div>
    </div>
  );
}

export default ExerciseSessionCard;