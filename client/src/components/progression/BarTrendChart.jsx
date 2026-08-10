import { TrendBadge } from "./TrendChart";
import ProgressBarChart from "./ProgressBarChart";
import "./progression-charts.css";

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
