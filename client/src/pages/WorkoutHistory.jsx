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
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingSessionKey, setDeletingSessionKey] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());
  const [editingTimingSession, setEditingTimingSession] = useState(null);

  // Phase 13C.1 — Deep Links: "PR notification -> Workout History ->
  // expand that session automatically" (?expandSession=<sessionId>, set
  // by notificationTriggers.js/NotificationCenter's navigate call).
  const sessionRefs = useRef({});
  const hasAppliedSessionDeepLink = useRef(false);

  const { favoriteKeys, isFavorite, toggleFavorite } = useFavoriteSessions();

  const fetchWorkouts = async () => {
    setLoading(true);
    try {
      const res = await getWorkouts(500);
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

  // Collapse any expanded session cards whenever the active filters
  // change, so expansion state never persists across a different
  // visible set of sessions.
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

  // Workouts are grouped into sessions + PR-tagged exactly once per
  // `workouts` change. Filtering, muscle-matching, and sorting below all
  // operate on this already-grouped + already-summarized list, so a
  // session's stats/PRs are never recalculated just because a filter or
  // sort order changed.
  const prIndex = useMemo(() => buildPRIndex(workouts), [workouts]);
  // Phase 12 — same pattern as prIndex above, parallel index for cardio
  // PR events (distance/pace/duration/calories records per activity).
  // Passed alongside prIndex into attachSessionPRs, which merges both
  // into the same session.prs array (see that function's own comment).
  const cardioPrIndex = useMemo(() => buildCardioPRIndex(workouts), [workouts]);
  const allSessions = useMemo(() => {
    const withPRs = attachSessionPRs(buildSessionSummaries(workouts), prIndex, cardioPrIndex);
    // Cross-references the same prHistory/cardioPrHistory streams a
    // second time (no re-detection) to attach "previous best" onto each
    // PR already found above, for the timeline's PR celebration (Phase
    // 10B, extended to cardio in Phase 12).
    return attachPreviousBestToPRs(withPRs, workouts, cardioPrHistory(workouts));
  }, [workouts, prIndex, cardioPrIndex]);

  // "Best session ever" superlatives are computed over the FULL session
  // list, not the filtered one, so a card's Highest Volume/Longest
  // Session badge never shifts depending on which filters happen to be
  // active — see getSessionRecordKeys' own doc comment.
  const { highestVolumeKeys, longestDurationKeys } = useMemo(
    () => getSessionRecordKeys(allSessions),
    [allSessions]
  );

  // Session Timeline milestones (Phase 10B) — same "computed once over
  // the full list" rule as the superlatives above, so a milestone chip
  // doesn't flicker depending on active filters.
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

  // Deep link from a PR/Longest-Workout notification
  // (/workouts?expandSession=<sessionId>) — waits for sessions to load,
  // expands the matching one, scrolls it into view, then strips the
  // param so a refresh doesn't re-trigger it. Same ref-guard pattern
  // Calendar.jsx's own date deep link already uses.
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

  // Reacts to the active filters (e.g. narrows to "This Month" averages
  // when that date range is selected) rather than always summarizing
  // the entire history.
  const summary = useMemo(() => computeHistorySummary(visibleSessions), [visibleSessions]);

  const toggleExpanded = (key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDelete = async (workout) => {
    const exerciseName = workout.exercise?.name || "this exercise";
    const confirmed = window.confirm(
      `Delete "${exerciseName}" from this workout session?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(workout._id);
    try {
      await api.delete(`/workouts/${workout._id}`);
      // Removing the workout from state automatically re-groups on the next
      // render via the `allSessions` memo above. If this was the last
      // exercise in its session, the session card simply disappears —
      // no extra bookkeeping needed.
      setWorkouts((prev) => prev.filter((w) => w._id !== workout._id));
    } catch (error) {
      console.log(error);
    } finally {
      setDeletingId(null);
    }
  };

  // Deletes an entire session in one request when it has a real sessionId
  // (POST /workouts/session-created workouts), or falls back to the
  // existing single-workout delete for legacy standalone sessions, which
  // are always exactly one workout with no sessionId. Either way, local
  // state is updated directly — no refetch, card disappears immediately.
  const handleDeleteSession = async (session) => {
    const label = getSessionTypeLabel(session);
    const entryCount = session.workouts.length;
    const confirmed = window.confirm(
      `Delete this entire ${label}? This will remove all ${entryCount} entr${
        entryCount !== 1 ? "ies" : "y"
      } in this session.\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

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

  // Applies the response from PUT /workouts/session/:id/timing (same
  // startedAt/endedAt/sessionDuration/timingMode the backend just wrote
  // to every document in the session) to every one of THIS session's
  // workout documents in local state — mirrors the backend's own
  // updateMany-by-sessionId, no refetch needed.
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
    </div>
  );
}

export default WorkoutHistory;
