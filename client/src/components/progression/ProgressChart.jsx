import { useId, useMemo } from "react";
import {
  AreaChart,
  Area,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { movingAverage } from "../../utils/strengthUtils";
import { ChartSkeleton, ChartEmptyState } from "./ChartStates";
import "./progression-charts.css";

function ValueDot(props) {
  const { cx, cy, payload } = props;
  if (!payload?.hasData) return null;
  return (
    <circle cx={cx} cy={cy} r={3} fill="var(--go-primary)" stroke="var(--go-surface)" strokeWidth={1.5} />
  );
}

function ChartTooltip({ active, payload, label, metricDef }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  const raw = payload.find((p) => p.dataKey === "value");
  const ma = payload.find((p) => p.dataKey === "valueMa");

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
    <div className="progress-chart__tooltip" role="status">
      <p className="progress-chart__tooltip-label">{label}</p>
      {raw?.value != null ? (
        <p className="progress-chart__tooltip-row">
          <span className="progress-chart__tooltip-key progress-chart__tooltip-key--primary" />
          <span className="progress-chart__tooltip-value">
            {metricDef.format(raw.value)}
          </span>
        </p>
      ) : (
        <p className="progress-chart__tooltip-row progress-chart__tooltip-row--muted">
          <span className="progress-chart__tooltip-note">
            {metricDef.noDataLabel || "No data for this period"}
          </span>
        </p>
      )}
      {ma && ma.value != null && (
        <p className="progress-chart__tooltip-row progress-chart__tooltip-row--muted">
          <span className="progress-chart__tooltip-key progress-chart__tooltip-key--ma" />
          <span className="progress-chart__tooltip-value">
            {metricDef.format(ma.value)} <span className="progress-chart__tooltip-note">moving avg</span>
          </span>
        </p>
      )}
    </div>
  );
}

function ProgressChart({
  series = [],
  metricKey,
  metricDef,
  showMovingAverage = false,
  movingAverageWindow = 4,
  height = 280,
  loading = false,
  emptyTitle,
  emptyMessage,
}) {
  const gradientId = useId();

  const chartData = useMemo(() => {
    const mapped = series.map((point) => ({
      label: point.label,
      value: point[metricKey],
      hasData: point.hasData,
    }));
    return showMovingAverage ? movingAverage(mapped, "value", movingAverageWindow) : mapped;
  }, [series, metricKey, showMovingAverage, movingAverageWindow]);

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
        <AreaChart data={chartData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`progress-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--go-primary)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--go-primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--go-border-soft)"
            strokeDasharray="0"
          />
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
          <Tooltip
            content={<ChartTooltip metricDef={metricDef} />}
            cursor={{ stroke: "var(--go-text-faint)", strokeWidth: 1, strokeDasharray: "0" }}
          />
          <ReferenceLine y={0} stroke="var(--go-border-strong)" strokeWidth={1} />
          <Area
            type="linear"
            dataKey="value"
            stroke="var(--go-primary)"
            strokeWidth={2}
            fill={`url(#progress-fill-${gradientId})`}
            dot={<ValueDot />}
            activeDot={{ r: 5, fill: "var(--go-primary)", stroke: "var(--go-surface)", strokeWidth: 2 }}
            isAnimationActive
            animationDuration={450}
            animationEasing="ease-out"
            connectNulls={false}
          />
          {showMovingAverage && (
            <Line
              type="linear"
              dataKey="valueMa"
              stroke="var(--go-text-muted)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={false}
              isAnimationActive
              animationDuration={450}
              connectNulls
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
      {showMovingAverage && (
        <div className="progress-chart__legend" aria-hidden="true">
          <span className="progress-chart__legend-item">
            <i className="progress-chart__legend-swatch progress-chart__legend-swatch--primary" /> {metricDef.shortLabel}
          </span>
          <span className="progress-chart__legend-item">
            <i className="progress-chart__legend-swatch progress-chart__legend-swatch--ma" /> Moving avg
          </span>
        </div>
      )}
    </div>
  );
}

export default ProgressChart;
