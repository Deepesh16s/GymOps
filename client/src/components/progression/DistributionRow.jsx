import { ChevronRight } from "lucide-react";
import ConfidenceBadge from "../ConfidenceBadge";
import "./progression-charts.css";

function DistributionRow({
  label,
  sub,
  pct = 0,
  badge,
  rank,
  onSelect,
  confidence,
  confidenceReason,
  confidenceLabel = "Confidence",
}) {
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
        {confidence && <ConfidenceBadge level={confidence} reason={confidenceReason} label={confidenceLabel} />}
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
