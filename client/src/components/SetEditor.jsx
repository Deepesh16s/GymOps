import { useState, useRef, useEffect } from "react";
import "./SetEditor.css";

const isValidNumber = (value) => value !== "" && !isNaN(Number(value));
function SetEditor({
  initialWeight = "",
  initialReps = "",
  onSave,
  onCancel,
  disabled = false,
}) {
  const [weight, setWeight] = useState(
    initialWeight === "" ? "" : String(initialWeight)
  );
  const [reps, setReps] = useState(initialReps === "" ? "" : String(initialReps));
  const [error, setError] = useState("");
  const weightInputRef = useRef(null);
  useEffect(() => {
    weightInputRef.current?.focus();
  }, []);

  const resetFields = () => {
    setWeight("");
    setReps("");
    setError("");
  };

  const handleSave = () => {
    if (disabled) return;

    if (!isValidNumber(weight) || !isValidNumber(reps)) {
      setError("Please enter both weight and reps.");
      return;
    }

    const numWeight = Number(weight);
    const numReps = Number(reps);

    // 0 kg is valid (bodyweight exercises like chin ups, push ups,
    // planks, or any custom exercise the user intentionally logs at
    // 0 kg). Only negative or non-numeric weight is rejected.
    if (numWeight < 0) {
      setError("Enter a valid weight.");
      return;
    }

    if (numReps <= 0 || !Number.isInteger(numReps)) {
      setError("Enter valid reps.");
      return;
    }

    const newSet = { weight: numWeight, reps: numReps };
    resetFields();
    onSave(newSet);
  };

  const handleCancel = () => {
    if (disabled) return;
    resetFields();
    onCancel();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div className="set-editor">
      <div className="set-editor__fields">
        <div className="set-editor__field">
          <label className="set-editor__label">Weight</label>
          <input
            ref={weightInputRef}
            type="number"
            className="set-editor__input"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onKeyDown={handleKeyDown}
            min="0"
            step="0.5"
            placeholder="kg"
            disabled={disabled}
          />
        </div>

        <div className="set-editor__field">
          <label className="set-editor__label">Reps</label>
          <input
            type="number"
            className="set-editor__input"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            onKeyDown={handleKeyDown}
            min="1"
            step="1"
            placeholder="reps"
            disabled={disabled}
          />
        </div>
      </div>

      {error && <p className="set-editor__error">{error}</p>}

      <div className="set-editor__actions">
        <button
          type="button"
          className="set-editor__btn set-editor__btn--cancel"
          onClick={handleCancel}
          disabled={disabled}
        >
          Cancel
        </button>
        <button
          type="button"
          className="set-editor__btn set-editor__btn--save"
          onClick={handleSave}
          disabled={disabled}
        >
          Save
        </button>
      </div>
    </div>
  );
}

export default SetEditor;