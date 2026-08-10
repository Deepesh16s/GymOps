import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Dumbbell, FilterX, Trophy } from "lucide-react";
import "./workoutHistory.css";
import api from "../services/api";
import { getWorkouts } from "../services/workoutService";
import EditWorkoutTimingModal from "../components/EditWorkoutTimingModal";
import SessionCard from "../components/workoutHistory/SessionCard";
import HistoryFilterBar from "../components/workoutHistory/HistoryFilterBar";
import SessionSummaryBar from "../components/workoutHistory/SessionSummaryBar";
import EmptyState from "../components/workoutHistory/EmptyState";
import HistorySkeleton from "../components/workoutHistory/HistorySkeleton";
import LoadErrorBanner from "../components/LoadErrorBanner";
import ConfirmDialog from "../components/ConfirmDialog";
import useFavoriteSessions from "../hooks/useFavoriteSessions";
import { DATE_RANGE_ALL } from "../constants/dateRanges";
import { DURATION_RANGE_ALL } from "../constants/durationRanges";
import {
  buildSessionSummaries,
  buildPRIndex,
  attachSessionPRs,
  attachPreviousBestToPRs,
  getSessionRecordKeys,
  getSessionMilestones,
  computeHistorySummary,
  filterSessionsBySearch,
  filterSessionsByMuscle,
  filterSessionsBySessionType,
  filterSessionsByDateRange,
  filterSessionsByDuration,
  filterSessionsByPROnly,
  filterSessionsByFavorites,
  sortSessions,
  getSessionTypeLabel,
} from "../utils/workoutUtils";
import { cardioPrHistory, buildCardioPRIndex } from "../progression/cardioProgressionEngine";

const DEFAULT_FILTERS = {
  search: "",
  muscle: "All",
  sessionType: "All",
  dateRange: DATE_RANGE_ALL,
  customStart: "",
  customEnd: "",
  duration: DURATION_RANGE_ALL,
  order: "newest",
  onlyPR: false,
  onlyFavorites: false,
};

