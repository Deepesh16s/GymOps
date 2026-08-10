import { Sparkles, Info } from "lucide-react";
import "./progression-charts.css";

function InsightCard({ insight }) {
  if (!insight) return null;

  return (
    <div className={`insight-card ${insight.available ? "" : "insight-card--unavailable"}`}>
      <div className="insight-card__icon">
        {insight.available ? (
          <Sparkles size={16} strokeWidth={1.8} />
        ) : (
          <Info size={16} strokeWidth={1.8} />
        )}
      </div>
      <div className="insight-card__body">
        <span className="insight-card__label">{insight.label}</span>
        {insight.available ? (
          <>
            <span className="insight-card__value">{insight.value}</span>
            <span className="insight-card__detail">{insight.detail}</span>
          </>
        ) : (
          <span className="insight-card__detail insight-card__detail--muted">{insight.reason}</span>
        )}
      </div>
    </div>
  );
}

export default InsightCard;
