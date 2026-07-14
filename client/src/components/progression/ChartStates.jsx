import { TrendingUp } from "lucide-react";

// Shared loading/empty visuals for every Progression chart — pulled out
// once so ProgressChart and TimelineChart don't each redraw their own
// skeleton/empty markup.
export function ChartSkeleton({ height = 260 }) {
  return (
    <div className="progress-chart__skeleton" style={{ height }} aria-hidden="true">
      <span className="skeleton" style={{ width: "100%", height: "100%", borderRadius: 12, display: "block" }} />
    </div>
  );
}

export function ChartEmptyState({ height = 260, title, message }) {
  return (
    <div className="progress-chart__empty" style={{ height }}>
      <div className="progress-chart__empty-icon">
        <TrendingUp size={22} strokeWidth={1.6} />
      </div>
      <p className="progress-chart__empty-title">{title || "Nothing logged yet"}</p>
      {message && <p className="progress-chart__empty-message">{message}</p>}
    </div>
  );
}
