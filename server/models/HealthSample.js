const mongoose = require("mongoose");
const { HEALTH_SAMPLE_RECORD_TYPES } = require("../constants/healthRecordTypes");

const deviceSchema = new mongoose.Schema(
  { manufacturer: String, model: String },
  { _id: false }
);

const healthSampleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    recordType: {
      type: String,
      enum: HEALTH_SAMPLE_RECORD_TYPES,
      required: true,
      index: true,
    },

    // Health Connect's own record UUID — the idempotency key. Re-syncing the
    // same record is always an upsert on (user, healthConnectRecordId), never
    // a duplicate insert.
    healthConnectRecordId: {
      type: String,
      required: true,
    },

    startTime: {
      type: Date,
      required: true,
      index: true,
    },

    endTime: {
      type: Date,
      required: true,
    },

    // Deliberately loose: a number for scalar records (resting HR, HRV, steps,
    // calories), an array of {time, beatsPerMinute} samples for the HeartRate
    // series type, or an {exerciseType, title} object for ExerciseSession.
    // Modeling this as a rigid per-field schema would mean five near-duplicate
    // schemas for records that are structurally very different; a normalized
    // envelope with a typed-but-flexible value is the simpler correct choice
    // here, same reasoning as choosing to aggregate DailyActivity on read
    // instead of maintaining a fragile parallel rollup collection.
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    unit: {
      type: String,
      default: null,
    },

    sourceOrigin: {
      type: String,
      default: null,
    },

    device: {
      type: deviceSchema,
      default: null,
    },
  },
  { timestamps: true }
);

healthSampleSchema.index({ user: 1, healthConnectRecordId: 1 }, { unique: true });
healthSampleSchema.index({ user: 1, recordType: 1, startTime: -1 });

module.exports = mongoose.model("HealthSample", healthSampleSchema);
