import { formatDate } from "../../utils/dateUtils";
import { MUSCLE_DOT_COLORS } from "../../constants/muscles";
import { formatCardioPrLabel } from "../../utils/workoutUtils";
import "./progression-charts.css";

function PersonalRecordRow({ record }) {
  if (record.isCardio) {
    return (
      <div className="prog-pr__row">
        <div className="prog-pr__row-main">
          <p className="prog-pr__row-name">
            <span className="prog-pr__row-name-text" title={record.activityType}>
              {record.activityType}
            </span>
          </p>
          <p className="prog-pr__row-date">{formatDate(record.date)}</p>
        </div>
        <div className="prog-pr__row-figures">
          <span className="prog-pr__row-weight">{formatCardioPrLabel(record)}</span>
        </div>
      </div>
    );
  }

  const dotColor = MUSCLE_DOT_COLORS[record.muscle] || "var(--go-text-faint)";
  return (
    <div className="prog-pr__row">
      <div className="prog-pr__row-main">
        <p className="prog-pr__row-name">
          {record.muscle && (
            <span className="prog-pr__row-dot" style={{ background: dotColor }} title={record.muscle} />
          )}
          <span className="prog-pr__row-name-text" title={record.exercise}>
            {record.exercise}
          </span>
        </p>
        <p className="prog-pr__row-date">{formatDate(record.date)}</p>
      </div>
      <div className="prog-pr__row-figures">
        <span className="prog-pr__row-weight">{record.weight} kg</span>
        <span className="prog-pr__row-est">Est. 1RM {record.estOneRM} kg</span>
      </div>
    </div>
  );
}

export default PersonalRecordRow;
