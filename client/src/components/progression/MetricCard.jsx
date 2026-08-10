import { TrendBadge } from "./TrendChart";
import "./progression-charts.css";

function SkeletonSpan() {
  return (
    <span
      className="skeleton"
      style={{ width: 64, height: 20, display: "inline-block", borderRadius: 6 }}
    />
  );
}

function MetricCard({ label, value, sub, icon: Icon, trend, loading = false }) {
  return (
    <div className="metric-card">
      {Icon && (
        <div className="metric-card__icon">
          <Icon size={16} strokeWidth={1.8} />
        </div>
      )}
      <div className="metric-card__body">
        <span className="metric-card__label">{label}</span>
        <span className="metric-card__value">{loading ? <SkeletonSpan /> : value ?? "—"}</span>
        {sub && !loading && <span className="metric-card__sub">{sub}</span>}
      </div>
      {trend && !loading && <TrendBadge trend={trend} />}
    </div>
  );
}

export default MetricCard;
