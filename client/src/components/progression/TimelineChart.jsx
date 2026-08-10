import {
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Trophy } from "lucide-react";
import { ChartSkeleton, ChartEmptyState } from "./ChartStates";
import "./progression-charts.css";

function TimelineTooltip({ active, payload, label }) {
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
        <Trophy size={12} strokeWidth={2} className="progress-chart__tooltip-trophy" />
        <span className="progress-chart__tooltip-value">
          {point.exercise ? `${point.exercise} PR — ${point.weight} kg` : `New PR — ${point.recordWeight} kg`}
        </span>
      </p>
      {point.exercise && (
        <p className="progress-chart__tooltip-row progress-chart__tooltip-row--muted">
          {point.delta != null
            ? `${point.delta > 0 ? "+" : ""}${point.delta} kg vs previous PR · ${point.reps} reps`
            : `First recorded PR · ${point.reps} reps`}
        </p>
      )}
    </div>
  );
}

function RecordDot(props) {
  const { cx, cy, payload } = props;
  if (!payload?.hasData || payload.recordWeight == null) return null;
  return (
    <circle cx={cx} cy={cy} r={5} fill="var(--go-success)" stroke="var(--go-surface)" strokeWidth={2} />
  );
}

function TimelineChart({ series = [], loading = false, height = 220 }) {
  if (loading) return <ChartSkeleton height={height} />;

  const hasAnyRecord = series.some((p) => p.hasData && p.recordWeight != null);
  if (!hasAnyRecord) {
    return (
      <ChartEmptyState
        height={height}
        title="No personal records yet"
        message="Your first logged set starts this timeline."
      />
    );
  }

  return (
    <div className="progress-chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={series} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--go-border-soft)" strokeDasharray="0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--go-text-faint)" }}
            axisLine={{ stroke: "var(--go-border-soft)" }}
            tickLine={false}
            minTickGap={20}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--go-text-faint)" }}
            axisLine={false}
            tickLine={false}
            width={44}
            domain={[0, "auto"]}
            tickFormatter={(v) => `${v}kg`}
          />
          <Tooltip content={<TimelineTooltip />} cursor={{ stroke: "var(--go-text-faint)", strokeWidth: 1 }} />
          <ReferenceLine y={0} stroke="var(--go-border-strong)" strokeWidth={1} />
          <Line
            type="stepAfter"
            dataKey="recordWeight"
            stroke="var(--go-chart-accent)"
            strokeWidth={2}
            dot={<RecordDot />}
            activeDot={{ r: 6, fill: "var(--go-success)", stroke: "var(--go-surface)", strokeWidth: 2 }}
            connectNulls
            isAnimationActive
            animationDuration={450}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default TimelineChart;
