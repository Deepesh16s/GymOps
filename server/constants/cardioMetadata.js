
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