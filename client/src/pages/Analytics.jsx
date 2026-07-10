import { useState, useEffect, useMemo } from "react";
import "./analytics.css";
import api from "../services/api";
import { startOfWeek, formatDate } from "../utils/dateUtils";
import { getWorkoutVolume, getHeaviestSet } from "../utils/workoutUtils";

function Analytics() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkouts = async () => {
      try {
        const res = await api.get("/workouts", { params: { limit: 500 } });
        setWorkouts(res.data);
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    };
    fetchWorkouts();
  }, []);

  // Volume per week, last 8 weeks
  const weeklyVolume = useMemo(() => {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(startOfWeek());
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const volume = workouts
        .filter((w) => {
          const d = new Date(w.date || w.createdAt);
          return d >= weekStart && d < weekEnd;
        })
        .reduce((sum, w) => sum + getWorkoutVolume(w), 0);

      weeks.push({ label: formatDate(weekStart).slice(0, 6), volume });
    }
    return weeks;
  }, [workouts]);

  const maxWeeklyVolume = Math.max(...weeklyVolume.map((w) => w.volume), 1);

  // Frequency: workouts per week, last 8 weeks
  const weeklyFrequency = useMemo(() => {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(startOfWeek());
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const count = workouts.filter((w) => {
        const d = new Date(w.date || w.createdAt);
        return d >= weekStart && d < weekEnd;
      }).length;

      weeks.push({ label: formatDate(weekStart).slice(0, 6), count });
    }
    return weeks;
  }, [workouts]);

  const maxFrequency = Math.max(...weeklyFrequency.map((w) => w.count), 1);

  // Muscle distribution by total volume
  const muscleDistribution = useMemo(() => {
    const map = {};
    workouts.forEach((w) => {
      const muscle = w.exercise?.muscleGroup || "Other";
      map[muscle] = (map[muscle] || 0) + getWorkoutVolume(w);
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(map)
      .map(([muscle, volume]) => ({ muscle, volume, pct: (volume / total) * 100 }))
      .sort((a, b) => b.volume - a.volume);
  }, [workouts]);

  // PR progression: heaviest set ever, per exercise
  const personalRecords = useMemo(() => {
    const map = {};
    workouts.forEach((w) => {
      const name = w.exercise?.name || "Unknown";
      const heaviest = getHeaviestSet(w);
      if (!map[name] || heaviest > map[name].weight) {
        map[name] = { weight: heaviest, date: w.date || w.createdAt };
      }
    });
    return Object.entries(map)
      .map(([exercise, data]) => ({ exercise, ...data }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8);
  }, [workouts]);

  if (loading) {
    return (
      <div className="analytics-page">
        <main className="analytics-main">
          <div className="analytics-placeholder">
            <h1>Progress Analytics</h1>
            <p>Loading your data...</p>
          </div>
        </main>
      </div>
    );
  }

  if (workouts.length === 0) {
    return (
      <div className="analytics-page">
        <main className="analytics-main">
          <div className="analytics-placeholder">
            <h1>Progress Analytics</h1>
            <p>Log a few workouts and your trends will show up here.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="analytics-page">
      <main className="analytics-main">
        <h1 className="analytics-title">Progress Analytics</h1>

        <div className="analytics-grid">
          {/* Volume trend */}
          <section className="analytics-card">
            <h2 className="analytics-card-title">Weekly Volume</h2>
            <div className="analytics-bars">
              {weeklyVolume.map((w) => (
                <div className="analytics-bar-col" key={w.label}>
                  <div
                    className="analytics-bar"
                    style={{ height: `${(w.volume / maxWeeklyVolume) * 100}%` }}
                    title={`${w.volume.toLocaleString()} kg`}
                  />
                  <span className="analytics-bar-label">{w.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Frequency */}
          <section className="analytics-card">
            <h2 className="analytics-card-title">Workout Frequency</h2>
            <div className="analytics-bars">
              {weeklyFrequency.map((w) => (
                <div className="analytics-bar-col" key={w.label}>
                  <div
                    className="analytics-bar analytics-bar-alt"
                    style={{ height: `${(w.count / maxFrequency) * 100}%` }}
                    title={`${w.count} workouts`}
                  />
                  <span className="analytics-bar-label">{w.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Muscle distribution */}
          <section className="analytics-card">
            <h2 className="analytics-card-title">Muscle Distribution</h2>
            <div className="analytics-dist-list">
              {muscleDistribution.map((m) => (
                <div className="analytics-dist-row" key={m.muscle}>
                  <span className="analytics-dist-label">{m.muscle}</span>
                  <div className="analytics-dist-track">
                    <div className="analytics-dist-fill" style={{ width: `${m.pct}%` }} />
                  </div>
                  <span className="analytics-dist-pct">{m.pct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </section>

          {/* PR progression */}
          <section className="analytics-card">
            <h2 className="analytics-card-title">Personal Records</h2>
            <div className="analytics-pr-list">
              {personalRecords.map((pr) => (
                <div className="analytics-pr-row" key={pr.exercise}>
                  <span className="analytics-pr-exercise">{pr.exercise}</span>
                  <span className="analytics-pr-weight">{pr.weight} kg</span>
                  <span className="analytics-pr-date">{formatDate(pr.date)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Analytics;