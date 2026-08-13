// Phase 2 prioritized set — mirrors client/mobile's src/health/recordTypes.ts.
// SleepSession is intentionally excluded here: it has nested stage data that
// doesn't fit HealthSample's flat envelope, so it lives in its own model.
const HEALTH_SAMPLE_RECORD_TYPES = [
  "HeartRate",
  "RestingHeartRate",
  "HeartRateVariabilityRmssd",
  "Steps",
  "ActiveCaloriesBurned",
  "ExerciseSession",
];

const HEALTH_SLEEP_RECORD_TYPE = "SleepSession";

const TRACKED_HEALTH_RECORD_TYPES = [...HEALTH_SAMPLE_RECORD_TYPES, HEALTH_SLEEP_RECORD_TYPE];

module.exports = {
  HEALTH_SAMPLE_RECORD_TYPES,
  HEALTH_SLEEP_RECORD_TYPE,
  TRACKED_HEALTH_RECORD_TYPES,
};
