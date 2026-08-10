
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

export const CARDIO_ACTIVITY_VARIANTS = {
  Running: ["Outdoor Run", "Treadmill Run", "Trail Run", "Track Run"],
  Walking: ["Outdoor Walk", "Treadmill Walk", "Hiking"],
  Cycling: ["Outdoor Ride", "Road Bike", "Mountain Bike", "Stationary Bike"],
  Swimming: ["Pool", "Open Water"],
  Rowing: ["Indoor Rower", "Outdoor Rowing"],
};

export const getActivityVariants = (activityType) => CARDIO_ACTIVITY_VARIANTS[activityType] || [];

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