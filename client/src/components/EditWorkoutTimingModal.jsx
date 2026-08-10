import { useState, useEffect } from "react";
import { X, Clock } from "lucide-react";
import { updateSessionTiming } from "../services/workoutService";
import { toDateTimeLocalValue, formatDurationLong } from "../utils/timeFormat";
import useModalEscapeAndFocus from "../hooks/useModalEscapeAndFocus";
import "./EditWorkoutTimingModal.css";

const EIGHT_HOURS_MINUTES = 8 * 60;

function minutesToHm(totalMinutes) {
  const total = Math.max(0, Math.round(totalMinutes || 0));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

function EditWorkoutTimingModal({ open, onClose, session, onSaved }) {
  const [mode, setMode] = useState("AUTO");
  const [startValue, setStartValue] = useState("");
  const [endValue, setEndValue] = useState("");
  const [durationHours, setDurationHours] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [anchorField, setAnchorField] = useState("start");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !session) return;

    const initialMode = session.timingMode || "AUTO";
    const fallbackStart = session.startedAt || session.date;
    const fallbackDurationMinutes = session.sessionDuration || 0;
    const fallbackEnd =
      session.endedAt ||
      (fallbackStart
        ? new Date(new Date(fallbackStart).getTime() + fallbackDurationMinutes * 60000)
        : null);

    setMode(initialMode);
    setStartValue(toDateTimeLocalValue(fallbackStart));
    setEndValue(toDateTimeLocalValue(fallbackEnd));
    const { hours, minutes } = minutesToHm(fallbackDurationMinutes);
    setDurationHours(hours);
    setDurationMinutes(minutes);
    setAnchorField("start");
    setError(null);
  }, [open, session]);

  useModalEscapeAndFocus(open, onClose);

  if (!open || !session) return null;

  const durationTotalMinutes = durationHours * 60 + durationMinutes;

  const recomputeDurationFromTimes = (start, end) => {
    if (!start || !end) return;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return;
    const diffMinutes = Math.round((endDate - startDate) / 60000);
    const { hours, minutes } = minutesToHm(Math.max(diffMinutes, 0));
    setDurationHours(hours);
    setDurationMinutes(minutes);
  };

  const handleStartChange = (value) => {
    setStartValue(value);
    setAnchorField("start");
    if (mode === "AUTO") {
      recomputeDurationFromTimes(value, endValue);
    } else if (value) {
      const newEnd = new Date(new Date(value).getTime() + durationTotalMinutes * 60000);
      setEndValue(toDateTimeLocalValue(newEnd));
    }
  };

  const handleEndChange = (value) => {
    setEndValue(value);
    setAnchorField("end");
    if (mode === "AUTO") {
      recomputeDurationFromTimes(startValue, value);
    } else if (value) {
      const newStart = new Date(new Date(value).getTime() - durationTotalMinutes * 60000);
      setStartValue(toDateTimeLocalValue(newStart));
    }
  };

  const handleDurationChange = (hours, minutes) => {
    setDurationHours(hours);
    setDurationMinutes(minutes);
    const totalMinutes = hours * 60 + minutes;
    if (anchorField === "start" && startValue) {
      const newEnd = new Date(new Date(startValue).getTime() + totalMinutes * 60000);
      setEndValue(toDateTimeLocalValue(newEnd));
    } else if (anchorField === "end" && endValue) {
      const newStart = new Date(new Date(endValue).getTime() - totalMinutes * 60000);
      setStartValue(toDateTimeLocalValue(newStart));
    }
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (newMode === "AUTO") {
      recomputeDurationFromTimes(startValue, endValue);
    }
  };

  const warning =
    durationTotalMinutes > EIGHT_HOURS_MINUTES
      ? "This workout is longer than 8 hours — double-check the times if that wasn't intentional."
      : null;

  const handleSave = async () => {
    setError(null);

    if (mode === "AUTO" && (!startValue || !endValue)) {
      setError("Enter both a start time and an end time.");
      return;
    }

    if (startValue && endValue && new Date(endValue) <= new Date(startValue)) {
      setError("End time must be after start time.");
      return;
    }

    if (durationTotalMinutes < 1) {
      setError("Duration must be at least 1 minute.");
      return;
    }

    setSaving(true);
    try {
      const res = await updateSessionTiming(session.sessionId, {
        startedAt: startValue ? new Date(startValue).toISOString() : null,
        endedAt: endValue ? new Date(endValue).toISOString() : null,
        sessionDuration: durationTotalMinutes,
        timingMode: mode,
      });
      onSaved(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save workout timing. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="edit-timing-modal-overlay" role="dialog" aria-modal="true">
      <div className="edit-timing-modal-card">
        <div className="edit-timing-modal-header">
          <div className="edit-timing-modal-icon">
            <Clock size={18} strokeWidth={1.8} />
          </div>
          <div className="edit-timing-modal-heading">
            <p className="edit-timing-modal-title">Edit Workout Timing</p>
            <p className="edit-timing-modal-subtitle">
              Update the start time, end time or duration if this workout wasn't logged in
              real time.
            </p>
          </div>
          <button
            type="button"
            className="edit-timing-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="edit-timing-modal-body">
          <label className="edit-timing-modal-label" htmlFor="edit-timing-start">
            Start Time
          </label>
          <input
            id="edit-timing-start"
            type="datetime-local"
            className="edit-timing-modal-input"
            value={startValue}
            onChange={(e) => handleStartChange(e.target.value)}
          />

          <label className="edit-timing-modal-label" htmlFor="edit-timing-end">
            End Time
          </label>
          <input
            id="edit-timing-end"
            type="datetime-local"
            className="edit-timing-modal-input"
            value={endValue}
            onChange={(e) => handleEndChange(e.target.value)}
          />

          <span className="edit-timing-modal-label">Duration</span>
          <div className="edit-timing-modal-duration-row">
            <div className="edit-timing-modal-duration-field">
              <input
                type="number"
                min="0"
                className="edit-timing-modal-input edit-timing-modal-input--number"
                value={durationHours}
                disabled={mode === "AUTO"}
                onChange={(e) =>
                  handleDurationChange(Math.max(0, Number(e.target.value) || 0), durationMinutes)
                }
              />
              <span className="edit-timing-modal-duration-unit">hr</span>
            </div>
            <div className="edit-timing-modal-duration-field">
              <input
                type="number"
                min="0"
                max="59"
                className="edit-timing-modal-input edit-timing-modal-input--number"
                value={durationMinutes}
                disabled={mode === "AUTO"}
                onChange={(e) =>
                  handleDurationChange(
                    durationHours,
                    Math.min(59, Math.max(0, Number(e.target.value) || 0))
                  )
                }
              />
              <span className="edit-timing-modal-duration-unit">min</span>
            </div>
            <span className="edit-timing-modal-duration-preview">
              {formatDurationLong(durationTotalMinutes)}
            </span>
          </div>

          <div className="edit-timing-modal-divider" />

          <label className="edit-timing-modal-radio">
            <input
              type="radio"
              name="timing-mode"
              checked={mode === "AUTO"}
              onChange={() => handleModeChange("AUTO")}
            />
            Calculate duration automatically
          </label>
          <label className="edit-timing-modal-radio">
            <input
              type="radio"
              name="timing-mode"
              checked={mode === "MANUAL"}
              onChange={() => handleModeChange("MANUAL")}
            />
            Enter duration manually
          </label>

          {warning && !error && (
            <p className="edit-timing-modal-warning">{warning}</p>
          )}
          {error && <p className="edit-timing-modal-error">{error}</p>}
        </div>

        <div className="edit-timing-modal-actions">
          <button
            type="button"
            className="edit-timing-modal-btn edit-timing-modal-btn--cancel"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="edit-timing-modal-btn edit-timing-modal-btn--confirm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditWorkoutTimingModal;
