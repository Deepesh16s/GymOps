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

exerciseSchema.pre("validate", function () {
  if (this.name) {
    this.normalizedName = this.name.trim().toLowerCase();
  }
});

exerciseSchema.index(
  { createdBy: 1, normalizedName: 1 },
  {
    unique: true,
    partialFilterExpression: { createdBy: { $type: "objectId" } },
  }
);

module.exports = mongoose.model("Exercise", exerciseSchema);