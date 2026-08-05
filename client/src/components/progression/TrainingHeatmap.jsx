import { useMemo, useState } from "react";
import { dateKey, startOfWeek, MONTH_LABELS } from "../../utils/dateUtils";
import "./progression-charts.css";

const WEEKS = 53;
const DAY_ROW_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

function tierFor(volume, max) {
  if (!volume || !max) return 0;
  const ratio = volume / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

function TrainingHeatmap({ sessions = [] }) {
  const [hovered, setHovered] = useState(null);

  const { weeks, maxVolume, trainedDays, totalDays } = useMemo(() => {
    const volumeByDay = new Map();
    sessions.forEach((s) => {
      const key = dateKey(s.date);
      volumeByDay.set(key, (volumeByDay.get(key) || 0) + (s.stats?.volume || 0));
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const gridStart = startOfWeek(today);
    gridStart.setDate(gridStart.getDate() - (WEEKS - 1) * 7);

    const days = [];
    let max = 0;
    for (let i = 0; i < WEEKS * 7; i++) {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + i);
      const key = dateKey(d);
      const volume = volumeByDay.get(key) || 0;
      if (volume > max) max = volume;
      days.push({ date: d, key, volume });
    }

    const cols = [];
    for (let w = 0; w < WEEKS; w++) {
      cols.push(days.slice(w * 7, w * 7 + 7));
    }

    return {
      weeks: cols,
      maxVolume: max,
      trainedDays: days.filter((d) => d.volume > 0).length,
      totalDays: days.length,
    };
  }, [sessions]);

  const monthMarkers = useMemo(() => {
    const markers = [];
    let lastMonth = null;
    weeks.forEach((col, i) => {
      const month = col[0].date.getMonth();
      if (month !== lastMonth) {
        markers.push({ index: i, label: MONTH_LABELS[month].slice(0, 3) });
        lastMonth = month;
      }
    });
    return markers;
  }, [weeks]);

  const summary = `${trainedDays} of the last ${totalDays} days trained`;

  return (
    <div className="training-heatmap">
      <div className="training-heatmap__scroll">
        <div className="training-heatmap__months" aria-hidden="true">
          <div className="training-heatmap__months-spacer" />
          {monthMarkers.map((m) => (
            <span
              key={m.index}
              className="training-heatmap__month"
              style={{ left: `${m.index * 14}px` }}
            >
              {m.label}
            </span>
          ))}
        </div>
        <div className="training-heatmap__body">
          <div className="training-heatmap__day-labels" aria-hidden="true">
            {DAY_ROW_LABELS.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
          <div className="training-heatmap__grid" role="img" aria-label={summary}>
            {weeks.map((col, colIndex) => (
              <div className="training-heatmap__col" key={colIndex}>
                {col.map((day) => (
                  <div
                    key={day.key}
                    className={`training-heatmap__cell training-heatmap__cell--t${tierFor(day.volume, maxVolume)}`}
                    title={`${day.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} — ${day.volume ? `${Math.round(day.volume).toLocaleString()} kg` : "No training"}`}
                    onMouseEnter={() => setHovered(day)}
                    onMouseLeave={() => setHovered(null)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="training-heatmap__footer">
        <span className="training-heatmap__footer-hint">
          {hovered
            ? `${hovered.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${
                hovered.volume ? `${Math.round(hovered.volume).toLocaleString()} kg` : "No training"
              }`
            : summary}
        </span>
        <div className="training-heatmap__legend" aria-hidden="true">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((t) => (
            <span key={t} className={`training-heatmap__legend-swatch training-heatmap__cell--t${t}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

export default TrainingHeatmap;
