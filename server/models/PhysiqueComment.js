const mongoose = require("mongoose");
const { COMMENT_MAX_LENGTH } = require("../constants/physiquePosts");

const physiqueCommentSchema = new mongoose.Schema(
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
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: COMMENT_MAX_LENGTH,
    },
  },
  { timestamps: true }
);

physiqueCommentSchema.index({ post: 1, createdAt: 1 });
physiqueCommentSchema.index({ user: 1 });

module.exports = mongoose.model("PhysiqueComment", physiqueCommentSchema);
