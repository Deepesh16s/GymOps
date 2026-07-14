import { TrendBadge } from "./TrendChart";
import "./progression-charts.css";

// A merged KPI tile — several related stat rows under one title, instead
// of one MetricCard per number. Analytics' Hero uses this to cut ~9
// single-value cards down to 3 grouped ones (Training / Strength & Volume
// / Muscle Focus) so a reader isn't scanning nine tiles for one answer.
function StatGroupCard({ title, icon: Icon, rows = [] }) {
  return (
    <div className="stat-group-card">
      <div className="stat-group-card__head">
        {Icon && <Icon size={15} strokeWidth={1.8} />}
        <span>{title}</span>
      </div>
      <div className="stat-group-card__rows">
        {rows.map((row) => (
          <div className="stat-group-card__row" key={row.label}>
            <span className="stat-group-card__row-label">{row.label}</span>
            <span className="stat-group-card__row-figures">
              <span className="stat-group-card__row-value">{row.value}</span>
              {row.trend && <TrendBadge trend={row.trend} />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StatGroupCard;
