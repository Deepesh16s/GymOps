import { useMemo } from "react";
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

// Fixed, always-shown rows (in this order) plus the active metric's own
// row bumped to the top — e.g. selecting Estimated 1RM surfaces it
// first, with Best Set/Volume/Working Sets/Average Weight still visible
// underneath for context.
function buildTooltipRows(point, metricKey) {
  const base = [
    {
      key: "bestSetWeight",
      label: "Best Set",
      value: point.bestSet ? `${point.bestSet.weight} × ${point.bestSet.reps}` : "—",
    },
    { key: "volume", label: "Volume", value: `${point.volume.toLocaleString()} kg` },
    { key: "sets", label: "Working Sets", value: `${point.sets}` },
    {
      key: "workingWeight",
      label: "Average Weight",
      value: point.workingWeight ? `${Math.round(point.workingWeight * 10) / 10} kg` : "—",
    },
  ];

  const extraRow =
    metricKey === "estOneRM"
      ? { key: "estOneRM", label: "Estimated 1RM", value: point.estOneRM != null ? `${point.estOneRM} kg` : "—" }
      : metricKey === "totalReps"
      ? { key: "totalReps", label: "Total Reps", value: `${point.totalReps}` }
      : null;

  const activeRow = extraRow || base.find((r) => r.key === metricKey);
  if (!activeRow) return base;
  return [activeRow, ...base.filter((r) => r.key !== activeRow.key)];
}

function SessionTooltip({ active, payload, metricKey }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const rows = buildTooltipRows(point, metricKey);

  return (
    <div className="progress-chart__tooltip">
      <p className="progress-chart__tooltip-label">{point.label}</p>
      {point.isPR && (
        <p className="progress-chart__tooltip-row">
          <Trophy size={12} strokeWidth={2} className="progress-chart__tooltip-trophy" />
          <span className="progress-chart__tooltip-value">New Personal Record</span>
        </p>
      )}
      {rows.map((row, i) => (
        <p
          key={row.key}
          className={`progress-chart__tooltip-row ${i > 0 ? "progress-chart__tooltip-row--muted" : ""}`}
        >
          {row.label}: <span className="progress-chart__tooltip-value">{row.value}</span>
        </p>
      ))}
    </div>
  );
}

function SessionDot(props) {
  const { cx, cy, payload } = props;
  if (!payload) return null;
  if (payload.isPR) {
    return (
      <circle cx={cx} cy={cy} r={5} fill="var(--go-success)" stroke="var(--go-surface)" strokeWidth={2} />
    );
  }
  return (
    <circle cx={cx} cy={cy} r={3.5} fill="var(--go-chart-accent)" stroke="var(--go-surface)" strokeWidth={1.5} />
  );
}

// One point per workout SESSION for a single exercise — never per set
// (buildExerciseSessionSeries already reduces each session to its
// strongest working set, total volume, etc.). The active metric only
// changes which precomputed field the Line reads (`dataKey={metricKey}`)
// — switching metrics never recomputes sessions.
function ExerciseSessionChart({ series = [], metricKey, metricDef, loading = false, height = 220 }) {
  const labelByKey = useMemo(() => new Map(series.map((p) => [p.key, p.label])), [series]);

  if (loading) return <ChartSkeleton height={height} />;

  if (!series.length) {
    return (
      <ChartEmptyState
        height={height}
        title="No sessions logged yet"
        message="Log this exercise and its progression graph starts here."
      />
    );
  }

  return (
    <div className="progress-chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={series} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--go-border-soft)" strokeDasharray="0" />
          <XAxis
            dataKey="key"
            tickFormatter={(k) => labelByKey.get(k) || ""}
            tick={{ fontSize: 11, fill: "var(--go-text-faint)" }}
            axisLine={{ stroke: "var(--go-border-soft)" }}
            tickLine={false}
            minTickGap={20}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--go-text-faint)" }}
            axisLine={false}
            tickLine={false}
            width={54}
            domain={[0, "auto"]}
            tickFormatter={(v) => metricDef.format(v)}
          />
          <Tooltip
            content={<SessionTooltip metricKey={metricKey} />}
            cursor={{ stroke: "var(--go-text-faint)", strokeWidth: 1 }}
          />
          <ReferenceLine y={0} stroke="var(--go-border-strong)" strokeWidth={1} />
          <Line
            type="linear"
            dataKey={metricKey}
            stroke="var(--go-chart-accent)"
            strokeWidth={2}
            dot={<SessionDot />}
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

export default ExerciseSessionChart;
