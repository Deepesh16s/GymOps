import { TrendBadge } from "./TrendChart";
import ProgressBarChart from "./ProgressBarChart";
import "./progression-charts.css";

// Bar-chart sibling of TrendChart — same title/subtitle/trend-badge
// shell, wrapping ProgressBarChart instead of the area-based
// ProgressChart. Analytics' Training Overview uses this so its per-period
// summaries read as bars, staying visually distinct from Progression's
// own continuous trend-line explorer for the same underlying series.
function BarTrendChart({
  title,
  subtitle,
  series,
  metricKey,
  metricDef,
  trend,
  loading,
  emptyTitle,
  emptyMessage,
  height,
}) {
  return (
    <div className="trend-chart">
      <div className="trend-chart__head">
        <div>
          {title && <p className="trend-chart__title">{title}</p>}
          {subtitle && <p className="trend-chart__subtitle">{subtitle}</p>}
        </div>
        <div className="trend-chart__head-right">
          <TrendBadge trend={trend} />
        </div>
      </div>
      <ProgressBarChart
        series={series}
        metricKey={metricKey}
        metricDef={metricDef}
        loading={loading}
        emptyTitle={emptyTitle}
        emptyMessage={emptyMessage}
        height={height}
      />
    </div>
  );
}

export default BarTrendChart;
