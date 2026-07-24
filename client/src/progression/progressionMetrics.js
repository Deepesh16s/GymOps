// Registry of chartable Progression metrics — the single place a metric's
// key, display label and formatter are defined, so the Filter Bar's
// dropdown, chart y-axis/tooltip formatting, and stat tiles all read from
// the same source instead of each hardcoding labels/units separately.
export const PROGRESSION_METRICS = [
  {
    key: "volume",
    label: "Training Volume",
    shortLabel: "Volume",
    format: (v) => (v == null ? "—" : `${Math.round(v).toLocaleString()} kg`),
  },
  {
    key: "sets",
    label: "Total Sets",
    shortLabel: "Sets",
    format: (v) => (v == null ? "—" : `${Math.round(v)}`),
  },
  {
    key: "frequency",
    label: "Training Frequency",
    shortLabel: "Sessions",
    format: (v) => (v == null ? "—" : `${Math.round(v)}`),
  },
  {
    key: "workingWeight",
    label: "Average Weight",
    shortLabel: "Avg Weight",
    format: (v) => (v == null ? "—" : `${Math.round(v * 10) / 10} kg`),
  },
  {
    key: "estOneRM",
    label: "Estimated 1RM",
    shortLabel: "Est. 1RM",
    format: (v) => (v == null || v === 0 ? "—" : `${Math.round(v)} kg`),
  },
];

// Exercise-view-only metrics — both come from buildExerciseSessionSeries
// (one point per session), not buildProgressionSeries' week/month
// buckets, so they're deliberately excluded from Overall/Muscle's metric
// dropdown (those series have no bestSetWeight/totalReps field and
// would just render a blank chart if selected there).
export const EXERCISE_ONLY_METRICS = [
  {
    key: "bestSetWeight",
    label: "Best Set",
    shortLabel: "Best Set",
    format: (v) => (v == null ? "—" : `${v} kg`),
  },
  {
    key: "totalReps",
    label: "Total Reps",
    shortLabel: "Total Reps",
    format: (v) => (v == null ? "—" : `${v}`),
  },
];

export const EXERCISE_DEFAULT_METRIC = "bestSetWeight";

// Muscle-view-only metric — a muscle is trained by several different
// exercises, so "volume per period" alone rewards training it more
// often rather than harder (2 sessions x 500kg and 4 sessions x 500kg
// both read as real progress on a raw volume trend, even though neither
// session got heavier). Dividing by how many sessions actually trained
// it (buildProgressionSeries' avgVolumePerSession) answers "am I giving
// this muscle more stimulus per session", which is the more honest
// per-muscle question — a single "PR" doesn't mean anything across
// several different exercises.
export const MUSCLE_ONLY_METRICS = [
  {
    key: "avgVolumePerSession",
    label: "Average Volume / Session",
    shortLabel: "Avg Vol/Session",
    format: (v) => (v == null ? "—" : `${Math.round(v).toLocaleString()} kg`),
  },
];

export const MUSCLE_DEFAULT_METRIC = "avgVolumePerSession";

// Deliberately NOT a selectable line-chart metric: unlike volume/sets/
// frequency/working weight/estimated 1RM (which have a real value every
// time you train), a personal record is by definition a rare event — a
// continuous line with one dot floating in months of gaps isn't a useful
// graph. Records get their own purpose-built views instead: the PR
// Timeline (TimelineChart) and the Personal Records list. `prWeight`/
// `prCount` still live on each progressionEngine series bucket (real
// data, just not offered as a plottable metric here).

// Only offered by the Filter Bar when the active dataset actually has at
// least one bucket with a non-null sessionDuration (legacy sessions and
// cardio-only sessions don't record one) — "hide unavailable info
// gracefully" rather than showing an always-empty chart option.
export const SESSION_DURATION_METRIC = {
  key: "sessionDuration",
  label: "Session Duration",
  shortLabel: "Duration",
  format: (v) => (v == null ? "—" : `${Math.round(v)} min`),
  noDataLabel: "No duration recorded",
};

export function getMetricDef(key) {
  return (
    PROGRESSION_METRICS.find((m) => m.key === key) ||
    EXERCISE_ONLY_METRICS.find((m) => m.key === key) ||
    MUSCLE_ONLY_METRICS.find((m) => m.key === key) ||
    (key === SESSION_DURATION_METRIC.key ? SESSION_DURATION_METRIC : null)
  );
}

export const DEFAULT_METRIC = "volume";
