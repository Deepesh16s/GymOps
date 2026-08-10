const mongoose = require("mongoose");

const pushPreferencesSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    pushEnabled: {
      type: Boolean,
      default: false,
    },

    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: "22:00" },
      end: { type: String, default: "07:00" },
      mode: {
        type: String,
        enum: ["allow", "criticalOnly", "suppressAll"],
        default: "suppressAll",
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PushPreferences", pushPreferencesSchema);