function WorkoutHistory() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingSessionKey, setDeletingSessionKey] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());
  const [editingTimingSession, setEditingTimingSession] = useState(null);

  const sessionRefs = useRef({});
  const hasAppliedSessionDeepLink = useRef(false);

  const { favoriteKeys, isFavorite, toggleFavorite } = useFavoriteSessions();

  const fetchWorkouts = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await getWorkouts(500);
      setWorkouts(res.data);
    } catch (error) {
      console.log(error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkouts();
  }, []);

  useEffect(() => {
    setExpandedKeys(new Set());
  }, [filters]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const hasActiveFilters = useMemo(
    () => JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS),
    [filters]
  );

  const muscleOptions = useMemo(() => {
    const set = new Set(workouts.map((w) => w.exercise?.muscleGroup).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [workouts]);

  const prIndex = useMemo(() => buildPRIndex(workouts), [workouts]);
  const cardioPrIndex = useMemo(() => buildCardioPRIndex(workouts), [workouts]);
  const allSessions = useMemo(() => {
    const withPRs = attachSessionPRs(buildSessionSummaries(workouts), prIndex, cardioPrIndex);
    return attachPreviousBestToPRs(withPRs, workouts, cardioPrHistory(workouts));
  }, [workouts, prIndex, cardioPrIndex]);

  const { highestVolumeKeys, longestDurationKeys } = useMemo(
    () => getSessionRecordKeys(allSessions),
    [allSessions]
  );

  const milestonesByKey = useMemo(() => getSessionMilestones(allSessions), [allSessions]);

  const visibleSessions = useMemo(() => {
    let result = filterSessionsBySearch(allSessions, filters.search);
    result = filterSessionsByMuscle(result, filters.muscle);
    result = filterSessionsBySessionType(result, filters.sessionType);
    result = filterSessionsByDateRange(result, filters.dateRange, filters.customStart, filters.customEnd);
    result = filterSessionsByDuration(result, filters.duration);
    result = filterSessionsByPROnly(result, filters.onlyPR);
    result = filterSessionsByFavorites(result, filters.onlyFavorites, favoriteKeys);
    result = sortSessions(result, filters.order);
    return result;
  }, [allSessions, filters, favoriteKeys]);

  useEffect(() => {
    if (hasAppliedSessionDeepLink.current) return;
    const sessionId = searchParams.get("expandSession");
    if (!sessionId || loading) return;

    const match = visibleSessions.find((s) => s.sessionId === sessionId);
    if (!match) return;

    hasAppliedSessionDeepLink.current = true;
    setExpandedKeys((prev) => new Set([...prev, match.key]));

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      sessionRefs.current[match.key]?.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
      });
    });

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("expandSession");
        return next;
      },
      { replace: true }
    );
  }, [searchParams, loading, visibleSessions, setSearchParams]);

  const summary = useMemo(() => computeHistorySummary(visibleSessions), [visibleSessions]);

  const toggleExpanded = (key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const [pendingDelete, setPendingDelete] = useState(null);

  const handleDelete = (workout) => {
    setPendingDelete({ type: "workout", workout });
  };

  const handleDeleteSession = (session) => {
    setPendingDelete({ type: "session", session });
  };

  const handleCancelDelete = () => setPendingDelete(null);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;

    if (pendingDelete.type === "workout") {
      const { workout } = pendingDelete;
      setPendingDelete(null);
      setDeletingId(workout._id);
      try {
        await api.delete(`/workouts/${workout._id}`);
        setWorkouts((prev) => prev.filter((w) => w._id !== workout._id));
      } catch (error) {
        console.log(error);
      } finally {
        setDeletingId(null);
      }
      return;
    }

    const { session } = pendingDelete;
    setPendingDelete(null);
    setDeletingSessionKey(session.key);
    try {
      if (session.sessionId) {
        await api.delete(`/workouts/session/${session.sessionId}`);
      } else {
        await api.delete(`/workouts/${session.workouts[0]._id}`);
      }

      const deletedIds = new Set(session.workouts.map((w) => w._id));
      setWorkouts((prev) => prev.filter((w) => !deletedIds.has(w._id)));
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        next.delete(session.key);
        return next;
      });
    } catch (error) {
      console.log(error);
    } finally {
      setDeletingSessionKey(null);
    }
  };

  const handleTimingSaved = (updated) => {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.sessionId === updated.sessionId
          ? {
              ...w,
              startedAt: updated.startedAt,
              endedAt: updated.endedAt,
              sessionDuration: updated.sessionDuration,
              timingMode: updated.timingMode,
            }
          : w
      )
    );
  };

  const hasAnyWorkouts = workouts.length > 0;

  return (
    <div className="history-page">
      <main className="history-main">
        {loadError && (
          <LoadErrorBanner
            message="Couldn't load your workout history. Check your connection and try again."
            onRetry={fetchWorkouts}
          />
        )}

        <div className="history-header">
          <h1>Workout History</h1>
          <p>
            {visibleSessions.length} session{visibleSessions.length !== 1 ? "s" : ""}
          </p>
        </div>

        <HistoryFilterBar
          filters={filters}
          muscleOptions={muscleOptions}
          onChange={updateFilter}
          onClear={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        <SessionSummaryBar summary={summary} />

        {loading ? (
          <HistorySkeleton />
        ) : !hasAnyWorkouts ? (
          <EmptyState
            icon={Dumbbell}
            title="No workouts logged yet"
            message="Start your first workout to begin building your training history."
            action={
              <button
                type="button"
                className="history-empty-btn"
                onClick={() => navigate("/dashboard")}
              >
                Go to Dashboard
              </button>
            }
          />
        ) : visibleSessions.length === 0 && filters.onlyPR ? (
          <EmptyState
            icon={Trophy}
            title="No PR workouts yet"
            message="Keep training — your next personal record will show up here automatically."
          />
        ) : visibleSessions.length === 0 ? (
          <EmptyState
            icon={FilterX}
            title="No workouts match your filters"
            message="Try adjusting your search or filters."
            action={
              hasActiveFilters ? (
                <button type="button" className="history-empty-btn" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : null
            }
          />
        ) : (
          <div className="history-list">
            {visibleSessions.map((session) => (
              <div key={session.key} ref={(el) => { sessionRefs.current[session.key] = el; }}>
                <SessionCard
                  session={session}
                  isExpanded={expandedKeys.has(session.key)}
                  onToggleExpand={() => toggleExpanded(session.key)}
                  isFavorite={isFavorite(session.key)}
                  onToggleFavorite={() => toggleFavorite(session.key)}
                  isHighestVolume={highestVolumeKeys.has(session.key)}
                  isLongestSession={longestDurationKeys.has(session.key)}
                  milestones={milestonesByKey.get(session.key)}
                  isDeletingSession={deletingSessionKey === session.key}
                  onDeleteSession={() => handleDeleteSession(session)}
                  deletingWorkoutId={deletingId}
                  onDeleteWorkout={handleDelete}
                  onEditTiming={() => setEditingTimingSession(session)}
                  workouts={workouts}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      <EditWorkoutTimingModal
        open={!!editingTimingSession}
        session={editingTimingSession}
        onClose={() => setEditingTimingSession(null)}
        onSaved={handleTimingSaved}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.type === "session" ? "Delete Session?" : "Delete Exercise?"}
        body={
          pendingDelete?.type === "workout"
            ? `"${pendingDelete.workout.exercise?.name || "This exercise"}" will be removed from this workout session.`
            : pendingDelete?.type === "session"
            ? `This will remove all ${pendingDelete.session.workouts.length} entr${
                pendingDelete.session.workouts.length !== 1 ? "ies" : "y"
              } in this ${getSessionTypeLabel(pendingDelete.session)}.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}

export default WorkoutHistory;
