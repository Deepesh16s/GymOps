import { useEffect, useState } from "react";
import { Lock, Sparkles, TrendingUp, BarChart3, Scale, GitCompare, Activity } from "lucide-react";
import { getAdvancedProgression } from "../../services/progressionService";
import { TrendBadge } from "./TrendChart";
import ConfidenceBadge from "../ConfidenceBadge";
import "./advanced-insights.css";

const PILLARS = [
  {
    icon: Activity,
    title: "Plateau Detection",
    desc: "Know when an exercise has genuinely stalled, weighing recent frequency, trend, and how volatile your performance has been — not just \"no PR in a while.\"",
  },
  {
    icon: TrendingUp,
    title: "Strength Trend",
    desc: "Current vs. previous-period estimated 1RM for your most-trained lifts, plus your best-ever performance and when it happened.",
  },
  {
    icon: BarChart3,
    title: "Volume Trend",
    desc: "Weekly training volume against your own historical baseline, overall and per muscle group, with unusually high/low flags.",
  },
  {
    icon: Scale,
    title: "Muscle Balance",
    desc: "How your training volume is actually distributed across muscle groups, recent vs. historical, with an imbalance warning when it's lopsided.",
  },
  {
    icon: GitCompare,
    title: "Exercise Comparison",
    desc: "30/60/90-day estimated-1RM, best-set, and volume change for each of your most-trained exercises, side by side.",
  },
];

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function statusTone(status) {
  if (status === "confirmed") return "danger";
  if (status === "possible") return "warning";
  if (status === "none") return "balanced";
  return "neutral";
}

function statusLabel(status) {
  if (status === "confirmed") return "Plateau Confirmed";
  if (status === "possible") return "Possible Plateau";
  if (status === "none") return "No Plateau";
  if (status === "insufficient_recent_data") return "Not Trained Recently";
  return "Not Enough Data";
}

