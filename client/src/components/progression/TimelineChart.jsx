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

// Every visible point here is a genuine new-record event (gap points
// carry no dot at all) — a plain, uniform marker rather than a two-tier
// "new vs. held" style, since buildRecordTimeline no longer emits
// held-steady points at all (see its own comment for why).
function RecordDot(props) {
  const { cx, cy, payload } = props;
  if (!payload?.hasData || payload.recordWeight == null) return null;
  return (
    <circle cx={cx} cy={cy} r={5} fill="var(--go-success)" stroke="var(--go-surface)" strokeWidth={2} />
  );
}

// PR "current record" timeline — consumes progressionEngine's
// buildRecordTimeline (NOT the weekly/monthly buildProgressionSeries
// used by ProgressChart): every record gets its own point at its exact
// date, so two PRs set days apart within the same week still show as
// two distinct steps instead of collapsing into one bucket. Gaps only
// appear for genuine stretches with nothing logged at all.
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
          {/* connectNulls: unlike ProgressChart's per-period metrics (where
              a gap genuinely means zero volume/sets that period), a
              personal record is a standing fact — it doesn't lapse just
              because a week went untrained, so the line holds flat
              straight through a gap instead of breaking. Hovering a held
              stretch still surfaces "No workout logged" via the tooltip. */}
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
