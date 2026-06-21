const mongoose = require("mongoose");

const exerciseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // ── NEW: trimmed + lowercased mirror of `name`, kept in sync
    // automatically below. Lets us enforce case/whitespace
    // -insensitive uniqueness per user without changing how `name`
    // is displayed anywhere in the UI.
    normalizedName: {
      type: String,
      required: true,
    },

    muscleGroup: {
      type: String,
      required: true,
    },

    isDefault: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Keep normalizedName in sync with name on every validation pass.
// IMPORTANT: this is pre("validate"), not pre("save") — insertMany()
// (used to bulk-seed default exercises) runs validation but does NOT
// run save middleware, so pre("save") would silently leave
// normalizedName unset for every seeded default exercise.
exerciseSchema.pre("validate", function (next) {
  if (this.name) {
    this.normalizedName = this.name.trim().toLowerCase();
  }
  next();
});

// ── Uniqueness per user ──────────────────────────────────────────
// A user (createdBy) can't have two exercises with the same
// normalizedName. Since default exercises are seeded per-user with
// createdBy: user._id (not a shared global doc), this index also
// protects against duplicate default-exercise seeding for that same
// user, on top of protecting their own custom exercises.
exerciseSchema.index(
  { createdBy: 1, normalizedName: 1 },
  {
    unique: true,
    partialFilterExpression: { createdBy: { $type: "objectId" } },
  }
);

module.exports = mongoose.model("Exercise", exerciseSchema);