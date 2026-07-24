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
  // Optional on Running/Walking only — mirrors client/src/constants/
  // cardioMetadata.js's note: the primary steps-tracking path is the
  // separate daily-steps log (models/DailySteps.js), not this field. This
  // only exists so a Daily Steps goal can merge in a session that
  // happened to log its own step count too.
  steps: { label: "Steps", unit: "steps" },
};

const CARDIO_ACTIVITIES = {
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

const CARDIO_ACTIVITY_TYPES = Object.keys(CARDIO_ACTIVITIES);

// Phase 12 — optional activity VARIANTS (e.g. Running -> Treadmill Run).
// A variant is a refinement of a parent activityType, never a
// replacement for it: `cardio.activityType` stays the field every
// existing goal/progression/PR calculation already matches on, so all
// of that continues to aggregate at the parent level with zero changes
// (see server/utils/goalMetrics.js's computeCardioGoalMetric, which only
// ever reads `cardio.activityType`). Activities with no entry here
// (Elliptical, Stair Climber, Other) simply have no variant refinement —
// gracefully omitted, not an oversight.
const CARDIO_ACTIVITY_VARIANTS = {
  Running: ["Outdoor Run", "Treadmill Run", "Trail Run", "Track Run"],
  Walking: ["Outdoor Walk", "Treadmill Walk", "Hiking"],
  Cycling: ["Outdoor Ride", "Road Bike", "Mountain Bike", "Stationary Bike"],
  Swimming: ["Pool", "Open Water"],
  Rowing: ["Indoor Rower", "Outdoor Rowing"],
};

module.exports = {
  CARDIO_METRICS,
  CARDIO_ACTIVITIES,
  CARDIO_ACTIVITY_TYPES,
  CARDIO_ACTIVITY_VARIANTS,
};