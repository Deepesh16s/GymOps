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

export const MUSCLE_ONLY_METRICS = [
  {
    key: "avgVolumePerSession",
    label: "Average Volume / Session",
    shortLabel: "Avg Vol/Session",
    format: (v) => (v == null ? "—" : `${Math.round(v).toLocaleString()} kg`),
  },
];

export const MUSCLE_DEFAULT_METRIC = "avgVolumePerSession";


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
