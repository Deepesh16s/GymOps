import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Trophy,
  Dumbbell,
  Calendar,
  Repeat,
  Flame,
  Layers,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import "./progression.css";

import { getWorkouts } from "../services/workoutService";
import { formatDate } from "../utils/dateUtils";
import { isCardioEntry } from "../utils/workoutUtils";
import FilterBar from "../components/progression/FilterBar";
import ProgressSummary from "../components/progression/ProgressSummary";
import TrendChart from "../components/progression/TrendChart";
import MuscleTrendChart from "../components/progression/MuscleTrendChart";
import ExerciseTrendChart from "../components/progression/ExerciseTrendChart";
import TimelineChart from "../components/progression/TimelineChart";
import MetricCard from "../components/progression/MetricCard";
import WorkoutLogTable from "../components/progression/WorkoutLogTable";
import DistributionRow from "../components/progression/DistributionRow";
import {
  DEFAULT_TIME_RANGE,
  DEFAULT_METRIC,
  PROGRESSION_METRICS,
  SESSION_DURATION_METRIC,
  getMetricDef,
  getAvailableMuscles,
  getAvailableExercises,
  getOverallProgression,
  getMuscleProgression,
  getExerciseProgression,
  buildRecordTimeline,
  filterWorkoutsByMuscle,
  filterWorkoutsByExercise,
  filterWorkoutsByTimeRange,
} from "../progression";

function formatLastTrained(date) {
  if (!date) return "—";
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(date);
}