function PlateauSection({ entries }) {
  if (!entries.length) return null;
  return (
    <div className="advanced-insights__section">
      <p className="advanced-insights__section-title">Plateau Detection</p>
      <ul className="advanced-insights__row-list">
        {entries.map((p) => (
          <li key={p.exercise} className="advanced-insights__row">
            <div className="advanced-insights__row-main">
              <span className="advanced-insights__row-name">{p.exercise}</span>
              <span className={`distribution-row__badge distribution-row__badge--${statusTone(p.status)}`}>
                {statusLabel(p.status)}
                {p.volatility?.high ? " · volatile" : ""}
              </span>
            </div>
            {p.status === "insufficient_data" || p.status === "insufficient_recent_data" ? (
              <p className="advanced-insights__row-note">{p.message}</p>
            ) : (
              <div className="advanced-insights__row-meta">
                {p.trend && <TrendBadge trend={p.trend} />}
                <span className="advanced-insights__row-detail">{p.recentFrequencyPerWeek}x/week recently</span>
                <ConfidenceBadge level={p.confidence} label="Plateau read" />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StrengthTrendSection({ entries }) {
  const usable = entries.filter((e) => e.status === "ok");
  if (!usable.length) return null;
  return (
    <div className="advanced-insights__section">
      <p className="advanced-insights__section-title">Strength Trend</p>
      <ul className="advanced-insights__row-list">
        {usable.map((e) => (
          <li key={e.exercise} className="advanced-insights__row">
            <div className="advanced-insights__row-main">
              <span className="advanced-insights__row-name">{e.exercise}</span>
              <span className="advanced-insights__row-value">{e.currentE1RM} kg e1RM</span>
              {e.stale && (
                <span className="distribution-row__badge distribution-row__badge--neutral">
                  Last trained {new Date(e.lastSessionDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
            </div>
            <div className="advanced-insights__row-meta">
              {e.trend && <TrendBadge trend={e.trend} />}
              <span className="advanced-insights__row-detail">
                Best: {e.bestHistoricalE1RM} kg ({new Date(e.bestHistoricalDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })})
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VolumeTrendSection({ data }) {
  if (data.status !== "ok") {
    return (
      <div className="advanced-insights__section">
        <p className="advanced-insights__section-title">Volume Trend</p>
        <p className="advanced-insights__row-note">{data.message}</p>
      </div>
    );
  }

  return (
    <div className="advanced-insights__section">
      <p className="advanced-insights__section-title">Volume Trend</p>
      <div className="advanced-insights__row">
        <div className="advanced-insights__row-main">
          <span className="advanced-insights__row-name">Overall</span>
          <span className="advanced-insights__row-value">{data.averageWeeklyVolume.toLocaleString()} kg/week avg</span>
        </div>
        <div className="advanced-insights__row-meta">
          {data.trend && <TrendBadge trend={data.trend} />}
          {data.flag !== "normal" && (
            <span className="distribution-row__badge distribution-row__badge--warning">
              {data.flag === "unusually_high" ? "Unusually high volume" : "Unusually low volume"}
            </span>
          )}
        </div>
      </div>
      {data.muscles.length > 0 && (
        <ul className="advanced-insights__row-list">
          {data.muscles.map((m) => (
            <li key={m.muscle} className="advanced-insights__row advanced-insights__row--compact">
              <span className="advanced-insights__row-name">{m.muscle}</span>
              <span className="advanced-insights__row-detail">{m.averageWeeklyVolume.toLocaleString()} kg/week</span>
              {m.trend && <TrendBadge trend={m.trend} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MuscleBalanceSection({ data }) {
  if (data.status !== "ok") {
    return (
      <div className="advanced-insights__section">
        <p className="advanced-insights__section-title">Muscle Balance</p>
        <p className="advanced-insights__row-note">{data.message}</p>
      </div>
    );
  }

  return (
    <div className="advanced-insights__section">
      <p className="advanced-insights__section-title">Muscle Balance</p>
      <div className="advanced-insights__row">
        <div className="advanced-insights__row-main">
          <span className="advanced-insights__row-detail">
            Dominant: <strong>{data.dominant}</strong> · Least trained: <strong>{data.neglected}</strong>
          </span>
          {data.imbalanceWarning && (
            <span className="distribution-row__badge distribution-row__badge--warning">
              {data.imbalanceGapPct}pt gap
            </span>
          )}
        </div>
      </div>
      <div className="prog-exdist">
        {data.historicalDistribution.map((m) => (
          <div key={m.muscle} className="advanced-insights__dist-row">
            <span className="advanced-insights__row-detail">{m.muscle}</span>
            <div className="advanced-insights__dist-bar">
              <div className="advanced-insights__dist-bar-fill" style={{ width: `${m.pct}%` }} />
            </div>
            <span className="advanced-insights__row-detail">{m.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExerciseComparisonSection({ entries }) {
  const usable = entries.filter((e) => e.status === "ok");
  if (!usable.length) return null;
  return (
    <div className="advanced-insights__section">
      <p className="advanced-insights__section-title">Exercise Comparison</p>
      <ul className="advanced-insights__row-list">
        {usable.map((e) => (
          <li key={e.exercise} className="advanced-insights__row">
            <div className="advanced-insights__row-main">
              <span className="advanced-insights__row-name">{e.exercise}</span>
              {e.stale && (
                <span className="distribution-row__badge distribution-row__badge--neutral">
                  Last trained {new Date(e.lastSessionDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
            </div>
            <div className="advanced-insights__row-meta">
              {e.windows.map((w) =>
                w.available ? (
                  <span key={w.days} className="advanced-insights__window">
                    {w.days}d: {w.e1RMChangePct > 0 ? "+" : ""}
                    {w.e1RMChangePct}% e1RM
                  </span>
                ) : (
                  <span key={w.days} className="advanced-insights__window advanced-insights__window--muted">
                    {w.days}d: —
                  </span>
                )
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LockedPreview() {
  const [showNote, setShowNote] = useState(false);

  return (
    <section className="progression-panel advanced-insights advanced-insights--locked">
      <div className="progression-panel__label-row">
        <p className="progression-panel__label">Advanced Insights</p>
        <span className="advanced-insights__badge">
          <Sparkles size={12} strokeWidth={2} />
          Premium
        </span>
      </div>
      <p className="advanced-insights__intro">
        Go deeper than the free progression view with five deterministic analyses of your own training history.
      </p>
      <div className="advanced-insights__grid">
        {PILLARS.map((p) => (
          <div key={p.title} className="advanced-insights__locked-card">
            <div className="advanced-insights__locked-icon">
              <Lock size={13} strokeWidth={2} />
            </div>
            <p className="advanced-insights__locked-title">
              <p.icon size={14} strokeWidth={1.8} />
              {p.title}
            </p>
            <p className="advanced-insights__locked-desc">{p.desc}</p>
          </div>
        ))}
      </div>
      <button type="button" className="advanced-insights__cta" onClick={() => setShowNote(true)}>
        Upgrade to Premium
      </button>
      {showNote && (
        <p className="advanced-insights__cta-note">
          Premium upgrades aren't available yet — check back soon.
        </p>
      )}
    </section>
  );
}

function PremiumContent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAdvancedProgression()
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="progression-panel advanced-insights">
      <div className="progression-panel__label-row">
        <p className="progression-panel__label">Advanced Insights</p>
        <span className="advanced-insights__badge">
          <Sparkles size={12} strokeWidth={2} />
          Premium
        </span>
      </div>

      {loading && <p className="advanced-insights__status">Loading advanced insights...</p>}
      {!loading && error && <p className="advanced-insights__status">Couldn't load advanced insights.</p>}

      {!loading && !error && data && (
        <>
          <PlateauSection entries={data.plateau} />
          <StrengthTrendSection entries={data.strengthTrends} />
          <VolumeTrendSection data={data.volumeTrends} />
          <MuscleBalanceSection data={data.muscleBalance} />
          <ExerciseComparisonSection entries={data.exerciseComparisons} />
          {data.plateau.length === 0 && (
            <p className="advanced-insights__status">
              Log a few more sessions to unlock advanced insights.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function AdvancedInsights() {
  const [user, setUser] = useState(readStoredUser);

  useEffect(() => {
    const handler = () => setUser(readStoredUser());
    window.addEventListener("repvyn:user-updated", handler);
    return () => window.removeEventListener("repvyn:user-updated", handler);
  }, []);

  const isPremium = user?.premiumTier === "premium";

  return isPremium ? <PremiumContent /> : <LockedPreview />;
}

export default AdvancedInsights;
