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
    label: "Working Weight",
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
    (key === SESSION_DURATION_METRIC.key ? SESSION_DURATION_METRIC : null)
  );
}

export const DEFAULT_METRIC = "volume";
