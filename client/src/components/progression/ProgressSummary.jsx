import { Dumbbell, Layers, CalendarDays, TrendingUp } from "lucide-react";
import { formatDate } from "../../utils/dateUtils";
import MetricCard from "./MetricCard";
import "./progression-charts.css";

function ProgressSummary({ summary, trend, loading }) {
  const rangeLabel =
    summary?.firstWorkoutDate && summary?.latestWorkoutDate
      ? `${formatDate(summary.firstWorkoutDate)} → ${formatDate(summary.latestWorkoutDate)}`
      : null;

  return (
    <div className="progress-summary">
      {rangeLabel && (
        <p className="progress-summary__range">
          <CalendarDays size={13} strokeWidth={2} /> {rangeLabel}
        </p>
      )}
      <div className="progress-summary__grid">
        <MetricCard
          label="Total Volume"
          icon={TrendingUp}
          value={loading ? null : `${(summary?.totalVolume || 0).toLocaleString()} kg`}
          trend={trend?.volume}
          loading={loading}
        />
        <MetricCard
          label="Total Sets"
          icon={Layers}
          value={loading ? null : summary?.totalSets}
          loading={loading}
        />
        <MetricCard
          label="Sessions"
          icon={Dumbbell}
          value={loading ? null : summary?.totalSessions}
          trend={trend?.frequency}
          loading={loading}
        />
      </div>
    </div>
  );
}

export default ProgressSummary;
