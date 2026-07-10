import { useState, useEffect, useMemo } from "react";
import "./workoutHistory.css";
import api from "../services/api";
import { formatDate } from "../utils/dateUtils";
import {
  getWorkoutVolume,
  getSetCount,
  formatSetBreakdown,
  filterBySearch,
  filterByMuscle,
  sortWorkouts,
} from "../utils/workoutUtils";

function WorkoutHistory() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState("All");
  const [order, setOrder] = useState("newest");
  const [deletingId, setDeletingId] = useState(null);

  const fetchWorkouts = async () => {
    setLoading(true);
    try {
      const res = await api.get("/workouts", { params: { limit: 500 } });
      setWorkouts(res.data);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const muscleOptions = useMemo(() => {
    const set = new Set(workouts.map((w) => w.exercise?.muscleGroup).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [workouts]);

  const visibleWorkouts = useMemo(() => {
    let result = filterBySearch(workouts, search);
    result = filterByMuscle(result, muscle);
    result = sortWorkouts(result, order);
    return result;
  }, [workouts, search, muscle, order]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this workout? This can't be undone.")) return;

    setDeletingId(id);
    try {
      await api.delete(`/workouts/${id}`);
      setWorkouts((prev) => prev.filter((w) => w._id !== id));
    } catch (error) {
      console.log(error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="history-page">
      <main className="history-main">
        <div className="history-header">
          <h1>Workout History</h1>
          <p>{visibleWorkouts.length} workout{visibleWorkouts.length !== 1 ? "s" : ""}</p>
        </div>

        <div className="history-controls">
          <input
            className="history-search"
            type="text"
            placeholder="Search by exercise..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="history-select"
            value={muscle}
            onChange={(e) => setMuscle(e.target.value)}
          >
            {muscleOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            className="history-select"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        {loading ? (
          <div className="history-placeholder">
            <p>Loading workouts...</p>
          </div>
        ) : visibleWorkouts.length === 0 ? (
          <div className="history-placeholder">
            <h1>No workouts found</h1>
            <p>Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="history-list">
            {visibleWorkouts.map((w) => (
              <div className="history-row" key={w._id}>
                <div className="history-row-main">
                  <span className="history-exercise">{w.exercise?.name || "Unknown exercise"}</span>
                  <span className="history-muscle-tag">{w.exercise?.muscleGroup}</span>
                </div>
                <div className="history-row-sets">{formatSetBreakdown(w)}</div>
                <div className="history-row-meta">
                  <span>{getSetCount(w)} sets</span>
                  <span>{getWorkoutVolume(w).toLocaleString()} kg volume</span>
                  <span>{formatDate(w.date || w.createdAt)}</span>
                </div>
                <button
                  type="button"
                  className="history-delete-btn"
                  onClick={() => handleDelete(w._id)}
                  disabled={deletingId === w._id}
                >
                  {deletingId === w._id ? "..." : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default WorkoutHistory;