function Progression() {
  const [searchParams, setSearchParams] = useSearchParams();

  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState(() => {
    if (searchParams.get("exercise")) return "exercise";
    if (searchParams.get("muscle")) return "muscle";
    return "overall";
  });
  const [muscle, setMuscle] = useState(() => searchParams.get("muscle") || "");
  const [exercise, setExercise] = useState(() => searchParams.get("exercise") || "");
  const [timeRange, setTimeRange] = useState(DEFAULT_TIME_RANGE);
  const [metric, setMetric] = useState(DEFAULT_METRIC);
  const [showMovingAverage, setShowMovingAverage] = useState(false);
  // Advanced Analytics (the line-chart metric explorer) is secondary to
  // the Timeline hero — collapsed by default so the default experience
  // stays focused on "how did I improve", not a wall of charts.
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Progression is explicitly a lifetime-first view — fetch a much
        // higher ceiling than the 500-workout convention used elsewhere
        // (Dashboard/Analytics/Workout History) so "first workout ever"
        // genuinely means the first one, even for long-tenured users.
        const res = await getWorkouts(5000);
        if (!cancelled) setWorkouts(res.data);
      } catch (err) {
        console.error("Progression fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the URL in sync so a Dashboard deep link (?muscle=Chest) is
  // shareable/bookmarkable and survives a refresh.
  useEffect(() => {
    const next = {};
    if (viewMode === "muscle" && muscle) next.muscle = muscle;
    if (viewMode === "exercise" && exercise) next.exercise = exercise;
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, muscle, exercise]);

  const availableMuscles = useMemo(() => getAvailableMuscles(workouts), [workouts]);
  const availableExercises = useMemo(
    () => getAvailableExercises(workouts, viewMode === "muscle" ? muscle : null),
    [workouts, viewMode, muscle]
  );

  useEffect(() => {
    if (viewMode === "muscle" && !muscle && availableMuscles.length) {
      setMuscle(availableMuscles[0]);
    }
    if (viewMode === "exercise" && !exercise && availableExercises.length) {
      setExercise(availableExercises[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, availableMuscles, availableExercises]);

  const overall = useMemo(
    () => getOverallProgression(workouts, { rangeKey: timeRange }),
    [workouts, timeRange]
  );
  const muscleProgression = useMemo(
    () => (muscle ? getMuscleProgression(workouts, muscle, { rangeKey: timeRange }) : null),
    [workouts, muscle, timeRange]
  );
  const exerciseProgression = useMemo(
    () => (exercise ? getExerciseProgression(workouts, exercise, { rangeKey: timeRange }) : null),
    [workouts, exercise, timeRange]
  );
  const activeSeries =
    viewMode === "muscle"
      ? muscleProgression?.series || []
      : viewMode === "exercise"
      ? exerciseProgression?.series || []
      : overall.series;

  const hasSessionDuration =
    viewMode === "muscle"
      ? !!muscleProgression?.hasSessionDuration
      : viewMode === "exercise"
      ? !!exerciseProgression?.hasSessionDuration
      : overall.hasSessionDuration;

  const metricOptions = useMemo(
    () => (hasSessionDuration ? [...PROGRESSION_METRICS, SESSION_DURATION_METRIC] : PROGRESSION_METRICS),
    [hasSessionDuration]
  );

  useEffect(() => {
    if (!metricOptions.find((m) => m.key === metric)) setMetric(DEFAULT_METRIC);
  }, [metricOptions, metric]);

  const metricDef = getMetricDef(metric) || PROGRESSION_METRICS[0];

  const activeTrend =
    viewMode === "muscle"
      ? muscleProgression?.trend?.[metric] || muscleProgression?.trend?.volume
      : viewMode === "exercise"
      ? exerciseProgression?.trend?.[metric] || exerciseProgression?.trend?.estOneRM
      : overall.trend?.[metric] || overall.trend?.volume;

  // Raw backing data for whatever the chart above is currently scoped to
  // — same filters (muscle/exercise/time range) applied to the exact
  // same `workouts` array, just not bucketed/aggregated. Newest first,
  // matching Workout History's convention.
  const scopedWorkouts = useMemo(() => {
    let scoped = filterWorkoutsByTimeRange(workouts, timeRange);
    if (viewMode === "muscle" && muscle) scoped = filterWorkoutsByMuscle(scoped, muscle);
    if (viewMode === "exercise" && exercise) scoped = filterWorkoutsByExercise(scoped, exercise);
    return scoped
      .filter((w) => !isCardioEntry(w))
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  }, [workouts, timeRange, viewMode, muscle, exercise]);

  // The Timeline is built from the exact same scoped workouts as the
  // Workout Log right below it, so every record shown always traces
  // back to a row a reader can find in that table.
  const recordTimelineSeries = useMemo(() => buildRecordTimeline(scopedWorkouts), [scopedWorkouts]);

  const handleSelectExerciseFromDistribution = (name) => {
    setViewMode("exercise");
    setExercise(name);
  };

  const hasAnyStrengthData = workouts.some((w) => w.entryType !== "cardio");

  if (!loading && !hasAnyStrengthData) {
    return (
      <div className="progression-page">
        <main className="progression-main">
          <div className="progression-empty-page">
            <div className="progression-empty-page__icon">
              <TrendingUp size={28} strokeWidth={1.6} />
            </div>
            <h1>Progression</h1>
            <p>Log your first strength workout and your progression story starts here.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="progression-page">
      <main className="progression-main">
        <section className="progression-hero">
          <div>
            <span className="progression-hero__eyebrow">
              <span className="progression-hero__dot" />
              Progression
            </span>
            <h1 className="progression-hero__title">Your Training Journey</h1>
            <p className="progression-hero__sub">
              From your first logged set to today — how you've progressed, where you improved,
              and where it's time to push again.
            </p>
          </div>
          <ProgressSummary summary={overall.summary} trend={overall.trend} loading={loading} />
        </section>

        <FilterBar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          muscle={muscle}
          onMuscleChange={setMuscle}
          availableMuscles={availableMuscles}
          exercise={exercise}
          onExerciseChange={setExercise}
          availableExercises={availableExercises}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />

        {/* HERO: this is the page's centerpiece — a real record ("PR")
            progression is the single most legible "am I improving" story
            a lifter can see, so Timeline + Workout Log sit right after
            the filters, ahead of Selected Statistics — the same figures
            already shown in the hero summary/trend badges above, so it's
            reference material rather than something that needs to be
            seen first. */}
        <section className="progression-panel progression-timeline-hero">
          <p className="progression-panel__label">
            {viewMode === "exercise"
              ? `${exercise} Timeline`
              : viewMode === "muscle"
              ? `${muscle} PR Timeline`
              : "Progression Timeline"}
          </p>
          <TimelineChart series={recordTimelineSeries} loading={loading} height={340} />

          {viewMode === "exercise" && exerciseProgression && (
            <div className="progression-timeline-hero__stats">
              <MetricCard
                label="Best Set"
                icon={Trophy}
                value={
                  exerciseProgression.stats.bestSet
                    ? `${exerciseProgression.stats.bestSet.weight} kg × ${exerciseProgression.stats.bestSet.reps}`
                    : "—"
                }
              />
              <MetricCard
                label="Volume"
                icon={TrendingUp}
                value={`${(exerciseProgression.stats.totalVolume || 0).toLocaleString()} kg`}
              />
              <MetricCard label="Sessions" icon={Dumbbell} value={exerciseProgression.stats.totalSessions} />
              <MetricCard
                label="Average Weight"
                icon={Layers}
                value={
                  exerciseProgression.stats.avgWorkingWeight != null
                    ? `${exerciseProgression.stats.avgWorkingWeight} kg`
                    : "—"
                }
              />
            </div>
          )}

          {viewMode === "muscle" && muscleProgression?.exerciseDistribution.length > 0 && (
            <div className="progression-timeline-hero__breakdown">
              <p className="progression-timeline-hero__breakdown-label">Exercise Breakdown</p>
              <div className="prog-exdist">
                {muscleProgression.exerciseDistribution.slice(0, 6).map((entry) => (
                  <DistributionRow
                    key={entry.exercise}
                    label={entry.exercise}
                    sub={`${entry.sets} sets`}
                    pct={entry.pct}
                    onSelect={() => handleSelectExerciseFromDistribution(entry.exercise)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="progression-panel">
          <p className="progression-panel__label">Workout Log</p>
          <WorkoutLogTable workouts={scopedWorkouts} loading={loading} />
        </div>

        <div className="progression-panel progression-panel--stats">
          <p className="progression-panel__label">Selected Statistics</p>

          {viewMode === "overall" && (
            <div className="progression-stats-rail">
              <MetricCard
                label="Total Volume"
                icon={TrendingUp}
                value={loading ? null : `${overall.summary.totalVolume.toLocaleString()} kg`}
                trend={overall.trend.volume}
                loading={loading}
              />
              <MetricCard
                label="Total Sets"
                icon={Layers}
                value={loading ? null : overall.summary.totalSets}
                loading={loading}
              />
              <MetricCard
                label="Sessions"
                icon={Dumbbell}
                value={loading ? null : overall.summary.totalSessions}
                trend={overall.trend.frequency}
                loading={loading}
              />
              <MetricCard
                label="Estimated 1RM Trend"
                icon={Flame}
                value={loading ? null : overall.trend.estOneRM ? `${overall.trend.estOneRM.changePct > 0 ? "+" : ""}${overall.trend.estOneRM.changePct}%` : "—"}
                trend={overall.trend.estOneRM}
                loading={loading}
              />
            </div>
          )}

          {viewMode === "muscle" && muscleProgression && (
            <div className="progression-stats-rail">
              <MetricCard
                label="Avg Weekly Volume"
                icon={TrendingUp}
                value={`${muscleProgression.stats.avgWeeklyVolume.toLocaleString()} kg`}
                trend={muscleProgression.trend.volume}
              />
              <MetricCard label="Total Sessions" icon={Dumbbell} value={muscleProgression.stats.totalSessions} />
              <MetricCard
                label="Last Trained"
                icon={Calendar}
                value={formatLastTrained(muscleProgression.stats.lastTrained)}
              />
              <MetricCard
                label="Best Exercise"
                icon={Trophy}
                value={muscleProgression.stats.bestExercise || "—"}
              />
              <MetricCard label="Sets Trend" icon={Layers} value={muscleProgression.trend.sets ? `${muscleProgression.trend.sets.changePct > 0 ? "+" : ""}${muscleProgression.trend.sets.changePct}%` : "—"} trend={muscleProgression.trend.sets} />
              <MetricCard
                label="Consistency"
                icon={Repeat}
                value={muscleProgression.consistency ? `${muscleProgression.consistency.percent}%` : "—"}
                sub={
                  muscleProgression.consistency
                    ? `${muscleProgression.consistency.weeksTrained}/${muscleProgression.consistency.totalWeeks} weeks`
                    : "Needs more history"
                }
              />
            </div>
          )}

          {viewMode === "exercise" && exerciseProgression && (
            <div className="progression-stats-rail">
              <MetricCard
                label="Best Set"
                icon={Trophy}
                value={
                  exerciseProgression.stats.bestSet
                    ? `${exerciseProgression.stats.bestSet.weight} kg × ${exerciseProgression.stats.bestSet.reps}`
                    : "—"
                }
              />
              <MetricCard
                label="Estimated 1RM"
                icon={Flame}
                value={
                  exerciseProgression.stats.bestSet
                    ? `${exerciseProgression.stats.bestSet.estOneRM} kg`
                    : "—"
                }
                trend={exerciseProgression.trend.estOneRM}
              />
              <MetricCard label="Total Sessions" icon={Dumbbell} value={exerciseProgression.stats.totalSessions} />
              <MetricCard
                label="First Logged"
                icon={Calendar}
                value={
                  exerciseProgression.stats.firstLoggedDate
                    ? formatDate(exerciseProgression.stats.firstLoggedDate)
                    : "—"
                }
              />
              <MetricCard
                label="Working Weight Trend"
                icon={TrendingUp}
                value={
                  exerciseProgression.trend.workingWeight
                    ? `${exerciseProgression.trend.workingWeight.changePct > 0 ? "+" : ""}${exerciseProgression.trend.workingWeight.changePct}%`
                    : "—"
                }
                trend={exerciseProgression.trend.workingWeight}
              />
            </div>
          )}
        </div>

        {/* Secondary/power-user view — collapsed by default so the
            default scroll stays: Timeline -> Workout Log -> Insights/PR,
            not a wall of line charts before the reader ever reaches
            those. */}
        <div className="progression-panel progression-advanced">
          <button
            type="button"
            className="progression-advanced__toggle"
            onClick={() => setAnalyticsOpen((v) => !v)}
            aria-expanded={analyticsOpen}
          >
            <ChevronRight
              size={16}
              strokeWidth={2.2}
              className={`progression-advanced__chevron ${analyticsOpen ? "progression-advanced__chevron--open" : ""}`}
            />
            Advanced Analytics
          </button>

          {analyticsOpen && (
            <div className="progression-advanced__body">
              <div className="progression-advanced__controls">
                <select
                  className="progression-filterbar__select"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                  aria-label="Select metric"
                >
                  {metricOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <label className="progression-filterbar__toggle">
                  <input
                    type="checkbox"
                    checked={showMovingAverage}
                    onChange={(e) => setShowMovingAverage(e.target.checked)}
                  />
                  Moving average
                </label>
              </div>

              {viewMode === "overall" && (
                <TrendChart
                  title="Overall Progression"
                  subtitle={metricDef.label}
                  series={activeSeries}
                  metricKey={metric}
                  metricDef={metricDef}
                  trend={activeTrend}
                  showMovingAverage={showMovingAverage}
                  loading={loading}
                  height={300}
                  emptyTitle="No training history yet"
                  emptyMessage="Log a few sessions to see your overall progression graph."
                />
              )}
              {viewMode === "muscle" && muscle && (
                <MuscleTrendChart
                  muscle={muscle}
                  metricDef={metricDef}
                  series={activeSeries}
                  trend={activeTrend}
                  showMovingAverage={showMovingAverage}
                  loading={loading}
                />
              )}
              {viewMode === "exercise" && exercise && (
                <ExerciseTrendChart
                  exercise={exercise}
                  metricDef={metricDef}
                  series={activeSeries}
                  trend={activeTrend}
                  showMovingAverage={showMovingAverage}
                  loading={loading}
                />
              )}
            </div>
          )}
        </div>

        {/* Cross-training Insights and Personal Records now live on the
            Analytics page (the app's single source of truth for both —
            see Analytics.jsx), so this scoped Progression view links out
            instead of keeping a second, narrower copy of the same data. */}
        <section className="progression-panel progression-analytics-pointer">
          <div>
            <p className="progression-panel__label" style={{ marginBottom: 4 }}>
              Insights &amp; Personal Records
            </p>
            <p className="prog-exdist__hint">
              Full training insights and your complete PR history now live on the Analytics page.
            </p>
          </div>
          <button
            type="button"
            className="progression-analytics-pointer__btn"
            onClick={() => navigate("/analytics")}
          >
            Open Analytics
            <ChevronRight size={14} strokeWidth={2.2} />
          </button>
        </section>
      </main>
    </div>
  );
}

export default Progression;
