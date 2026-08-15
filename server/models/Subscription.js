const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    tier: {
      type: String,
      enum: ["free", "premium"],
      default: "free",
    },
    status: {
      type: String,
      enum: ["active", "canceled", "expired", "trialing"],
      default: "active",
    },
    provider: {
      type: String,
      enum: ["manual", "stripe"],
      default: "manual",
    },
    providerSubscriptionId: {
      type: String,
      default: null,
    },
    currentPeriodEnd: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
