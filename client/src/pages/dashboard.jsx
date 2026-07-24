import "./dashboard.css";
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Dumbbell,
  Flame,
  Activity,
  CalendarDays,
  BarChart2,
  Zap,
  Trophy,
  CalendarRange,
  TrendingUp,
  Plus,
  ChevronRight,
  ChevronDown,
  Timer,
  HeartPulse,
  CheckCircle2,
  X,
  MapPin,
  Target,
  Footprints,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import AddWorkoutModal from "../components/AddWorkoutModal";
import AnimatedNumber from "../components/AnimatedNumber";
import AddCardioModal from "../components/AddCardioModal";
import MuscleBodyMap from "../components/MuscleBodyMap";
import WorkoutSession from "../components/WorkoutSession";
import StartWorkoutModal from "../components/StartWorkoutModal";
import ResumeWorkoutPrompt from "../components/ResumeWorkoutPrompt";
import FinishWorkoutSummary from "../components/FinishWorkoutSummary";
import useWorkoutSession from "../hooks/useWorkoutSession";
import { getDashboardSummaryData } from "../services/dashboardService";
import { getWorkouts } from "../services/workoutService";
import { getGoals } from "../services/goalService";
import { getPlannedWorkouts } from "../services/plannedWorkoutService";
import { getDailySteps, setDailySteps } from "../services/dailyStepsService";
import { getSessionBadges, getLongestStreakEver } from "../progression/liveWorkoutEngine";
import { getDashboardInsights, getTodaysBrief } from "../utils/dashboardInsights";
import { generateReminders } from "../reminders/reminderEngine";
import { generateNotifications } from "../services/notificationService";
import { getCardioOverview } from "../progression/cardioProgressionEngine";
import { getGoalAnalytics } from "../utils/goalAnalytics";
import {
  buildSessionSummaries,
  sortSessions,
  formatSessionDate,
  getSessionTypeLabel,
  isCardioEntry,
  getCardioActivityLabel,
  formatCardioSummary,
  formatSetBreakdown,
  getSetCount,
  getWorkoutVolume,
  computeCurrentStreak,
} from "../utils/workoutUtils";
import { getSessionTypeColor } from "../constants/sessionTypes";
import { formatDurationLong, formatClockTime, formatRelativeTime } from "../utils/timeFormat";

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Same "YYYY-MM-DD, local time" convention Calendar.jsx's getLocalDateKey
// uses — the daily-steps log is keyed by the user's own local day, not
// UTC, so "today" here always matches what Calendar/goalMetrics.js mean
// by "today" too.
const getTodayDateKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Presentation-only: no new data fetched, just a friendlier read of the
// clock and the already-stored user name (same localStorage value
// ProfileDropdown already reads) instead of a static "Welcome back".
function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getFirstName() {
  try {
    const stored = JSON.parse(localStorage.getItem("user") || "null");
    return stored?.name?.trim().split(/\s+/)[0] || null;
  } catch {
    return null;
  }
}

