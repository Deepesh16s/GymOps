const mongoose = require("mongoose");
const { PHYSIQUE_CATEGORIES, PHYSIQUE_VISIBILITIES, CAPTION_MAX_LENGTH } = require("../constants/physiquePosts");

const physiquePostSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    imageAssetId: {
      type: String,
      required: true,
    },
    caption: {
      type: String,
      default: "",
      trim: true,
      maxlength: CAPTION_MAX_LENGTH,
    },
    category: {
      type: String,
      enum: PHYSIQUE_CATEGORIES,
      default: null,
    },
    visibility: {
      type: String,
      enum: PHYSIQUE_VISIBILITIES,
      default: "followers",
    },
  },
  { timestamps: true }
);

physiquePostSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("PhysiquePost", physiquePostSchema);
