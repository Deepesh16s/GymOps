import { useId, useMemo } from "react";
import {
  ComposedChart,
  Area,
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

// Cardio sibling of ExerciseSessionChart — same shell (recharts
// primitives, ChartSkeleton/ChartEmptyState, .progress-chart CSS
// classes), reused as-is. Only the tooltip content differs, and
// genuinely has to: ExerciseSessionChart's tooltip hardcodes Best
// Set/Volume/Working Sets/Average Weight rows, which are meaningless
// for a distance/duration/pace/calories cardio session — reusing it
// directly would render "Volume: NaN kg" for real cardio data. This is
// the "unavoidable" cardio-specific chart the phase's own scope allows
// for exactly that reason; everything reusable about it (props shape,
// styling, PR-dot behavior) is unchanged from its strength sibling.
function buildTooltipRows(point, metricKey) {
  const base = [
    { key: "distance", label: "Distance", value: point.distance != null ? `${point.distance} km` : "—" },
    { key: "duration", label: "Duration", value: point.duration != null ? `${point.duration} min` : "—" },
    { key: "pace", label: "Pace", value: point.pace != null ? `${point.pace} min/km` : "—" },
    { key: "calories", label: "Calories", value: point.calories != null ? `${point.calories} kcal` : "—" },
  ];

  const activeRow = base.find((r) => r.key === metricKey);
  if (!activeRow) return base;
  return [activeRow, ...base.filter((r) => r.key !== activeRow.key)];
}

function CardioSessionTooltip({ active, payload, metricKey }) {
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

// One point per session for a single cardio activity — reuses
// buildCardioSessionSeries' precomputed metrics, same "switching metric
// never recomputes sessions" contract as ExerciseSessionChart.
function CardioSessionChart({ series = [], metricKey, metricDef, loading = false, height = 220 }) {
  const labelByKey = useMemo(() => new Map(series.map((p) => [p.key, p.label])), [series]);
  const gradientId = `cardio-chart-gradient-${useId().replace(/:/g, "")}`;

  if (loading) return <ChartSkeleton height={height} />;

  if (!series.length) {
    return (
      <ChartEmptyState
        height={height}
        title="No cardio sessions logged yet"
        message="Log this activity and its trend graph starts here."
      />
    );
  }

  return (
    <div className="progress-chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={series} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
          {/* Same gradient treatment ExerciseSessionChart's own sibling
              fix uses — presentation only, reads the same dataKey. */}
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--go-chart-accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--go-chart-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
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
            content={<CardioSessionTooltip metricKey={metricKey} />}
            cursor={{ stroke: "var(--go-text-faint)", strokeWidth: 1 }}
          />
          <ReferenceLine y={0} stroke="var(--go-border-strong)" strokeWidth={1} />
          <Area
            type="linear"
            dataKey={metricKey}
            stroke="none"
            fill={`url(#${gradientId})`}
            connectNulls
            isAnimationActive
            animationDuration={450}
            activeDot={false}
          />
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

export default CardioSessionChart;
