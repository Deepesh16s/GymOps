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
  HeartPulse,
  MapPin,
  Timer,
  Zap,
} from "lucide-react";
import "./progression.css";

import { getWorkouts } from "../services/workoutService";
import { formatDate } from "../utils/dateUtils";
import { isCardioEntry } from "../utils/workoutUtils";
import { prHistory } from "../utils/strengthUtils";
import FilterBar from "../components/progression/FilterBar";
import ProgressSummary from "../components/progression/ProgressSummary";
import TrendChart from "../components/progression/TrendChart";
import MuscleTrendChart from "../components/progression/MuscleTrendChart";
import ExerciseSessionChart from "../components/progression/ExerciseSessionChart";
import CardioSessionChart from "../components/progression/CardioSessionChart";
import MetricCard from "../components/progression/MetricCard";
import WorkoutLogTable from "../components/progression/WorkoutLogTable";
import DistributionRow from "../components/progression/DistributionRow";
import ConfidenceBadge from "../components/ConfidenceBadge";
import LoadErrorBanner from "../components/LoadErrorBanner";
import AdvancedInsights from "../components/progression/AdvancedInsights";
import { getExercisePlateau } from "../intelligence/plateauEngine";
import { getOverloadSuggestion } from "../intelligence/overloadEngine";
import { getMuscleRecoveryScores } from "../intelligence/recoveryEngine";
import {
  DEFAULT_TIME_RANGE,
  DEFAULT_METRIC,
  EXERCISE_DEFAULT_METRIC,
  MUSCLE_DEFAULT_METRIC,
  PROGRESSION_METRICS,
  EXERCISE_ONLY_METRICS,
  MUSCLE_ONLY_METRICS,
  SESSION_DURATION_METRIC,
  getMetricDef,
  getAvailableMuscles,
  getAvailableExercises,
  getOverallProgression,
  getMuscleProgression,
  getExerciseProgression,
  buildExerciseSessionSeries,
  filterWorkoutsByMuscle,
  filterWorkoutsByExercise,
  filterWorkoutsByTimeRange,
  getAvailableCardioActivities,
  getCardioActivityProgression,
  filterWorkoutsByCardioActivity,
  CARDIO_METRICS_REGISTRY,
  CARDIO_DEFAULT_METRIC,
  getCardioMetricDef,
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
  const [loadError, setLoadError] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const [viewMode, setViewMode] = useState(() => {
    if (searchParams.get("exercise")) return "exercise";
    if (searchParams.get("muscle")) return "muscle";
    if (searchParams.get("activity")) return "cardio";
    return "overall";
  });
  const [muscle, setMuscle] = useState(() => searchParams.get("muscle") || "");
  const [exercise, setExercise] = useState(() => searchParams.get("exercise") || "");
  const [cardioActivity, setCardioActivity] = useState(() => searchParams.get("activity") || "");
  const [timeRange, setTimeRange] = useState(DEFAULT_TIME_RANGE);
  const [metric, setMetric] = useState(DEFAULT_METRIC);
  const [showMovingAverage, setShowMovingAverage] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const res = await getWorkouts(5000);
        if (!cancelled) setWorkouts(res.data);
      } catch (err) {
        console.error("Progression fetch error:", err);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [retryTrigger]);

  useEffect(() => {
    const next = {};
    if (viewMode === "muscle" && muscle) next.muscle = muscle;
    if (viewMode === "exercise" && exercise) next.exercise = exercise;
    if (viewMode === "cardio" && cardioActivity) next.activity = cardioActivity;
    setSearchParams(next, { replace: true });
  }, [viewMode, muscle, exercise, cardioActivity]);

  const availableMuscles = useMemo(() => getAvailableMuscles(workouts), [workouts]);
  const availableExercises = useMemo(
    () => getAvailableExercises(workouts, viewMode === "muscle" ? muscle : null),
    [workouts, viewMode, muscle]
  );
  const availableCardioActivities = useMemo(() => getAvailableCardioActivities(workouts), [workouts]);

  useEffect(() => {
    if (viewMode === "muscle" && !muscle && availableMuscles.length) {
      setMuscle(availableMuscles[0]);
    }
    if (viewMode === "exercise" && !exercise && availableExercises.length) {
      setExercise(availableExercises[0]);
    }
    if (viewMode === "cardio" && !cardioActivity && availableCardioActivities.length) {
      setCardioActivity(availableCardioActivities[0]);
    }
  }, [viewMode, availableMuscles, availableExercises, availableCardioActivities]);

  const overall = useMemo(
    () => getOverallProgression(workouts, { rangeKey: timeRange }),
    [workouts, timeRange]
  );

  const RECENT_PR_WINDOW_DAYS = 14;
  const recentPr = useMemo(() => {
    const events = prHistory(workouts);
    if (!events.length) return null;
    const latest = events[events.length - 1];
    const daysAgo = Math.floor((Date.now() - new Date(latest.date).getTime()) / 86400000);
    if (daysAgo > RECENT_PR_WINDOW_DAYS) return null;
    return { ...latest, daysAgo };
  }, [workouts]);
  const muscleProgression = useMemo(
    () => (muscle ? getMuscleProgression(workouts, muscle, { rangeKey: timeRange }) : null),
    [workouts, muscle, timeRange]
  );
  const exerciseProgression = useMemo(
    () => (exercise ? getExerciseProgression(workouts, exercise, { rangeKey: timeRange }) : null),
    [workouts, exercise, timeRange]
  );
  const cardioProgression = useMemo(
    () =>
      cardioActivity
        ? getCardioActivityProgression(workouts, cardioActivity, { rangeKey: timeRange })
        : null,
    [workouts, cardioActivity, timeRange]
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

  const metricOptions = useMemo(() => {
    if (viewMode === "cardio") return CARDIO_METRICS_REGISTRY;

    const base = hasSessionDuration ? [...PROGRESSION_METRICS, SESSION_DURATION_METRIC] : PROGRESSION_METRICS;
    if (viewMode === "exercise") return [...EXERCISE_ONLY_METRICS, ...base];
    if (viewMode === "muscle") return [...MUSCLE_ONLY_METRICS, ...base];
    return base;
  }, [hasSessionDuration, viewMode]);

  useEffect(() => {
    if (!metricOptions.find((m) => m.key === metric)) setMetric(DEFAULT_METRIC);
  }, [metricOptions, metric]);

  useEffect(() => {
    setMetric(
      viewMode === "exercise"
        ? EXERCISE_DEFAULT_METRIC
        : viewMode === "muscle"
        ? MUSCLE_DEFAULT_METRIC
        : viewMode === "cardio"
        ? CARDIO_DEFAULT_METRIC
        : DEFAULT_METRIC
    );
  }, [viewMode]);

  const metricDef =
    viewMode === "cardio" ? getCardioMetricDef(metric) : getMetricDef(metric) || PROGRESSION_METRICS[0];

  const activeTrend =
    viewMode === "muscle"
      ? muscleProgression?.trend?.[metric] || muscleProgression?.trend?.volume
      : viewMode === "exercise"
      ? exerciseProgression?.trend?.[metric] || exerciseProgression?.trend?.estOneRM
      : viewMode === "cardio"
      ? cardioProgression?.trend?.[metric] || cardioProgression?.trend?.distance
      : overall.trend?.[metric] || overall.trend?.volume;

  const scopedWorkouts = useMemo(() => {
    let scoped = filterWorkoutsByTimeRange(workouts, timeRange);
    if (viewMode === "muscle" && muscle) scoped = filterWorkoutsByMuscle(scoped, muscle);
    if (viewMode === "exercise" && exercise) scoped = filterWorkoutsByExercise(scoped, exercise);
    return scoped
      .filter((w) => !isCardioEntry(w))
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  }, [workouts, timeRange, viewMode, muscle, exercise]);

  const exerciseSessionSeries = useMemo(
    () => (viewMode === "exercise" ? buildExerciseSessionSeries(scopedWorkouts) : []),
    [viewMode, scopedWorkouts]
  );

  const exercisePlateau = useMemo(
    () =>
      viewMode === "exercise" && exercise ? getExercisePlateau(workouts, exercise, { rangeKey: timeRange }) : null,
    [viewMode, exercise, workouts, timeRange]
  );
  const exerciseOverloadSuggestion = useMemo(
    () =>
      viewMode === "exercise" && exercise ? getOverloadSuggestion(workouts, exercise, { rangeKey: timeRange }) : null,
    [viewMode, exercise, workouts, timeRange]
  );
  const exerciseMuscleGroup =
    viewMode === "exercise" ? scopedWorkouts[0]?.exercise?.muscleGroup || null : null;
  const muscleRecoveryScores = useMemo(() => getMuscleRecoveryScores(workouts), [workouts]);
  const exerciseRecovery = useMemo(
    () => (exerciseMuscleGroup ? muscleRecoveryScores.find((r) => r.muscle === exerciseMuscleGroup) || null : null),
    [exerciseMuscleGroup, muscleRecoveryScores]
  );
  const hasExerciseIntel =
    (exercisePlateau && exercisePlateau.plateauLevel !== "None") ||
    !!exerciseRecovery ||
    (exerciseOverloadSuggestion?.available && exerciseOverloadSuggestion.metric !== "hold");

  const cardioScopedWorkouts = useMemo(() => {
    let scoped = filterWorkoutsByTimeRange(workouts, timeRange);
    scoped = cardioActivity ? filterWorkoutsByCardioActivity(scoped, cardioActivity) : scoped.filter(isCardioEntry);
    return scoped.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  }, [workouts, timeRange, cardioActivity]);

  const handleSelectExerciseFromDistribution = (name) => {
    setViewMode("exercise");
    setExercise(name);
  };

  const hasAnyStrengthData = workouts.some((w) => w.entryType !== "cardio");
  const hasAnyCardioData = workouts.some(isCardioEntry);

  useEffect(() => {
    if (
      !loading &&
      !hasAnyStrengthData &&
      hasAnyCardioData &&
      !searchParams.get("muscle") &&
      !searchParams.get("exercise") &&
      !searchParams.get("activity")
    ) {
      setViewMode((prev) => (prev === "overall" ? "cardio" : prev));
    }
  }, [loading, hasAnyStrengthData, hasAnyCardioData]);

  if (!loading && !hasAnyStrengthData && !hasAnyCardioData) {
    return (
      <div className="progression-page">
        <main className="progression-main">
          <div className="progression-empty-page">
            <div className="progression-empty-page__icon">
              <TrendingUp size={28} strokeWidth={1.6} />
            </div>
            <h1>Progression</h1>
            <p>Log your first workout and your progression story starts here.</p>
            <button type="button" className="progression-empty-page__btn" onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="progression-page">
      <main className="progression-main">
        {loadError && (
          <LoadErrorBanner
            message="Couldn't load your training history. Check your connection and try again."
            onRetry={() => setRetryTrigger((t) => t + 1)}
          />
        )}

        <section className="progression-hero">
          <div className="progression-hero__top">
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
          </div>
          {recentPr && (
            <div className="progression-hero__pr">
              <span className="progression-hero__pr-icon">
                <Trophy size={16} strokeWidth={2} />
              </span>
              <div className="progression-hero__pr-body">
                <p className="progression-hero__pr-label">
                  New PR {recentPr.daysAgo === 0 ? "today" : recentPr.daysAgo === 1 ? "yesterday" : `${recentPr.daysAgo} days ago`}
                </p>
                <p className="progression-hero__pr-value">
                  {recentPr.exercise} — <strong>{recentPr.weight} kg × {recentPr.reps}</strong>
                </p>
              </div>
            </div>
          )}
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
          cardioActivity={cardioActivity}
          onCardioActivityChange={setCardioActivity}
          availableCardioActivities={availableCardioActivities}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />

        <section
          className={`progression-panel progression-timeline-hero${
            activeTrend?.direction ? ` progression-timeline-hero--${activeTrend.direction}` : ""
          }`}
        >
          <div className="progression-panel__label-row">
            <p className="progression-panel__label">
              {viewMode === "exercise"
                ? `${exercise} · ${metricDef.label} Progression`
                : viewMode === "cardio"
                ? `${cardioActivity || "Cardio"} · ${metricDef.label} Progression`
                : "Timeline"}
            </p>
            <div className="progression-panel__label-row-controls">
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
              {viewMode !== "exercise" && viewMode !== "cardio" && (
                <label className="progression-filterbar__toggle">
                  <input
                    type="checkbox"
                    checked={showMovingAverage}
                    onChange={(e) => setShowMovingAverage(e.target.checked)}
                  />
                  Moving average
                </label>
              )}
            </div>
          </div>
          {viewMode === "exercise" && (
            <ExerciseSessionChart
              series={exerciseSessionSeries}
              metricKey={metric}
              metricDef={metricDef}
              loading={loading}
              height={340}
            />
          )}
          {viewMode === "cardio" && cardioActivity && (
            <CardioSessionChart
              series={cardioProgression?.series || []}
              metricKey={metric}
              metricDef={metricDef}
              loading={loading}
              height={340}
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
              height={340}
              emptyTitle="No training history yet"
              emptyMessage="Log a few sessions to see your overall progression graph."
            />
          )}

          {viewMode === "exercise" && exerciseProgression && hasExerciseIntel && (
            <div className="progression-intel-row">
              {exercisePlateau && exercisePlateau.plateauLevel !== "None" && (
                <span className="progression-intel-row__item">
                  <span
                    className={`distribution-row__badge distribution-row__badge--${
                      exercisePlateau.plateauLevel === "Confirmed" ? "danger" : "warning"
                    }`}
                  >
                    {exercisePlateau.plateauLevel === "Confirmed" ? "Plateau Confirmed" : "Possible Plateau"}
                    {exercisePlateau.maskedByVolume ? " · volume masked" : ""}
                  </span>
                  <ConfidenceBadge level={exercisePlateau.confidence} reason={exercisePlateau.confidenceReason} label="Plateau read" />
                </span>
              )}

              {exerciseRecovery && (
                <span className="progression-intel-row__item">
                  <span
                    className={`distribution-row__badge distribution-row__badge--${
                      exerciseRecovery.status === "Recovered"
                        ? "balanced"
                        : exerciseRecovery.status === "Recovering"
                        ? "warning"
                        : "danger"
                    }`}
                  >
                    {exerciseRecovery.muscle}: {exerciseRecovery.status}
                  </span>
                  <ConfidenceBadge level={exerciseRecovery.confidence} reason={exerciseRecovery.confidenceReason} label="Recovery estimate" />
                </span>
              )}

              {exerciseOverloadSuggestion?.available && exerciseOverloadSuggestion.metric !== "hold" && (
                <span className="progression-intel-row__item">
                  <span className="trend-badge trend-badge--up">
                    Next: {exerciseOverloadSuggestion.suggested.weight} kg × {exerciseOverloadSuggestion.suggested.reps}
                  </span>
                  <ConfidenceBadge
                    level={exerciseOverloadSuggestion.confidence}
                    reason={exerciseOverloadSuggestion.confidenceReason}
                    label="Suggested target"
                  />
                </span>
              )}
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
          <WorkoutLogTable
            workouts={viewMode === "cardio" ? cardioScopedWorkouts : scopedWorkouts}
            loading={loading}
          />
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
              <MetricCard
                label="Total Volume"
                icon={TrendingUp}
                value={`${(exerciseProgression.stats.totalVolume || 0).toLocaleString()} kg`}
              />
              <MetricCard
                label="Average Weight"
                icon={Layers}
                value={
                  exerciseProgression.stats.avgWorkingWeight != null
                    ? `${exerciseProgression.stats.avgWorkingWeight} kg`
                    : "—"
                }
                trend={exerciseProgression.trend.workingWeight}
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
            </div>
          )}

          {viewMode === "cardio" && cardioProgression && (
            <div className="progression-stats-rail">
              <MetricCard
                label="Total Distance"
                icon={MapPin}
                value={`${cardioProgression.stats.totalDistance} km`}
                trend={cardioProgression.trend.distance}
              />
              <MetricCard label="Total Duration" icon={Timer} value={`${cardioProgression.stats.totalDuration} min`} />
              <MetricCard
                label="Best Pace"
                icon={Zap}
                value={cardioProgression.stats.bestEver?.pace ? `${cardioProgression.stats.bestEver.pace} min/km` : "—"}
                trend={cardioProgression.trend.pace}
              />
              <MetricCard label="Total Sessions" icon={HeartPulse} value={cardioProgression.stats.totalSessions} />
              <MetricCard
                label="First Logged"
                icon={Calendar}
                value={
                  cardioProgression.stats.firstLoggedDate
                    ? formatDate(cardioProgression.stats.firstLoggedDate)
                    : "—"
                }
              />
              <MetricCard
                label="Best Distance"
                icon={Trophy}
                value={cardioProgression.stats.bestEver?.distance ? `${cardioProgression.stats.bestEver.distance} km` : "—"}
              />
            </div>
          )}
        </div>

        <AdvancedInsights />

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
