// Single source of truth for cardio activity → required/optional metric
// mappings, used by AddCardioModal to render its form. This is the
// frontend half of a deliberately UNSHARED, mirrored pair — see
// server/constants/cardioMetadata.js for the backend counterpart. The two
// files are not imported across the frontend/backend boundary; keep them
// in sync manually if this list changes.
//
// Every metric is optional at the data level. What varies per activity is
// which metrics are REQUIRED — that distinction lives entirely here, not
// in any per-activity switch statement in the form component.

export const CARDIO_METRICS = {
  duration: { label: "Duration", unit: "min" },
  distance: { label: "Distance", unit: "km" },
  speed: { label: "Speed", unit: "km/h" },
  pace: { label: "Pace", unit: "min/km" },
  incline: { label: "Incline", unit: "%" },
  calories: { label: "Calories", unit: "kcal" },
  cadence: { label: "Cadence", unit: "rpm" },
  resistance: { label: "Resistance", unit: "level" },
  heartRate: { label: "Heart Rate", unit: "bpm" },
  // Optional on Running/Walking only — an occasional per-session count a
  // user can log alongside a walk/run. The primary way steps get tracked
  // is the separate Dashboard daily-steps log (dailyStepsService.js),
  // which isn't tied to a workout entry at all; this field only exists so
  // a Daily Steps goal can (per product decision) merge in any session
  // that happened to log its own step count too, rather than requiring
  // one or the other.
  steps: { label: "Steps", unit: "steps" },
};

export const CARDIO_ACTIVITIES = {
  Running: {
    requiredMetrics: ["duration", "distance"],
    optionalMetrics: ["speed", "pace", "calories", "heartRate", "incline", "steps"],
  },
  Cycling: {
    requiredMetrics: ["duration", "distance"],
    optionalMetrics: ["speed", "cadence", "resistance", "calories", "heartRate"],
  },
  Walking: {
    requiredMetrics: ["duration"],
    optionalMetrics: ["distance", "speed", "incline", "calories", "heartRate", "steps"],
  },
  Rowing: {
    requiredMetrics: ["duration"],
    optionalMetrics: ["distance", "pace", "cadence", "resistance", "calories", "heartRate"],
  },
  Swimming: {
    requiredMetrics: ["duration"],
    optionalMetrics: ["distance", "pace", "calories", "heartRate"],
  },
  Elliptical: {
    requiredMetrics: ["duration"],
    optionalMetrics: ["resistance", "incline", "calories", "heartRate"],
  },
  "Stair Climber": {
    requiredMetrics: ["duration"],
    optionalMetrics: ["incline", "resistance", "calories", "heartRate"],
  },
  Other: {
    requiredMetrics: ["duration"],
    optionalMetrics: [
      "distance",
      "speed",
      "pace",
      "incline",
      "calories",
      "cadence",
      "resistance",
      "heartRate",
      "steps",
    ],
  },
};

export const CARDIO_ACTIVITY_TYPES = Object.keys(CARDIO_ACTIVITIES);

// Phase 12 — optional activity VARIANTS (e.g. Running -> Treadmill Run).
// Mirrors server/constants/cardioMetadata.js's CARDIO_ACTIVITY_VARIANTS.
// A variant is a refinement of a parent activityType, never a
// replacement — `cardio.activityType` stays the field every existing
// goal/progression/PR calculation matches on, so all of that keeps
// aggregating at the parent level with zero changes regardless of
// whether a variant is set. Activities with no entry here (Elliptical,
// Stair Climber, Other) simply have no variant refinement — gracefully
// omitted, not an oversight.
export const CARDIO_ACTIVITY_VARIANTS = {
  Running: ["Outdoor Run", "Treadmill Run", "Trail Run", "Track Run"],
  Walking: ["Outdoor Walk", "Treadmill Walk", "Hiking"],
  Cycling: ["Outdoor Ride", "Road Bike", "Mountain Bike", "Stationary Bike"],
  Swimming: ["Pool", "Open Water"],
  Rowing: ["Indoor Rower", "Outdoor Rowing"],
};

export const getActivityVariants = (activityType) => CARDIO_ACTIVITY_VARIANTS[activityType] || [];

// Phase 12 — lucide-react icon NAME per activity (not the component
// itself, so this constants file stays free of any UI-library import,
// same separation as the rest of this file). Consumers import the icons
// they need from lucide-react and look up which one applies via this
// map, e.g. `const Icon = iconsByName[CARDIO_ACTIVITY_ICONS[activityType]]`.
// Every activity previously rendered with one generic icon everywhere —
// this is purely a "don't all look identical" visual differentiation,
// not a redesign.
export const CARDIO_ACTIVITY_ICONS = {
  Running: "Footprints",
  Walking: "Footprints",
  Cycling: "Bike",
  Rowing: "Waves",
  Swimming: "Waves",
  Elliptical: "Activity",
  "Stair Climber": "MoveVertical",
  Other: "Activity",
};

export const getActivityMetrics = (activityType) => {
  const activity = CARDIO_ACTIVITIES[activityType];
  if (!activity) return { requiredMetrics: [], optionalMetrics: [] };
  return activity;
};

export const getAllMetricKeysForActivity = (activityType) => {
  const { requiredMetrics, optionalMetrics } = getActivityMetrics(activityType);
  return [...requiredMetrics, ...optionalMetrics];
};