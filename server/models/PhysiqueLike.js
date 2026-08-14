const mongoose = require("mongoose");

const physiqueLikeSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PhysiquePost",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

physiqueLikeSchema.index({ post: 1, user: 1 }, { unique: true });
physiqueLikeSchema.index({ user: 1 });

module.exports = mongoose.model("PhysiqueLike", physiqueLikeSchema);
