import { useId, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { ChartSkeleton, ChartEmptyState } from "./ChartStates";
import "./progression-charts.css";

function BarTooltip({ active, payload, label, metricDef }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;

  if (!point?.hasData) {
    return (
      <div className="progress-chart__tooltip">
        <p className="progress-chart__tooltip-label">{label}</p>
        <p className="progress-chart__tooltip-row progress-chart__tooltip-row--muted">
          <span className="progress-chart__tooltip-note">No workout logged</span>
        </p>
      </div>
    );
  }

  return (
    <div className="progress-chart__tooltip">
      <p className="progress-chart__tooltip-label">{label}</p>
      <p className="progress-chart__tooltip-row">
        <span className="progress-chart__tooltip-value">{metricDef.format(point.value)}</span>
      </p>
    </div>
  );
}

// Bar-chart sibling of ProgressChart — same series/metricDef contract
// (progressionEngine.buildProgressionSeries output), rendered as discrete
// per-period bars instead of a continuous area. Used where "how much per
// period" reads better as bars (Analytics' Training Overview) than as the
// continuous trend line Progression's own Advanced Analytics already
// renders for the same underlying series.
function ProgressBarChart({
  series = [],
  metricKey,
  metricDef,
  height = 260,
  loading = false,
  emptyTitle,
  emptyMessage,
}) {
  const gradientId = useId();

  const chartData = useMemo(
    () => series.map((point) => ({ label: point.label, value: point[metricKey], hasData: point.hasData })),
    [series, metricKey]
  );

  if (loading) return <ChartSkeleton height={height} />;

  const hasAnyData = chartData.some((p) => p.hasData);
  if (!hasAnyData) {
    return (
      <ChartEmptyState
        height={height}
        title={emptyTitle || "No data for this view yet"}
        message={emptyMessage || "Log a few sessions and this chart will fill in."}
      />
    );
  }

  return (
    <div className="progress-chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`bar-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--go-chart-accent)" stopOpacity={1} />
              <stop offset="100%" stopColor="var(--go-chart-accent)" stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--go-border-soft)" strokeDasharray="0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--go-text-faint)" }}
            axisLine={{ stroke: "var(--go-border-soft)" }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--go-text-faint)" }}
            axisLine={false}
            tickLine={false}
            width={44}
            domain={[0, "auto"]}
            tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v)}
          />
          <Tooltip content={<BarTooltip metricDef={metricDef} />} cursor={{ fill: "var(--go-primary-50)" }} />
          <Bar
            dataKey="value"
            fill={`url(#bar-fill-${gradientId})`}
            radius={[6, 6, 0, 0]}
            isAnimationActive
            animationDuration={450}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ProgressBarChart;
