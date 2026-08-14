import { Dumbbell, Flame, CalendarCheck, TrendingUp, Award, Lock } from "lucide-react";
import "./AchievementBadge.css";

const TYPE_ICONS = {
  sessions: Dumbbell,
  streak: Flame,
  totalDays: CalendarCheck,
  monthly: CalendarCheck,
  prCount: TrendingUp,
};

function AchievementBadge({ type, tier, color, threshold, name, earned = true, onClick }) {
  const Icon = TYPE_ICONS[type] || Award;

  return (
    <button
      type="button"
      className={`achievement-badge achievement-badge--tier${tier || 1} ${
        earned ? "" : "achievement-badge--locked"
      }`}
      style={{ "--badge-accent": color || "var(--go-primary)" }}
      onClick={onClick}
      aria-label={earned ? name : `Locked — ${name}`}
    >
      <Icon size={20} strokeWidth={2} className="achievement-badge-icon" />
      {earned ? (
        <span className="achievement-badge-value">{threshold}</span>
      ) : (
        <Lock size={12} strokeWidth={2.2} className="achievement-badge-lock" />
      )}
    </button>
  );
}

export default AchievementBadge;
