import { useState } from "react";
import {
  CARDIO_ACTIVITY_TYPES,
  CARDIO_METRICS,
  getActivityMetrics,
} from "../constants/cardioMetadata";
import "./AddWorkoutModal.css";

// Kept as its own modal (not merged into AddWorkoutModal), matching the
// existing Exercise flow's pattern: takes closeModal/onAddCardio, returns
// data only, and leaves all session-state decisions to the caller.
function AddCardioModal({ closeModal, onAddCardio }) {
  const [activityType, setActivityType] = useState(CARDIO_ACTIVITY_TYPES[0]);
  const [metricValues, setMetricValues] = useState({});
  const [validationMessage, setValidationMessage] = useState("");

  const { requiredMetrics, optionalMetrics } = getActivityMetrics(activityType);
  const visibleMetrics = [...requiredMetrics, ...optionalMetrics];

  const handleActivityChange = (e) => {
    setActivityType(e.target.value);
    setMetricValues({});
    setValidationMessage("");
  };

  const handleMetricChange = (key, value) => {
    setMetricValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationMessage("");

    for (const key of requiredMetrics) {
      const value = metricValues[key];
      if (
        value === undefined ||
        value === "" ||
        isNaN(Number(value)) ||
        Number(value) < 0
      ) {
        const label = CARDIO_METRICS[key]?.label || key;
        setValidationMessage(`${label} is required for ${activityType}`);
        return;
      }
    }

    for (const key of optionalMetrics) {
      const value = metricValues[key];
      if (value === undefined || value === "") continue;
      if (isNaN(Number(value)) || Number(value) < 0) {
        const label = CARDIO_METRICS[key]?.label || key;
        setValidationMessage(`${label} must be a valid non-negative number`);
        return;
      }
    }

    const data = {};
    visibleMetrics.forEach((key) => {
      const value = metricValues[key];
      if (value !== undefined && value !== "") {
        data[key] = Number(value);
      }
    });

    // Return data only. No branching on session state, no API call here —
    // that decision belongs to whoever opened this modal (mirrors
    // AddWorkoutModal.handleSubmit).
    onAddCardio({
      cardio: {
        activityType,
        data,
      },
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <button className="close-btn" onClick={closeModal}>
          ✕
        </button>

        <h2>Add Cardio</h2>

        <form onSubmit={handleSubmit}>
          <label>Activity Type</label>

          <select value={activityType} onChange={handleActivityChange}>
            {CARDIO_ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          {visibleMetrics.map((key) => {
            const metric = CARDIO_METRICS[key];
            const isRequired = requiredMetrics.includes(key);

            return (
              <div key={key}>
                <label>
                  {metric?.label || key}
                  {metric?.unit ? ` (${metric.unit})` : ""}
                  {isRequired ? " *" : ""}
                </label>
                <div className="single-set-row">
                  <input
                    type="number"
                    placeholder={metric?.label || key}
                    value={metricValues[key] ?? ""}
                    onChange={(e) => handleMetricChange(key, e.target.value)}
                    min="0"
                    step="any"
                  />
                </div>
              </div>
            );
          })}

          {validationMessage && (
            <p className="form-error">{validationMessage}</p>
          )}

          <button className="save-btn" type="submit">
            Add Cardio
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddCardioModal;