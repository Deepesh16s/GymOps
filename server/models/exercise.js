const mongoose = require("mongoose");

const exerciseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

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

// pre("validate"), not pre("save") — insertMany() runs validation
// but skips save middleware, so pre("save") would miss bulk-seeded
// default exercises.
exerciseSchema.pre("validate", function (next) {
  if (this.name) {
    this.normalizedName = this.name.trim().toLowerCase();
  }
  next();
});

// one exercise per (user, normalizedName) — also blocks duplicate
// default-exercise seeding for the same user
exerciseSchema.index(
  { createdBy: 1, normalizedName: 1 },
  {
    unique: true,
    partialFilterExpression: { createdBy: { $type: "objectId" } },
  }
);

module.exports = mongoose.model("Exercise", exerciseSchema);