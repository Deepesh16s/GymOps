import { Dumbbell, Clock, Flame, Layers, Trophy, Timer, Activity } from "lucide-react";
import { formatDurationLong } from "../../utils/timeFormat";

function SummaryStat({ icon: Icon, label, value }) {
  if (value == null) return null;
  return (
    <div className="history-summary__stat">
      <div className="history-summary__stat-icon">
        <Icon size={16} strokeWidth={1.8} />
      </div>
      <div className="history-summary__stat-body">
        <span className="history-summary__stat-value">{value}</span>
        <span className="history-summary__stat-label">{label}</span>
      </div>
    </div>
  );
}

function SessionSummaryBar({ summary }) {
  if (!summary || summary.totalWorkouts === 0) return null;

  return (
    <div className="history-summary history-fade-in">
      <SummaryStat icon={Dumbbell} label="Total Workouts" value={summary.totalWorkouts} />
      <SummaryStat
        icon={Clock}
        label="Avg Duration"
        value={summary.avgDuration != null ? formatDurationLong(summary.avgDuration) : null}
      />
      <SummaryStat
        icon={Flame}
        label="Avg Volume"
        value={summary.avgVolume != null ? `${summary.avgVolume.toLocaleString()} kg` : null}
      />
      <SummaryStat icon={Dumbbell} label="Avg Exercises" value={summary.avgExercises} />
      <SummaryStat icon={Layers} label="Avg Sets" value={summary.avgSets} />
      <SummaryStat
        icon={Timer}
        label="Longest Workout"
        value={
          summary.longestWorkout
            ? formatDurationLong(summary.longestWorkout.sessionDuration)
            : null
        }
      />
      <SummaryStat
        icon={Trophy}
        label="Total PRs"
        value={summary.prCount > 0 ? summary.prCount : null}
      />
      <SummaryStat
        icon={Activity}
        label="Most Trained"
        value={summary.mostTrainedMuscle?.muscle || null}
      />
    </div>
  );
}

export default SessionSummaryBar;
