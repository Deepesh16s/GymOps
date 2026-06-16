const mongoose = require("mongoose");

const exerciseSchema = new mongoose.Schema(
{
  name: {
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

module.exports = mongoose.model("Exercise", exerciseSchema);