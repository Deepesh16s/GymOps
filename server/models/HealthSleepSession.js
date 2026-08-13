const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  { manufacturer: String, model: String },
  { _id: false }
);

const sleepStageSchema = new mongoose.Schema(
  {
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    // Numeric Health Connect SleepStageType constant (0 unknown, 1 awake, 2
    // sleeping, 3 out-of-bed, 4 light, 5 deep, 6 rem) — stored as-is rather
    // than remapped, since the mobile app and any future consumer already
    // share this same numeric contract with the Health Connect SDK itself.
    stage: { type: Number, required: true },
  },
  { _id: false }
);

const healthSleepSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

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

    stages: {
      type: [sleepStageSchema],
      default: [],
    },

    title: {
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

healthSleepSessionSchema.index({ user: 1, healthConnectRecordId: 1 }, { unique: true });

module.exports = mongoose.model("HealthSleepSession", healthSleepSessionSchema);
