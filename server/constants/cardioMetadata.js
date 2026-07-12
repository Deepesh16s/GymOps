// Single source of truth for cardio activity → required/optional metric
// mappings, used by server/utils/validateWorkoutPayload.js. This is the
// backend half of a deliberately UNSHARED, mirrored pair — see
// src/constants/cardioMetadata.js for the frontend counterpart. The two
// files are not imported across the frontend/backend boundary; keep them
// in sync manually if this list changes.
//
// Every metric is optional at the data level (see workout.js's cardioData
// subdocument). What varies per activity is which metrics are REQUIRED —
// that distinction lives entirely here, not in any validation switch
// statement.

const CARDIO_METRICS = {
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

const CARDIO_ACTIVITIES = {
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

const CARDIO_ACTIVITY_TYPES = Object.keys(CARDIO_ACTIVITIES);

module.exports = {
  CARDIO_METRICS,
  CARDIO_ACTIVITIES,
  CARDIO_ACTIVITY_TYPES,
};