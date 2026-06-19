const Goal = require("../models/Goal");

// ================= CREATE GOAL =================
exports.createGoal = async (req, res) => {
  try {
    const {
      title,
      type,
      target,
      unit,
      exercise,
      deadline,
    } = req.body;

    if (!title || !type || !target || !unit) {
      return res.status(400).json({
        message: "All required fields must be provided",
      });
    }

    const goal = await Goal.create({
      user: req.user._id,
      title,
      type,
      target,
      unit,
      exercise,
      deadline,
    });

    res.status(201).json(goal);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

// ================= GET GOALS =================
exports.getGoals = async (req, res) => {
  try {
    const goals = await Goal.find({
      user: req.user._id,
    }).sort({ createdAt: -1 });

    res.status(200).json(goals);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

// ================= UPDATE GOAL =================
exports.updateGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);

    if (!goal) {
      return res.status(404).json({
        message: "Goal not found",
      });
    }

    if (
      goal.user.toString() !==
      req.user._id.toString()
    ) {
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    const updatedGoal =
      await Goal.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true,
        }
      );

    res.status(200).json(updatedGoal);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

// ================= DELETE GOAL =================
exports.deleteGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(
      req.params.id
    );

    if (!goal) {
      return res.status(404).json({
        message: "Goal not found",
      });
    }

    if (
      goal.user.toString() !==
      req.user._id.toString()
    ) {
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    await Goal.findByIdAndDelete(
      req.params.id
    );

    res.status(200).json({
      message:
        "Goal deleted successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};