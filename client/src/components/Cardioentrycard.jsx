import { CARDIO_METRICS } from "../constants/cardioMetadata";
import "./ExerciseSessionCard.css";

// Deliberately separate from ExerciseSessionCard (per Phase 8A rules) —
// cardio entries have no sets to add/edit, just a single record of
// metrics for one activity, so this component only needs to display
// that record and offer a delete action.
function CardioEntryCard({ entry, disabled = false, onDelete }) {
  const { cardio } = entry;
  const { activityType, data } = cardio || {};

  const metricEntries = Object.entries(data || {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );

  return (
    <div className="ex-session-card">
      <div className="ex-session-card__head">
        <div>
          <p className="ex-session-card__name">{activityType}</p>
          <span className="ex-session-card__muscle">Cardio</span>
        </div>
      </div>

      <div className="ex-session-card__sets">
        {metricEntries.length === 0 ? (
          <div className="ex-session-card__set">
            <span className="ex-session-card__set-label">
              No metrics recorded
            </span>
          </div>
        ) : (
          metricEntries.map(([key, value]) => {
            const metric = CARDIO_METRICS[key];
            return (
              <div className="ex-session-card__set" key={key}>
                <span className="ex-session-card__set-label">
                  {metric?.label || key}
                </span>
                <span className="ex-session-card__set-value">
                  {value}
                  {metric?.unit ? ` ${metric.unit}` : ""}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="ex-session-card__actions">
        <button
          type="button"
          className="ex-session-btn ex-session-btn--danger"
          onClick={() => onDelete(entry.id)}
          disabled={disabled}
        >
          Delete Cardio Entry
        </button>
      </div>
    </div>
  );
}

export default CardioEntryCard;