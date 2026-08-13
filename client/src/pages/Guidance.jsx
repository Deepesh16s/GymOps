import { useState, useEffect, useMemo } from "react";
import { Compass, TrendingUp, Activity, Scale, CalendarCheck, Target, Crosshair } from "lucide-react";
import ConfidenceBadge from "../components/ConfidenceBadge";
import { getWorkouts } from "../services/workoutService";
import { getGoals } from "../services/goalService";
import { buildGuidanceData } from "../guidance/guidanceData";
import { buildGuidance } from "../guidance/guidanceEngine";
import "./guidance.css";

const CATEGORY_ICONS = {
  Progression: TrendingUp,
  Plateau: Activity,
  "Muscle Balance": Scale,
  Consistency: CalendarCheck,
  Goals: Target,
  "Training Focus": Crosshair,
};

function Guidance() {
  const [workouts, setWorkouts] = useState(null);
  const [goals, setGoals] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([getWorkouts(), getGoals()])
      .then(([workoutsRes, goalsRes]) => {
        setWorkouts(workoutsRes.data);
        setGoals(goalsRes.data);
      })
      .catch(() => setError(true));
  }, []);

  const guidance = useMemo(() => {
    if (!workouts || !goals) return null;
    return buildGuidance(buildGuidanceData(workouts, goals));
  }, [workouts, goals]);

  const loading = !error && (workouts === null || goals === null);

  return (
    <div className="guidance-page">
      <div className="guidance-heading">
        <Compass size={20} strokeWidth={1.8} />
        <div>
          <h1 className="guidance-title">Guidance</h1>
          <p className="guidance-subtitle">
            Deterministic feedback from your own training data — not medical advice.
          </p>
        </div>
      </div>

      {loading && <p className="guidance-hint">Loading your guidance...</p>}

      {!loading && error && <p className="guidance-hint">Couldn't load guidance right now.</p>}

      {!loading && !error && guidance && guidance.length === 0 && (
        <div className="guidance-empty">
          <p>Not enough logged training yet to generate guidance.</p>
          <p className="guidance-empty-hint">Log a few more workouts and check back here.</p>
        </div>
      )}

      {!loading && !error && guidance && guidance.length > 0 && (
        <ul className="guidance-list">
          {guidance.map((item) => {
            const Icon = CATEGORY_ICONS[item.category] || Compass;
            return (
              <li key={item.id} className={`guidance-card guidance-card--${item.tone}`}>
                <span className="guidance-card-icon">
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                <div className="guidance-card-body">
                  <div className="guidance-card-top">
                    <span className="guidance-card-category">{item.category}</span>
                    {item.confidence && (
                      <ConfidenceBadge level={item.confidence} reason={item.confidenceReason} />
                    )}
                  </div>
                  <p className="guidance-card-title">{item.title}</p>
                  <p className="guidance-card-message">{item.message}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default Guidance;
