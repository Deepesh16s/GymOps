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
};

export const CARDIO_ACTIVITIES = {
  Running: {
    requiredMetrics: ["duration", "distance"],
    optionalMetrics: ["speed", "pace", "calories", "heartRate", "incline"],
  },
  Cycling: {
    requiredMetrics: ["duration", "distance"],
    optionalMetrics: ["speed", "cadence", "resistance", "calories", "heartRate"],
  },
  Walking: {
    requiredMetrics: ["duration"],
    optionalMetrics: ["distance", "speed", "incline", "calories", "heartRate"],
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
    ],
  },
};

export const CARDIO_ACTIVITY_TYPES = Object.keys(CARDIO_ACTIVITIES);

export const getActivityMetrics = (activityType) => {
  const activity = CARDIO_ACTIVITIES[activityType];
  if (!activity) return { requiredMetrics: [], optionalMetrics: [] };
  return activity;
};

export const getAllMetricKeysForActivity = (activityType) => {
  const { requiredMetrics, optionalMetrics } = getActivityMetrics(activityType);
  return [...requiredMetrics, ...optionalMetrics];
};