import { ChevronRight } from "lucide-react";
import "./progression-charts.css";

// Generic ranked-bar row — one label, a progress track, and a trailing
// figure. Used for every "distribution" list across Progression and
// Analytics (exercise sets, muscle volume, exercise volume, etc.) so
// they share one row shape/markup instead of each page redrawing its own.
// `badge` is optional — a plain-language status label (e.g. "Balanced",
// "Needs Work") shown next to the numeric figure, for callers where a
// reader benefits from a category as well as a percentage.
// `rank` is optional — when set, a numbered position badge replaces the
// bar track entirely (a leaderboard read instead of a proportion read),
// used where several of these lists sit back to back and an unbroken run
// of identical bars starts to blend together.
function DistributionRow({ label, sub, pct = 0, badge, rank, onSelect }) {
  const content = (
    <>
      {rank != null ? (
        <span className="prog-exdist__row-rank">{rank}</span>
      ) : (
        <div className="prog-exdist__row-track">
          <div className="prog-exdist__row-fill" style={{ width: `${Math.max(pct, 4)}%` }} />
        </div>
      )}
      <span className="prog-exdist__row-name">{label}</span>
      <span className="prog-exdist__row-count">
        {badge && <span className={`distribution-row__badge distribution-row__badge--${badge.tone}`}>{badge.label}</span>}
        {sub}
        {onSelect && <ChevronRight size={13} strokeWidth={2} />}
      </span>
    </>
  );

  const rowClass = `prog-exdist__row ${rank != null ? "prog-exdist__row--ranked" : ""}`.trim();

  if (!onSelect) {
    return <div className={`${rowClass} prog-exdist__row--static`}>{content}</div>;
  }

  return (
    <button type="button" className={rowClass} onClick={onSelect}>
      {content}
    </button>
  );
}

export default DistributionRow;
