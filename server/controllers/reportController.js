const mongoose = require("mongoose");
const Report = require("../models/Report");
const User = require("../models/User");
const PhysiquePost = require("../models/PhysiquePost");
const PhysiqueComment = require("../models/PhysiqueComment");
const { REPORT_TARGET_TYPES, REPORT_REASONS, DESCRIPTION_MAX_LENGTH } = require("../constants/reportReasons");

const TARGET_MODELS = {
  user: User,
  physiquePost: PhysiquePost,
  comment: PhysiqueComment,
};

exports.createReport = async (req, res) => {
  try {
    const { targetType, reason } = req.body;
    const targetId = req.body.targetId;
    const description = String(req.body.description || "").trim().slice(0, DESCRIPTION_MAX_LENGTH);

    if (!REPORT_TARGET_TYPES.includes(targetType)) {
      return res.status(400).json({ message: "Invalid report target type" });
    }
    if (!REPORT_REASONS.includes(reason)) {
      return res.status(400).json({ message: "Invalid report reason" });
    }
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ message: "Invalid target ID" });
    }

    const Model = TARGET_MODELS[targetType];
    const ownerField = targetType === "user" ? "_id" : "user";
    const target = await Model.findById(targetId).select(ownerField === "_id" ? "_id" : "user");
    if (!target) {
      return res.status(404).json({ message: "Reported content not found" });
    }

    const ownerId = ownerField === "_id" ? target._id : target.user;
    if (String(ownerId) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot report your own content" });
    }

    try {
      await Report.create({
        reporter: req.user._id,
        targetType,
        targetId,
        reason,
        description,
      });
    } catch (error) {
      if (error.code === 11000 || error.code === "E11000") {
        return res.status(200).json({ message: "You've already reported this." });
      }
      throw error;
    }

    res.status(201).json({ message: "Report submitted. Thank you for helping keep Repvyn safe." });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};
