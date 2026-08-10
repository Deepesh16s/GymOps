import { useState, useEffect, useRef } from "react";
import { Check, X, Pencil, Trash2 } from "lucide-react";
import "./SetRow.css";

const isValidNumber = (value) => value !== "" && !isNaN(Number(value));

const toFieldValue = (value) => (value === "" || value == null ? "" : String(value));

function SetRow({
  index,
  weight,
  reps,
  status,
  isEditing = false,
  onStartEdit,
  onCancelEdit,
  onComplete,
  onDelete,
  disabled = false,
  autoFocus = false,
}) {
  const [localWeight, setLocalWeight] = useState(toFieldValue(weight));
  const [localReps, setLocalReps] = useState(toFieldValue(reps));
  const [error, setError] = useState("");
  const weightInputRef = useRef(null);

  useEffect(() => {
    setLocalWeight(toFieldValue(weight));
    setLocalReps(toFieldValue(reps));
  }, [weight, reps]);

  useEffect(() => {
    if (autoFocus) weightInputRef.current?.focus();
  }, [autoFocus]);

  const editable = status === "pending" || isEditing;

  const resetToProps = () => {
    setLocalWeight(toFieldValue(weight));
    setLocalReps(toFieldValue(reps));
    setError("");
  };

  const handleComplete = () => {
    if (disabled) return;

    if (!isValidNumber(localWeight) || !isValidNumber(localReps)) {
      setError("Enter weight and reps.");
      return;
    }

    const numWeight = Number(localWeight);
    const numReps = Number(localReps);

    if (numWeight < 0) {
      setError("Enter a valid weight.");
      return;
    }
    if (numReps <= 0 || !Number.isInteger(numReps)) {
      setError("Enter valid reps.");
      return;
    }

    setError("");
    onComplete({ weight: numWeight, reps: numReps });
  };

  const handleCancelEdit = () => {
    if (disabled) return;
    resetToProps();
    onCancelEdit();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleComplete();
    } else if (e.key === "Escape" && isEditing) {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  return (
    <div
      className={`set-row set-row--${status}${editable ? " set-row--editing" : ""}`}
    >
      <div className="set-row__main">
        <span className="set-row__index">{index}</span>

        <input
          ref={weightInputRef}
          type="number"
          className="set-row__input"
          value={localWeight}
          onChange={(e) => setLocalWeight(e.target.value)}
          onKeyDown={handleKeyDown}
          min="0"
          step="0.5"
          placeholder="kg"
          disabled={disabled || !editable}
          aria-label={`Set ${index} weight`}
        />

        <input
          type="number"
          className="set-row__input"
          value={localReps}
          onChange={(e) => setLocalReps(e.target.value)}
          onKeyDown={handleKeyDown}
          min="1"
          step="1"
          placeholder="reps"
          disabled={disabled || !editable}
          aria-label={`Set ${index} reps`}
        />

        <div className="set-row__actions">
          {status === "completed" && !isEditing && (
            <button
              type="button"
              className="set-row__btn"
              onClick={onStartEdit}
              disabled={disabled}
              aria-label={`Edit set ${index}`}
            >
              <Pencil size={13} strokeWidth={2} />
            </button>
          )}

          {editable && (
            <button
              type="button"
              className="set-row__btn set-row__btn--complete"
              onClick={handleComplete}
              disabled={disabled}
              aria-label={status === "pending" ? `Complete set ${index}` : `Save set ${index}`}
            >
              <Check size={15} strokeWidth={2.5} />
            </button>
          )}

          {isEditing && (
            <button
              type="button"
              className="set-row__btn"
              onClick={handleCancelEdit}
              disabled={disabled}
              aria-label={`Cancel editing set ${index}`}
            >
              <X size={13} strokeWidth={2} />
            </button>
          )}

          <button
            type="button"
            className="set-row__btn set-row__btn--danger"
            onClick={onDelete}
            disabled={disabled}
            aria-label={`Delete set ${index}`}
          >
            <Trash2 size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      {error && <p className="set-row__error">{error}</p>}
    </div>
  );
}

export default SetRow;
