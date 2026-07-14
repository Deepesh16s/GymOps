import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import ProgressChart from "./ProgressChart";
import "./progression-charts.css";

// Exported (not just used internally) so MetricCard and other Progression
// components can render the same up/down/plateau badge instead of each
// redefining their own icon+color mapping.
export function TrendBadge({ trend }) {
  if (!trend) return null;
  const Icon = trend.direction === "up" ? TrendingUp : trend.direction === "down" ? TrendingDown : Minus;
  const label =
    trend.direction === "flat"
      ? "Holding steady"
      : `${trend.direction === "up" ? "+" : ""}${trend.changePct}%`;

  return (
    <span className={`trend-badge trend-badge--${trend.direction}`}>
      <Icon size={13} strokeWidth={2} />
      {label}
    </span>
  );
}

// Adds title/subtitle chrome + a trend badge (up/down/plateau) around the
// generic ProgressChart. This is the composite every section of the
// Progression page actually renders — Overall, Muscle, and Exercise views
// all use this same shell, just with different data/labels passed in.
function TrendChart({
  title,
  subtitle,
  series,
  metricKey,
  metricDef,
  trend,
  showMovingAverage,
  loading,
  emptyTitle,
  emptyMessage,
  height,
  headerRight,
}) {
  return (
    <div className="trend-chart">
      <div className="trend-chart__head">
        <div>
          {title && <p className="trend-chart__title">{title}</p>}
          {subtitle && <p className="trend-chart__subtitle">{subtitle}</p>}
        </div>
        <div className="trend-chart__head-right">
          {headerRight}
          <TrendBadge trend={trend} />
        </div>
      </div>
      <ProgressChart
        series={series}
        metricKey={metricKey}
        metricDef={metricDef}
        showMovingAverage={showMovingAverage}
        loading={loading}
        emptyTitle={emptyTitle}
        emptyMessage={emptyMessage}
        height={height}
      />
    </div>
  );
}

export default TrendChart;
