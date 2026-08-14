const mongoose = require("mongoose");
const { REPORT_TARGET_TYPES, REPORT_REASONS, REPORT_STATUSES } = require("../constants/reportReasons");

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetType: {
      type: String,
      enum: REPORT_TARGET_TYPES,
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    reason: {
      type: String,
      enum: REPORT_REASONS,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: "pending",
    },
  },
  { timestamps: true }
);

reportSchema.index({ reporter: 1, targetType: 1, targetId: 1 }, { unique: true });
reportSchema.index({ targetType: 1, targetId: 1 });
reportSchema.index({ status: 1 });

module.exports = mongoose.model("Report", reportSchema);
