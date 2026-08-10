import { useState, useEffect } from "react";
import { X, Dumbbell } from "lucide-react";
import { SESSION_TYPES, OTHER_SESSION_TYPE } from "../constants/sessionTypes";
import useModalEscapeAndFocus from "../hooks/useModalEscapeAndFocus";

function StartWorkoutModal({ open, onClose, onStart }) {
  const [sessionType, setSessionType] = useState(SESSION_TYPES[0]);
  const [customSessionType, setCustomSessionType] = useState("");
  const [touchedCustom, setTouchedCustom] = useState(false);

  useEffect(() => {
    if (open) {
      setSessionType(SESSION_TYPES[0]);
      setCustomSessionType("");
      setTouchedCustom(false);
    }
  }, [open]);

  useModalEscapeAndFocus(open, onClose);

  if (!open) return null;

  const isOther = sessionType === OTHER_SESSION_TYPE;
  const trimmedCustom = customSessionType.trim();
  const customIsInvalid = isOther && touchedCustom && !trimmedCustom;
  const canStart = !isOther || !!trimmedCustom;

  const handleStart = () => {
    if (!canStart) {
      setTouchedCustom(true);
      return;
    }
    onStart(sessionType, isOther ? trimmedCustom : null);
  };

  return (
    <div className="start-workout-modal-overlay" role="dialog" aria-modal="true">
      <div className="start-workout-modal-card">
        <div className="start-workout-modal-header">
          <div className="start-workout-modal-icon">
            <Dumbbell size={18} strokeWidth={1.8} />
          </div>
          <p className="start-workout-modal-title">Start Workout</p>
          <button
            type="button"
            className="start-workout-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="start-workout-modal-body">
          <label className="start-workout-modal-label" htmlFor="session-type-select">
            Session Type
          </label>
          <select
            id="session-type-select"
            className="start-workout-modal-select"
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value)}
          >
            {SESSION_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          {isOther && (
            <>
              <label
                className="start-workout-modal-label"
                htmlFor="custom-session-type-input"
              >
                Custom Session Name
              </label>
              <input
                id="custom-session-type-input"
                type="text"
                className="start-workout-modal-input"
                placeholder="e.g. Powerlifting, Mobility, Rehab..."
                value={customSessionType}
                onChange={(e) => setCustomSessionType(e.target.value)}
                onBlur={() => setTouchedCustom(true)}
              />
              {customIsInvalid && (
                <p className="start-workout-modal-error">
                  Enter a custom session name to continue.
                </p>
              )}
            </>
          )}
        </div>

        <div className="start-workout-modal-actions">
          <button
            type="button"
            className="start-workout-modal-btn start-workout-modal-btn--cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="start-workout-modal-btn start-workout-modal-btn--confirm"
            onClick={handleStart}
            disabled={!canStart}
          >
            Start Session
          </button>
        </div>
      </div>
    </div>
  );
}

export default StartWorkoutModal;