// numericValue/formatValue are optional — when numericValue is a real
// number, the card counts up to it (AnimatedNumber) instead of snapping
// straight to `value`. Callers that only ever have a pre-formatted
// string (e.g. a cardio activity name where there's no number to
// animate) just omit numericValue and get the old plain-string
// behavior, unchanged.
function PrimaryCard({ title, value, numericValue, formatValue, sub, icon: Icon, accent, onClick }) {
  return (
    <div
      className={`primary-card ${accent ? "primary-card--accent" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="primary-card__icon">
        <Icon size={22} strokeWidth={1.8} />
      </div>
      <div className="primary-card__body">
        <span className="primary-card__label">{title}</span>
        <span className="primary-card__value">
          {numericValue != null ? (
            <AnimatedNumber value={numericValue} format={formatValue} />
          ) : (
            value ?? <SkeletonVal />
          )}
        </span>
        {sub && <span className="primary-card__sub">{sub}</span>}
      </div>
      <ChevronRight className="primary-card__arrow" size={16} />
    </div>
  );
}

function SecondaryCard({ title, value, sub, icon: Icon }) {
  return (
    <div className="secondary-card">
      <div className="secondary-card__head">
        <Icon size={16} strokeWidth={1.8} className="secondary-card__icon" />
        <span className="secondary-card__label">{title}</span>
      </div>
      <span className="secondary-card__value">{value ?? <SkeletonVal />}</span>
      {sub && <span className="secondary-card__sub">{sub}</span>}
    </div>
  );
}

// Steps are a passive all-day count the user sets once (from a phone/
// watch reading), not something logged per workout — see
// dailyStepsService.js. Renders a bare number when there's no matching
// Daily Steps goal, or adds a progress bar + Goal/Remaining line when
// one exists — same "no extra complexity when there's nothing to show"
// pattern the rest of this page already follows (e.g. LastSessionCard's
// empty state).
function TodayStepsCard({
  steps,
  dailyGoalTarget,
  loading,
  editing,
  inputValue,
  onInputChange,
  onEditStart,
  onSave,
  onCancel,
  saving,
}) {
  if (loading) {
    return (
      <div className="today-steps-card today-steps-card--premium">
        <span
          className="skeleton"
          style={{ width: "100%", height: 96, borderRadius: 16, display: "block" }}
        />
      </div>
    );
  }

  const hasGoal = dailyGoalTarget != null && dailyGoalTarget > 0;
  const percent = hasGoal ? Math.min(100, Math.round(((steps || 0) / dailyGoalTarget) * 100)) : 0;
  const remaining = hasGoal ? Math.max(0, dailyGoalTarget - (steps || 0)) : null;
  const isCloseToGoal = hasGoal && percent >= 90 && percent < 100;
  const isGoalMet = hasGoal && percent >= 100;

  return (
    <div
      className={`today-steps-card today-steps-card--premium${
        isGoalMet ? " today-steps-card--complete" : ""
      }`}
    >
      <div className="today-steps-card__icon-badge">
        <Footprints size={26} strokeWidth={2} />
      </div>

      <div className="today-steps-card__body">
        {editing ? (
          <div className="today-steps-card__edit">
            <input
              type="number"
              min="0"
              autoFocus
              value={inputValue}
              onChange={onInputChange}
              placeholder="e.g. 8532"
            />
            <div className="today-steps-card__edit-actions">
              <button type="button" onClick={onSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={onCancel} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="today-steps-card__value-btn" onClick={onEditStart}>
            <span className="today-steps-card__value">
              {steps != null ? (
                <AnimatedNumber value={steps} format={(n) => n.toLocaleString()} />
              ) : (
                "Log steps"
              )}
            </span>
            <span className="today-steps-card__value-label">Today's Steps</span>
          </button>
        )}

        {hasGoal && (
          <>
            <div
              className={`today-steps-card__bar${
                isCloseToGoal ? " today-steps-card__bar--pulse" : ""
              }`}
            >
              <div className="today-steps-card__bar-fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="today-steps-card__stats">
              <span>
                <strong>{dailyGoalTarget.toLocaleString()}</strong> Goal
              </span>
              <span>
                {isGoalMet ? (
                  <strong className="today-steps-card__goal-met">Goal reached 🎉</strong>
                ) : (
                  <>
                    <strong>{remaining.toLocaleString()}</strong> remaining
                  </>
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Priority 4 — each card is one entry from utils/dashboardInsights.js's
// getDashboardInsights(); the icon/color mapping (a presentational
// concern) lives here rather than in that pure data module, same
// separation cardioProgressionEngine.js's data vs. chart-component
// rendering already keeps.
const INSIGHT_ICON_BY_KEY = {
  recentPR: Trophy,
  weeklyStreak: Flame,
  volumeTrend: TrendingUp,
};

function InsightCard({ insight }) {
  const Icon = INSIGHT_ICON_BY_KEY[insight.key] || Zap;
  return (
    <div className={`insight-card insight-card--${insight.tone}`}>
      <div className="insight-card__icon">
        <Icon size={18} strokeWidth={2} />
      </div>
      <div className="insight-card__body">
        <span className="insight-card__title">{insight.title}</span>
        <span className="insight-card__detail">{insight.detail}</span>
      </div>
    </div>
  );
}

// Phase 12.5 — Today's Brief, now the hero's actual content (see the
// hero JSX below): up to 4 prescriptive items (workout recommendation,
// nearest goal, steps remaining, streak protection) from
// utils/dashboardInsights.js's getTodaysBrief(). Rendered as a plain
// checklist inside the hero card rather than a separate boxy-card grid
// — "Good Evening" + "Today's Brief" now read as one cohesive block.
const BRIEF_ICON_BY_KEY = {
  workoutRecommendation: Dumbbell,
  plannedWorkout: CalendarDays,
  goalFocus: Target,
  stepsFocus: Footprints,
  streakNudge: Flame,
};

// Phase 13B — the plannedWorkout brief item is the one entry in this
// list that can actually be acted on directly (every other item is
// informational), so it alone gets a clickable "Start" affordance,
// reusing the same startSessionFromPlan flow Calendar's "Start Planned
// Workout" button already triggers.
function BriefListItem({ item, onStartPlanned }) {
  const Icon = BRIEF_ICON_BY_KEY[item.key] || Zap;
  const isActionable = item.key === "plannedWorkout" && onStartPlanned;
  // Phase 13D, Part A.4 — Reminder Explanation: collapsed by default,
  // same "don't clutter" treatment as NotificationCenter's own "Why?"
  // disclosure — this hero strip is meant to stay a compact glance, not
  // grow extra always-visible lines.
  const [whyOpen, setWhyOpen] = useState(false);
  const hasExplanation = item.explanation?.length > 0;

  return (
    <li
      className={`hero-brief-item hero-brief-item--${item.tone} ${
        isActionable ? "hero-brief-item--actionable" : ""
      }`}
      onClick={isActionable ? () => onStartPlanned(item.plannedWorkoutId) : undefined}
      role={isActionable ? "button" : undefined}
      tabIndex={isActionable ? 0 : undefined}
      onKeyDown={
        isActionable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onStartPlanned(item.plannedWorkoutId);
              }
            }
          : undefined
      }
    >
      <span className="hero-brief-item__icon">
        <Icon size={13} strokeWidth={2.5} />
      </span>
      <span className="hero-brief-item__text">
        <strong>{item.title}</strong>
        {item.detail && <> — {item.detail}</>}
        {hasExplanation && (
          <>
            {" "}
            <button
              type="button"
              className="hero-brief-item__why-btn"
              aria-expanded={whyOpen}
              onClick={(e) => {
                e.stopPropagation();
                setWhyOpen((o) => !o);
              }}
            >
              Why?
            </button>
          </>
        )}
        {hasExplanation && whyOpen && (
          <ul className="hero-brief-item__why-list">
            {item.explanation.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </span>
      {isActionable && <span className="hero-brief-item__action">Start</span>}
    </li>
  );
}

// Priority 8 — a compact "see progress without opening Goals" widget.
// `goal.unit === "days"` identifies the two windowed Daily-style periods
// (goalController.js forces that unit specifically for those, overriding
// whatever metric-native unit the goal would otherwise have) — shown as
// a plain day-count fraction rather than a percentage, since "5 / 7
// days" is more legible than "71%" for a consistency goal. Every other
// goal type falls back to percent, reusing goalAnalytics.getGoalAnalytics
// (the same math Goals.jsx itself renders from) rather than
// re-deriving progress.
const formatGoalProgress = (goal, analytics) =>
  goal.unit === "days" ? `${goal.current} / ${goal.target} days` : `${analytics.percent}%`;

function GoalsWidget({ goals, onViewAll }) {
  const topGoals = goals
    .filter((g) => g.status !== "Completed")
    .map((g) => ({ goal: g, analytics: getGoalAnalytics(g) }))
    .sort((a, b) => b.analytics.percent - a.analytics.percent)
    .slice(0, 3);

  if (!topGoals.length) return null;

  return (
    <section className="section">
      <div className="goals-widget-head">
        <p className="section__label">Goals</p>
        <button type="button" className="goals-widget-link" onClick={onViewAll}>
          View all
        </button>
      </div>
      <div className="goals-widget dash-fade-in">
        {topGoals.map(({ goal, analytics }) => (
          <div className="goals-widget__row" key={goal._id}>
            <div className="goals-widget__row-top">
              <span className="goals-widget__title">{goal.title}</span>
              <span className="goals-widget__value">{formatGoalProgress(goal, analytics)}</span>
            </div>
            <div className="goals-widget__bar">
              <div
                className="goals-widget__bar-fill"
                style={{ width: `${Math.min(100, analytics.percent)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SkeletonVal() {
  return (
    <span
      className="skeleton"
      style={{ width: 64, height: 22, display: "inline-block", borderRadius: 6 }}
    />
  );
}

function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{label}</p>
      <p className="chart-tooltip__value">
        {Number(payload[0].value).toLocaleString()} kg
      </p>
    </div>
  );
}

// Last Session card. session is a buildSessionSummaries() entry — the
// same shape/data already fetched for Recent Sessions (recentSessions[0]
// is the latest one), reused here instead of the coarser
// /dashboard/session-summary aggregate so every exercise's actual sets
// (and every cardio entry's full metric breakdown) can be shown, not
// just exercise-name chips. No new request, no backend change — this
// is data the page already has.
function LastSessionCard({ session, loading }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="last-session-card">
        <span
          className="skeleton"
          style={{ width: "40%", height: 20, borderRadius: 6 }}
        />
        <span
          className="skeleton"
          style={{
            width: "100%",
            height: 60,
            borderRadius: 10,
            marginTop: 16,
            display: "block",
          }}
        />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="last-session-card last-session-card--empty dash-fade-in">
        <div className="empty-state__icon">
          <Dumbbell size={24} strokeWidth={1.6} />
        </div>
        <p>No sessions completed yet.</p>
      </div>
    );
  }

  const typeColor = getSessionTypeColor(session.sessionType);
  const label = getSessionTypeLabel(session);

  const strengthEntries = session.workouts.filter((w) => !isCardioEntry(w));
  const cardioEntries = session.workouts.filter((w) => isCardioEntry(w));

  const sessionTime = formatClockTime(session.date);

  return (
    <div className="last-session-card dash-fade-in">
      <div className="last-session-card__top">
        <div className="last-session-card__title-row">
          <span
            className="last-session-card__badge"
            style={{ background: typeColor.bg, color: typeColor.text }}
          >
            {label}
          </span>
          <span className="last-session-card__date">
            {formatSessionDate(session.date)} · {sessionTime}
          </span>
        </div>
        {session.sessionDuration != null && (
          <span className="last-session-card__duration">
            <Timer size={14} strokeWidth={1.8} />
            {session.startedAt && session.endedAt ? (
              <>
                {formatClockTime(session.startedAt)}
                {" – "}
                {formatClockTime(session.endedAt)}
                <span className="last-session-card__duration-sep">&bull;</span>
                {formatDurationLong(session.sessionDuration)}
              </>
            ) : (
              formatDurationLong(session.sessionDuration)
            )}
          </span>
        )}
      </div>

      {/* Workout Session Editing & Time Tracking discovery moment #2 — a
          quiet, easy-to-ignore nudge only shown here (the one place a
          user is most likely to notice a wrong duration right after
          logging), not a permanent fixture on every session everywhere. */}
      {session.sessionId && (
        <p className="last-session-card__timing-note">
          Timing doesn't match your actual workout?{" "}
          <button
            type="button"
            className="last-session-card__timing-note-link"
            onClick={() => navigate("/workouts")}
          >
            Edit it from Workouts.
          </button>
        </p>
      )}

      <div className="last-session-card__footer">
        {session.stats.exerciseCount > 0 && (
          <div className="last-session-card__stat">
            <span className="last-session-card__stat-label">Volume</span>
            <span className="last-session-card__stat-value">
              {session.stats.volume.toLocaleString()} kg
            </span>
          </div>
        )}
        {session.stats.muscles.length > 0 && (
          <div className="last-session-card__muscles">
            {session.stats.muscles.map((m) => (
              <span className="last-session-card__muscle-tag" key={m}>
                {m}
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          className="last-session-card__expand-btn"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide" : "View"} full details
          <ChevronDown
            size={14}
            strokeWidth={2}
            className={expanded ? "rotated" : ""}
          />
        </button>
      </div>

      {expanded && (
        <div className="last-session-card__detail-list">
          {strengthEntries.map((w) => (
            <div className="last-session-card__detail-item" key={w._id}>
              <div className="last-session-card__detail-item-head">
                <span className="last-session-card__detail-item-name">
                  <Dumbbell size={13} strokeWidth={1.8} />
                  {w.exercise?.name || "Unknown exercise"}
                </span>
                {w.exercise?.muscleGroup && (
                  <span className="last-session-card__detail-item-muscle">
                    {w.exercise.muscleGroup}
                  </span>
                )}
              </div>
              <p className="last-session-card__detail-item-sets">
                {formatSetBreakdown(w)}
              </p>
              <div className="last-session-card__detail-item-meta">
                <span>{getSetCount(w)} sets</span>
                <span>{getWorkoutVolume(w).toLocaleString()} kg</span>
              </div>
            </div>
          ))}

          {cardioEntries.map((w) => (
            <div className="last-session-card__detail-item" key={w._id}>
              <div className="last-session-card__detail-item-head">
                <span className="last-session-card__detail-item-name">
                  <HeartPulse size={13} strokeWidth={1.8} />
                  {getCardioActivityLabel(w)}
                </span>
              </div>
              <p className="last-session-card__detail-item-sets">
                {formatCardioSummary(w)
                  .map((m) => m.text)
                  .join(" · ")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Phase 9 — one Recent Sessions row. Reuses buildSessionSummaries'
// output shape and getSessionStats (already computed as session.stats)
// rather than recomputing volume/set-count/muscles itself.
//
// Phase 8A.1: session.workouts here are raw Workout documents (same
// shape consumed by WorkoutHistory.jsx / calendar.jsx), so cardio
// detection and formatting go through the centralized workoutUtils
// helpers instead of reimplementing them locally.
function RecentSessionRow({ session }) {
  const [expanded, setExpanded] = useState(false);
  const { stats } = session;
  const typeColor = getSessionTypeColor(session.sessionType);
  const label = getSessionTypeLabel(session);

  const strengthEntries = session.workouts.filter((w) => !isCardioEntry(w));
  const cardioEntries = session.workouts.filter((w) => isCardioEntry(w));

  return (
    <div className="recent-session-row">
      <div
        className="recent-session-row__main"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <span
          className="recent-session-row__badge"
          style={{ background: typeColor.bg, color: typeColor.text }}
        >
          {label}
        </span>

        <div className="recent-session-row__info">
          <p className="recent-session-row__meta">
            {session.sessionDuration != null &&
              `${session.sessionDuration} min · `}
            {strengthEntries.length > 0 &&
              `${strengthEntries.length} exercise${
                strengthEntries.length === 1 ? "" : "s"
              }`}
            {strengthEntries.length > 0 && cardioEntries.length > 0 && " · "}
            {cardioEntries.length > 0 &&
              `${cardioEntries.length} cardio activit${
                cardioEntries.length === 1 ? "y" : "ies"
              }`}
          </p>
          <p className="recent-session-row__time">
            Completed {formatRelativeTime(session.date)}
          </p>
        </div>

        {stats.volume > 0 && (
          <span className="recent-session-row__volume">
            {stats.volume.toLocaleString()} kg
          </span>
        )}

        <ChevronDown
          size={16}
          strokeWidth={2}
          className={`recent-session-row__chevron ${expanded ? "rotated" : ""}`}
        />
      </div>

      {expanded && (
        <div className="recent-session-row__detail">
          {strengthEntries.map((w) => (
            <div className="recent-session-row__detail-item" key={w._id}>
              <Dumbbell size={13} strokeWidth={1.8} />
              <span>{w.exercise?.name}</span>
            </div>
          ))}
          {cardioEntries.map((w) => {
            const durationMetric = formatCardioSummary(w).find(
              (m) => m.key === "duration"
            );
            return (
              <div className="recent-session-row__detail-item" key={w._id}>
                <HeartPulse size={13} strokeWidth={1.8} />
                <span>
                  {getCardioActivityLabel(w)}
                  {durationMetric ? ` · ${durationMetric.text}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [showModal, setShowModal] = useState(false);
  const [showCardioModal, setShowCardioModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const workoutSession = useWorkoutSession();

  const [showStartModal, setShowStartModal] = useState(false);
  const [pendingAddModal, setPendingAddModal] = useState(false);

  // Non-null while "Replace Exercise" is open for a specific live-session
  // entry — reuses AddWorkoutModal in "replace" mode (see below) instead
  // of a second exercise-picker component.
  const [replacingEntryId, setReplacingEntryId] = useState(null);

  // Set right after a successful finishWorkout() — WorkoutSession itself
  // unmounts once workoutSession.active flips to false, so its local
  // totals (volume/sets/prCount) are captured into this summary before
  // that happens (see handleConfirmFinish -> handleFinishWorkout below).
  const [finishSummary, setFinishSummary] = useState(null);

  const [stats, setStats] = useState({
    totalSessions: null,
    sessionsLast7Days: null,
    sessionsLast30Days: null,
    currentStreak: null,
    lastSession: null,
    averageVolumeRecent: null,
    averageSessionDuration: null,
    topExercise: "",
    topExerciseCount: 0,
    topMuscle: "",
    topMuscleCount: 0,
    personalRecords: {},
  });

  const [recentSessions, setRecentSessions] = useState([]);

  const [weeklyVolumeData, setWeeklyVolumeData] = useState([]);

  // Raw workout documents (Muscle Body Map enhancement) — fetched once
  // alongside the rest of the dashboard data, so the map's Week/Month/
  // 90 Days/Lifetime toggle can be computed client-side (all 4 windows
  // derived from this same array) instead of firing a new backend
  // request per range switch.
  const [muscleWorkouts, setMuscleWorkouts] = useState([]);

  // Phase 12 — one small additional fetch (goals), for the Active Cardio
  // Goal widget below. Everything else cardio-related on this page is
  // computed client-side from muscleWorkouts, already fetched above —
  // no other new request.
  const [goals, setGoals] = useState([]);

  // Phase 13B — planned workouts, fetched alongside goals/workouts for
  // Today's Brief's planned-workout recognition and the
  // ?startPlannedWorkoutId= deep link below. Same "fetch everything for
  // this user" shape Calendar already uses, not a new date-ranged
  // endpoint.
  const [plannedWorkouts, setPlannedWorkouts] = useState([]);
  const hasAppliedPlannedWorkoutDeepLink = useRef(false);

  // Today's Steps widget state — a passive daily count, deliberately
  // fetched/edited independently of muscleWorkouts (no workout is
  // involved at all). todaySteps stays null until either a fetch
  // resolves with no entry for today, or the user saves one — see
  // TodayStepsCard's own "Log steps" placeholder for the null case.
  const todayDateKey = getTodayDateKey();
  const [todaySteps, setTodaySteps] = useState(null);
  const [stepsEditing, setStepsEditing] = useState(false);
  const [stepsInput, setStepsInput] = useState("");
  const [stepsSaving, setStepsSaving] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [summaryData, workoutsRes, goalsRes, dailyStepsRes, plannedWorkoutsRes] =
        await Promise.all([
          getDashboardSummaryData(),
          getWorkouts(500),
          getGoals(),
          getDailySteps({ from: todayDateKey, to: todayDateKey }),
          getPlannedWorkouts(),
        ]);
      setGoals(goalsRes.data);
      setPlannedWorkouts(plannedWorkoutsRes.data);
      const todayEntry = dailyStepsRes.data.find((e) => e.date === todayDateKey);
      setTodaySteps(todayEntry ? todayEntry.steps : null);

      const [
        summary,
        streak,
        topExercise,
        topMuscle,
        records,
        weeklyVol,
        recentSessionsRes,
      ] = summaryData;

      setMuscleWorkouts(workoutsRes.data);

      // Phase 13C — the centralized reminder engine (reminders/
      // reminderEngine.js) computes every reminder/insight candidate
      // client-side from data already fetched above (workouts, goals,
      // planned workouts), then hands them to the server for the same
      // dedup + persistence path every notification already goes
      // through. Fire-and-forget: a failure here must never affect
      // anything else on this page. This is the "no background
      // scheduler, check when the app is actually open" half of the
      // engine's generation — PR/goal/streak/first-workout-after-break
      // notifications are generated server-side at write time instead
      // (see server/utils/notificationTriggers.js).
      const notificationCandidates = generateReminders({
        workouts: workoutsRes.data,
        goals: goalsRes.data,
        plannedWorkouts: plannedWorkoutsRes.data,
      });
      if (notificationCandidates.length) {
        generateNotifications(notificationCandidates).catch((error) => console.log(error));
      }

      setStats({
        totalSessions: summary.data.totalSessions,
        sessionsLast7Days: summary.data.sessionsLast7Days,
        sessionsLast30Days: summary.data.sessionsLast30Days,
        lastSession: summary.data.lastSession,
        averageVolumeRecent: Math.round(summary.data.averageVolumeRecent || 0),
        // Bug fix (Phase 9 follow-up): averageSessionDuration can be
        // `null` (no recent session has a recorded duration) or a real
        // number that may itself legitimately be 0. Coercing with
        // `|| 0` here would make those two cases indistinguishable by
        // the time they reach render — so we only round when a real
        // value exists, and pass null straight through otherwise.
        averageSessionDuration:
          summary.data.averageSessionDuration != null
            ? Math.round(summary.data.averageSessionDuration)
            : null,
        currentStreak: streak.data.currentStreak,
        topExercise: topExercise.data.exercise,
        topExerciseCount: topExercise.data.count,
        topMuscle: topMuscle.data.topMuscle,
        topMuscleCount: topMuscle.data.count,
        personalRecords: records.data,
      });

      // sortSessions is the existing Workout History ordering utility —
      // reused here rather than having the backend guess display order.
      setRecentSessions(
        sortSessions(buildSessionSummaries(recentSessionsRes.data), "newest")
      );

      const rawWeekly = weeklyVol.data;
      const sortedWeekly = DAY_ORDER.map((d) => {
        const found = rawWeekly.find((r) => r.day === d);
        return { day: d, volume: found ? found.volume : 0 };
      });
      setWeeklyVolumeData(sortedWeekly);

      // Returned so callers that need the just-refetched raw workouts
      // immediately (e.g. the Finish Workout summary's streak/badge
      // computation) don't have to rely on muscleWorkouts state, which
      // wouldn't reflect this update until the next render.
      return workoutsRes.data;
    } catch (err) {
      console.error("Dashboard Error:", err);
      return muscleWorkouts;
    } finally {
      setLoading(false);
    }
  };

  const handleAddExercise = (payload) => {
    workoutSession.addExercise(payload);
    setShowModal(false);
  };

  const handleOpenReplaceExercise = (entryId) => {
    setReplacingEntryId(entryId);
  };

  const handleReplaceExercise = ({ exercise }) => {
    if (replacingEntryId) {
      workoutSession.replaceEntryExercise(replacingEntryId, exercise);
    }
    setReplacingEntryId(null);
  };

  const handleAddCardio = (payload) => {
    workoutSession.addCardioEntry(payload);
    setShowCardioModal(false);
  };

  const handleOpenStartModal = () => {
    if (workoutSession.active) return;
    setPendingAddModal(false);
    setShowStartModal(true);
  };

  const handleEmptyStateAddWorkout = () => {
    if (workoutSession.active) {
      setShowModal(true);
      return;
    }
    setPendingAddModal(true);
    setShowStartModal(true);
  };

  const handleStartModalClose = () => {
    setShowStartModal(false);
    setPendingAddModal(false);
  };

  const handleStartModalConfirm = (sessionType, customSessionType) => {
    workoutSession.startSession(sessionType, customSessionType);
    setShowStartModal(false);
    if (pendingAddModal) {
      setShowModal(true);
      setPendingAddModal(false);
    }
  };

  // Phase 13B — shared by the Today's Brief "Start" action and the
  // ?startPlannedWorkoutId= deep link below (Calendar's "Start Planned
  // Workout" button navigates here with that param). Looks the plan up
  // from the same plannedWorkouts state already fetched above rather
  // than firing a second request.
  const handleStartPlannedWorkout = (plannedWorkoutId) => {
    if (workoutSession.active) return;
    const plan = plannedWorkouts.find((p) => p._id === plannedWorkoutId);
    if (!plan) return;
    workoutSession.startSessionFromPlan(plan);
  };

  // Deep link from Calendar's "Start Planned Workout" button
  // (/dashboard?startPlannedWorkoutId=...). Waits for plannedWorkouts to
  // load (fetchDashboardData runs once on mount), then applies once —
  // same ref-guard pattern Calendar.jsx's own date deep link uses — and
  // strips the param so a refresh doesn't re-trigger it.
  useEffect(() => {
    if (hasAppliedPlannedWorkoutDeepLink.current) return;
    const planId = searchParams.get("startPlannedWorkoutId");
    if (!planId || loading) return;

    hasAppliedPlannedWorkoutDeepLink.current = true;
    handleStartPlannedWorkout(planId);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("startPlannedWorkoutId");
        return next;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, plannedWorkouts]);

  const handleFinishWorkout = async (localSummary) => {
    const success = await workoutSession.finishWorkout();
    if (success) {
      setShowModal(false);
      // fetchDashboardData already refetches raw workouts, which is what
      // the muscle map derives its breakdown from — no separate refetch
      // needed. Its return value (not the muscleWorkouts state, which
      // wouldn't reflect this update until the next render) is what
      // Finish Workout summary badges/streak are computed from, so they
      // already account for the session that just finished.
      const freshWorkouts = await fetchDashboardData();

      setFinishSummary({
        ...localSummary,
        badges: getSessionBadges(freshWorkouts, {
          durationMinutes: localSummary.durationMinutes,
          setCount: localSummary.setCount,
        }),
        currentStreak: computeCurrentStreak(freshWorkouts),
      });
    }
  };

  const handleStartEditSteps = () => {
    setStepsInput(todaySteps != null ? String(todaySteps) : "");
    setStepsEditing(true);
  };

  const handleCancelEditSteps = () => {
    setStepsEditing(false);
    setStepsInput("");
  };

  const handleSaveSteps = async () => {
    if (stepsInput === "" || isNaN(Number(stepsInput)) || Number(stepsInput) < 0) return;
    setStepsSaving(true);
    try {
      const res = await setDailySteps(todayDateKey, Number(stepsInput));
      setTodaySteps(res.data.steps);
      setStepsEditing(false);
    } catch (error) {
      console.log(error);
    } finally {
      setStepsSaving(false);
    }
  };

  // Any Cardio Goal configured with metric "steps" carries the per-day
  // threshold this widget's progress bar compares today's count
  // against — independent of which window (week/month/lifetime) that
  // goal happens to track consistency/streak over; "today's target" is
  // the same dailyTarget value regardless.
  const dailyStepsGoal = goals.find(
    (g) => g.type === "Cardio Goal" && g.metric === "steps" && g.dailyTarget
  );

  const barChartData =
    weeklyVolumeData.length > 0
      ? weeklyVolumeData
      : DAY_ORDER.map((d) => ({ day: d, volume: 0 }));

  // Priority 4 — Insights (retrospective: "how am I doing"). Every
  // entry is computed client-side from data already on the page; no new
  // endpoint.
  const dashboardInsights = useMemo(
    () => getDashboardInsights(muscleWorkouts),
    [muscleWorkouts]
  );

  // Phase 12.5 — Today's Brief (prescriptive: "what should I do
  // today") — workout recommendation, goal progress, steps remaining,
  // and streak protection, deliberately kept out of the Insights list
  // above so the same fact never appears twice on the page. This is now
  // the hero's actual content (see heroSubtitle above / the hero JSX
  // below), not a separate section. dailyStepsGoal is computed further
  // down (Cardio widgets block) but declared before this point in the
  // function body, so it's safe to reference here.
  // Phase 13B — today's still-Planned plan (if any), read via the same
  // local-date-key convention Calendar.jsx's getLocalDateKey/getTodayDateKey
  // use, so "today" agrees across pages regardless of timezone.
  const todaysPlannedWorkout = useMemo(() => {
    return (
      plannedWorkouts.find((p) => {
        if (p.status !== "Planned") return false;
        const d = new Date(p.scheduledDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate()
        ).padStart(2, "0")}`;
        return key === todayDateKey;
      }) || null
    );
  }, [plannedWorkouts, todayDateKey]);

  const todaysBrief = useMemo(
    () =>
      getTodaysBrief(muscleWorkouts, goals, {
        todaySteps,
        dailyGoalTarget: dailyStepsGoal?.dailyTarget ?? null,
        todaysPlannedWorkout,
      }),
    [muscleWorkouts, goals, todaySteps, dailyStepsGoal, todaysPlannedWorkout]
  );

  // ------------------------------------------------------------------
  // CARDIO WIDGETS — all computed client-side from muscleWorkouts/goals,
  // already fetched above; no new endpoint. cardioWeekOverview reuses
  // the same engine Analytics/Progression's cardio views already use.
  // ------------------------------------------------------------------
  const cardioWeekOverview = useMemo(
    () => getCardioOverview(muscleWorkouts, { period: "week" }),
    [muscleWorkouts]
  );

  // Same computeCurrentStreak function the overall streak card already
  // uses — just pre-filtered to cardio-only entries, not a new streak
  // algorithm.
  const cardioStreak = useMemo(
    () => computeCurrentStreak(muscleWorkouts.filter(isCardioEntry)),
    [muscleWorkouts]
  );

  const latestCardioWorkout = useMemo(() => {
    const cardioOnly = muscleWorkouts.filter(isCardioEntry);
    if (!cardioOnly.length) return null;
    return cardioOnly.reduce((latest, w) => {
      const t = new Date(w.date || w.createdAt).getTime();
      return !latest || t > new Date(latest.date || latest.createdAt).getTime() ? w : latest;
    }, null);
  }, [muscleWorkouts]);

  // Session-level Cardio vs Strength split (not set-based — cardio has
  // no sets) — reuses buildSessionSummaries rather than re-grouping
  // workouts into sessions a second time.
  const trainingBalance = useMemo(() => {
    const sessions = buildSessionSummaries(muscleWorkouts);
    const strengthCount = sessions.filter((s) => s.stats.exerciseCount > 0).length;
    const cardioCount = sessions.filter((s) => s.stats.cardioCount > 0).length;
    const total = strengthCount + cardioCount || 1;
    return {
      strengthPct: Math.round((strengthCount / total) * 100),
      cardioPct: Math.round((cardioCount / total) * 100),
      hasData: strengthCount + cardioCount > 0,
    };
  }, [muscleWorkouts]);

  // Nearest active (not yet completed) auto-tracked Cardio Goal — picked
  // by highest current progress, so the widget surfaces whichever one
  // the user is closest to finishing rather than an arbitrary first match.
  const activeCardioGoal = useMemo(() => {
    const candidates = goals
      .filter((g) => g.type === "Cardio Goal" && g.status !== "Completed")
      .map((g) => ({ goal: g, analytics: getGoalAnalytics(g) }))
      .sort((a, b) => b.analytics.percent - a.analytics.percent);
    return candidates[0] || null;
  }, [goals]);

  const lastSessionVolumeValue = (() => {
    const ls = stats.lastSession;
    if (!ls) return "—";
    if (ls.exerciseCount > 0) return `${ls.volume.toLocaleString()} kg`;
    if (ls.cardioCount > 0) return ls.cardioActivities[0]?.activityType || "Cardio";
    return "—";
  })();

  // Only a real number to count up from when the last session actually
  // has a strength volume (a cardio-only session's "value" is an
  // activity name, not a number) — PrimaryCard falls back to the plain
  // lastSessionVolumeValue string above whenever this is null.
  const lastSessionVolumeNumeric =
    stats.lastSession && stats.lastSession.exerciseCount > 0 ? stats.lastSession.volume : null;

  const lastSessionVolumeSub = (() => {
    const ls = stats.lastSession;
    if (!ls) return null;
    if (ls.exerciseCount > 0 && ls.cardioCount > 0) {
      return `+${ls.cardioCount} Cardio Activit${ls.cardioCount === 1 ? "y" : "ies"}`;
    }
    if (ls.exerciseCount === 0 && ls.cardioCount > 0) {
      return ls.sessionDuration != null ? `${ls.sessionDuration} min` : null;
    }
    return "Previous Session";
  })();

  // Priority 2 — "is this improving?": compares the two most recent
  // strength sessions' volume (both read from the SAME client-computed
  // recentSessions array, so it's an apples-to-apples comparison rather
  // than mixing the backend's separately-computed stats.lastSession).
  // Falls back to lastSessionVolumeSub above (cardio-count / duration /
  // "Previous Session") whenever there isn't a real prior strength
  // session to compare against.
  const lastSessionVolumeTrend = (() => {
    const [latest, previous] = recentSessions;
    if (!latest || !previous) return null;
    if (!(latest.stats.exerciseCount > 0) || !(previous.stats.exerciseCount > 0)) return null;
    const prevVolume = previous.stats.volume;
    if (!prevVolume) return null;
    const changePct = Math.round(((latest.stats.volume - prevVolume) / prevVolume) * 100);
    if (changePct === 0) return null;
    return { changePct, positive: changePct > 0 };
  })();

  const lastSessionSubDisplay = lastSessionVolumeTrend
    ? `${lastSessionVolumeTrend.positive ? "↑" : "↓"} ${
        lastSessionVolumeTrend.positive ? "+" : ""
      }${lastSessionVolumeTrend.changePct}% vs previous`
    : lastSessionVolumeSub;

  // Sessions this week vs the week before — both counted from the same
  // buildSessionSummaries grouping already used elsewhere on this page,
  // so "a session" means the same thing here as everywhere else.
  const weeklySessionTrend = (() => {
    const sessions = buildSessionSummaries(muscleWorkouts);
    const now = Date.now();
    const oneWeekMs = 7 * 86400000;
    const thisWeek = sessions.filter((s) => now - new Date(s.date).getTime() < oneWeekMs).length;
    const lastWeek = sessions.filter((s) => {
      const age = now - new Date(s.date).getTime();
      return age >= oneWeekMs && age < oneWeekMs * 2;
    }).length;
    return thisWeek - lastWeek;
  })();

  // "Longest Streak" fallback (Priority 2): a broken current streak (0)
  // read alone is discouraging and, worse, throws away real history —
  // showing the best-ever streak instead keeps the card meaningful.
  // getLongestStreakEver is the exact function Finish Workout's own
  // "new longest streak" badge already uses (liveWorkoutEngine.js).
  const longestStreakEver = getLongestStreakEver(muscleWorkouts);
  const showLongestStreakFallback = stats.currentStreak === 0 && longestStreakEver > 0;

  // Bug fix (Phase 9 follow-up): previously checked `> 0`, which treated
  // a genuinely-computed average of 0 minutes the same as "no data" and
  // always rendered "—" for it. Now only `null` (true absence of any
  // recorded duration among the last 5 sessions) falls back to "—" — a
  // real average, including 0, is displayed as-is.
  const avgSessionDurationValue =
    stats.averageSessionDuration != null
      ? `${stats.averageSessionDuration} min`
      : "—";

  const firstName = getFirstName();

  // Phase 12.5 — Today's Brief now IS the hero's content (replacing the
  // earlier static/pill-based subtitle entirely): a rule-engine-
  // generated list (workout recommendation, goal/steps proximity,
  // streak protection — see utils/dashboardInsights.js's
  // getTodaysBrief) rendered directly under the greeting. The plain
  // fallback line only shows when there's truly nothing to brief yet
  // (a brand-new account with no history/goals at all).
  const heroSubtitle = loading ? "Loading your progress..." : "Ready to crush today's session?";

  return (
    <div className="dash-page">
      <div className="dash-bg" aria-hidden="true">
        <div className="orb orb--1" />
        <div className="orb orb--2" />
        <div className="orb orb--3" />
      </div>

      <main className="dash-main">
        <section className="hero-card">
          <div className="hero-card__left">
            <span className="hero-card__eyebrow">
              <span className="hero-card__dot" />
              Live dashboard
            </span>
            <h1 className="hero-card__title">
              {getTimeGreeting()}
              {firstName ? `, ${firstName}` : ""}
            </h1>
            {!loading && todaysBrief.length > 0 ? (
              <>
                <p className="hero-brief-label">Today's Brief</p>
                <ul className="hero-brief-list">
                  {todaysBrief.map((item) => (
                    <BriefListItem
                      key={item.key}
                      item={item}
                      onStartPlanned={handleStartPlannedWorkout}
                    />
                  ))}
                </ul>
              </>
            ) : (
              <p className="hero-card__sub">{heroSubtitle}</p>
            )}
          </div>
          <div className="hero-card__right">
            <button
              className="cta-btn"
              onClick={handleOpenStartModal}
              disabled={workoutSession.active || workoutSession.isSaving}
            >
              <Plus size={16} strokeWidth={2.5} />
              New Workout
            </button>
          </div>
        </section>

        {!workoutSession.active && workoutSession.saveSuccess && (
          <div className="save-success-banner" role="status">
            <CheckCircle2 size={18} strokeWidth={2} />
            <span>{workoutSession.saveSuccess}</span>
            <button
              type="button"
              className="save-success-banner__close"
              onClick={workoutSession.clearSaveSuccess}
              aria-label="Dismiss"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        )}

        {workoutSession.active && !workoutSession.justStarted && (
          <ResumeWorkoutPrompt
            startTime={workoutSession.startTime}
            onResume={workoutSession.confirmResume}
            onDiscard={workoutSession.discardSession}
          />
        )}

        {workoutSession.active && workoutSession.justStarted && (
          <WorkoutSession
            startTime={workoutSession.startTime}
            entryCount={workoutSession.entries.length}
            entries={workoutSession.entries}
            historicalWorkouts={muscleWorkouts}
            onAddExercise={() => setShowModal(true)}
            onAddCardio={() => setShowCardioModal(true)}
            onDiscard={() => workoutSession.discardSession()}
            onRemoveEntry={workoutSession.removeEntry}
            onAddSet={workoutSession.addSet}
            onDeleteSet={workoutSession.deleteSet}
            onUpdateSet={workoutSession.updateSet}
            onReorderEntry={workoutSession.reorderEntry}
            onDuplicateEntry={workoutSession.duplicateEntry}
            onReplaceEntry={handleOpenReplaceExercise}
            sessionNote={workoutSession.sessionNote}
            onSessionNoteChange={workoutSession.setSessionNote}
            onUpdateEntryNote={workoutSession.updateEntryNote}
            onFinishWorkout={handleFinishWorkout}
            isSaving={workoutSession.isSaving}
            saveError={workoutSession.saveError}
          />
        )}

        <section className="section">
          <p className="section__label">Overview</p>
          <div
            className={`primary-grid${!loading ? " dash-fade-in" : ""}`}
            key={loading ? "primary-loading" : "primary-loaded"}
          >
            <PrimaryCard
              title="Total Sessions"
              numericValue={loading ? null : stats.totalSessions}
              formatValue={(n) => String(n)}
              sub={
                loading || weeklySessionTrend === 0
                  ? null
                  : `${weeklySessionTrend > 0 ? "↑" : "↓"} ${
                      weeklySessionTrend > 0 ? "+" : ""
                    }${weeklySessionTrend} this week`
              }
              icon={Dumbbell}
              accent
              onClick={() => navigate("/workouts")}
            />
            <PrimaryCard
              title="Last Session Volume"
              value={loading ? null : lastSessionVolumeValue}
              numericValue={loading ? null : lastSessionVolumeNumeric}
              formatValue={(n) => `${Math.round(n).toLocaleString()} kg`}
              sub={loading ? null : lastSessionSubDisplay}
              icon={Flame}
              onClick={() => navigate("/analytics")}
            />
            <PrimaryCard
              title="Sessions Logged"
              numericValue={loading ? null : stats.sessionsLast7Days}
              formatValue={(n) => `${n} (7d)`}
              icon={Activity}
              onClick={() => navigate("/workouts")}
            />
            <PrimaryCard
              title={showLongestStreakFallback ? "Longest Streak" : "Current Streak"}
              numericValue={
                loading ? null : showLongestStreakFallback ? longestStreakEver : stats.currentStreak
              }
              formatValue={(n) => `${n}d`}
              icon={CalendarDays}
              onClick={() => navigate("/calendar")}
            />
          </div>
        </section>

        <section className="section today-steps-section">
          <div className="secondary-grid today-steps-section__grid">
            <TodayStepsCard
              steps={todaySteps}
              dailyGoalTarget={dailyStepsGoal?.dailyTarget ?? null}
              loading={loading}
              editing={stepsEditing}
              inputValue={stepsInput}
              onInputChange={(e) => setStepsInput(e.target.value)}
              onEditStart={handleStartEditSteps}
              onSave={handleSaveSteps}
              onCancel={handleCancelEditSteps}
              saving={stepsSaving}
            />
          </div>
        </section>

        <section className="section">
          <p className="section__label">Last Session</p>
          <LastSessionCard session={recentSessions[0] || null} loading={loading} />
        </section>

        <section className="section charts-row">
          <div className="chart-card chart-card--pie">
            <MuscleBodyMap
              workouts={muscleWorkouts}
              loading={loading}
              personalRecords={stats.personalRecords}
              onSelectMuscle={(muscle) =>
                navigate(`/progression?muscle=${encodeURIComponent(muscle)}`)
              }
            />
          </div>

          <div className="chart-card chart-card--bar">
            <div className="chart-card__head">
              <div>
                <p className="chart-card__title">Weekly Volume</p>
                <p className="chart-card__sub">Total weight lifted per day (kg)</p>
              </div>
              <span className="chart-badge">
                <TrendingUp size={14} strokeWidth={2} /> This week
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={barChartData}
                barSize={26}
                margin={{ top: 8, right: 0, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="dashVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--go-primary)" stopOpacity={1} />
                    <stop offset="100%" stopColor="var(--go-primary)" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: "var(--go-text-faint)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--go-text-faint)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<CustomBarTooltip />}
                  cursor={{ fill: "var(--go-primary-50)" }}
                />
                <Bar
                  dataKey="volume"
                  fill="url(#dashVolumeGradient)"
                  radius={[6, 6, 0, 0]}
                  animationDuration={500}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {!loading && dashboardInsights.length > 0 && (
          <section className="section">
            <p className="section__label">Insights</p>
            <div className="insights-grid dash-fade-in">
              {dashboardInsights.map((insight) => (
                <InsightCard key={insight.key} insight={insight} />
              ))}
            </div>
          </section>
        )}

        {!loading && <GoalsWidget goals={goals} onViewAll={() => navigate("/goals")} />}

        <section className="section">
          <p className="section__label">Breakdown</p>
          <div
            className={`secondary-grid${!loading ? " dash-fade-in" : ""}`}
            key={loading ? "secondary-loading" : "secondary-loaded"}
          >
            <SecondaryCard
              title="Avg Volume (Last 5)"
              value={
                loading ? null : `${stats.averageVolumeRecent?.toLocaleString()} kg`
              }
              icon={BarChart2}
            />
            <SecondaryCard
              title="Avg Session Duration (Last 5)"
              value={loading ? null : avgSessionDurationValue}
              icon={Timer}
            />
            <SecondaryCard
              title="Top Muscle"
              value={loading ? null : stats.topMuscle || "—"}
              sub={stats.topMuscleCount ? `${stats.topMuscleCount} sets` : null}
              icon={Zap}
            />
            <SecondaryCard
              title="Top Exercise"
              value={loading ? null : stats.topExercise || "—"}
              sub={
                stats.topExerciseCount
                  ? `${stats.topExerciseCount}× performed`
                  : null
              }
              icon={Trophy}
            />
            <SecondaryCard
              title="Sessions (30d)"
              value={loading ? null : stats.sessionsLast30Days}
              icon={CalendarRange}
            />
          </div>
        </section>

        {!loading && cardioWeekOverview.hasCardioData && (
          <section className="section">
            <p className="section__label">Cardio</p>
            <div className="secondary-grid dash-fade-in">
              <SecondaryCard
                title="Weekly Cardio Distance"
                value={`${cardioWeekOverview.periodDistance} km`}
                sub={`${cardioWeekOverview.periodSessions} sessions this week`}
                icon={MapPin}
              />
              <SecondaryCard
                title="Weekly Cardio Duration"
                value={`${cardioWeekOverview.periodDuration} min`}
                icon={Timer}
              />
              <SecondaryCard title="Cardio Streak" value={`${cardioStreak}d`} icon={HeartPulse} />
              <SecondaryCard
                title="Latest Cardio Session"
                value={latestCardioWorkout ? getCardioActivityLabel(latestCardioWorkout) : "—"}
                sub={latestCardioWorkout ? formatSessionDate(latestCardioWorkout.date) : null}
                icon={Activity}
              />
              {trainingBalance.hasData && (
                <SecondaryCard
                  title="Cardio vs Strength"
                  value={`${trainingBalance.strengthPct}% / ${trainingBalance.cardioPct}%`}
                  sub="Strength / Cardio sessions"
                  icon={BarChart2}
                />
              )}
              {activeCardioGoal && (
                <SecondaryCard
                  title={activeCardioGoal.goal.title}
                  value={`${activeCardioGoal.goal.current}/${activeCardioGoal.goal.target} ${activeCardioGoal.goal.unit}`}
                  sub={`${activeCardioGoal.analytics.percent}% complete`}
                  icon={Target}
                />
              )}
            </div>
          </section>
        )}

        <section className="activity-row">
          <div className="activity-card activity-card--recent">
            <div className="activity-card__head">
              <p className="activity-card__title">Recent Sessions</p>
              <button className="view-all-btn" onClick={() => navigate("/workouts")}>
                View all <ChevronRight size={14} />
              </button>
            </div>

            {/* Workout Session Editing & Time Tracking discovery moment #3
                — one quiet line for the whole list, not repeated per row,
                so scanning several past sessions doesn't mean seeing the
                same hint several times over. */}
            {!loading && recentSessions.length > 0 && (
              <p className="activity-card__timing-hint">
                Notice a workout's timing looks off? You can edit it anytime from Workouts.
              </p>
            )}

            {loading ? (
              <div className="activity-list">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="workout-row workout-row--skeleton">
                    <span
                      className="skeleton"
                      style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0 }}
                    />
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <span
                        className="skeleton"
                        style={{ width: "55%", height: 13, borderRadius: 5 }}
                      />
                      <span
                        className="skeleton"
                        style={{ width: "38%", height: 11, borderRadius: 5 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentSessions.length === 0 ? (
              <div className="empty-state dash-fade-in">
                <div className="empty-state__icon">
                  <Dumbbell size={26} strokeWidth={1.6} />
                </div>
                <p>No sessions logged yet.</p>
                <button className="empty-btn" onClick={handleEmptyStateAddWorkout}>
                  Log your first workout
                </button>
              </div>
            ) : (
              <div className="activity-list dash-fade-in">
                {recentSessions.map((session) => (
                  <RecentSessionRow key={session.key} session={session} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <StartWorkoutModal
        open={showStartModal}
        onClose={handleStartModalClose}
        onStart={handleStartModalConfirm}
      />

      {showModal && (
        <AddWorkoutModal
          closeModal={() => setShowModal(false)}
          onAddExercise={handleAddExercise}
        />
      )}

      {replacingEntryId && (
        <AddWorkoutModal
          mode="replace"
          closeModal={() => setReplacingEntryId(null)}
          onAddExercise={handleReplaceExercise}
        />
      )}

      <FinishWorkoutSummary summary={finishSummary} onClose={() => setFinishSummary(null)} />

      {showCardioModal && (
        <AddCardioModal
          closeModal={() => setShowCardioModal(false)}
          onAddCardio={handleAddCardio}
        />
      )}
    </div>
  );
}

export default Dashboard;