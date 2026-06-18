const Exercise = require("../models/Exercise");

// ================= CREATE EXERCISE =================

exports.createExercise = async (
  req,
  res
) => {
  try {
    const {
      name,
      muscleGroup,
    } = req.body;

    if (
      !name ||
      !muscleGroup
    ) {
      return res
        .status(400)
        .json({
          message:
            "Name and muscle group are required",
        });
    }

    const exerciseExists =
      await Exercise.findOne({
        name: {
          $regex:
            new RegExp(
              "^" +
                name.trim() +
                "$",
              "i"
            ),
        },

        $or: [
          {
            isDefault: true,
          },
          {
            createdBy:
              req.user._id,
          },
        ],
      });

    if (
      exerciseExists
    ) {
      return res
        .status(400)
        .json({
          message:
            "Exercise already exists",
        });
    }

    const exercise =
      await Exercise.create({
        name:
          name.trim(),

        muscleGroup,

        isDefault: false,

        createdBy:
          req.user._id,
      });

    res.status(201).json(
      exercise
    );
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message:
        error.message,
    });
  }
};

// ================= GET EXERCISES =================

exports.getExercises =
  async (req, res) => {
    try {
      const {
        muscleGroup,
      } = req.query;

      const filter = {
        $or: [
          {
            isDefault: true,
          },
          {
            createdBy:
              req.user._id,
          },
        ],
      };

      if (
        muscleGroup
      ) {
        filter.muscleGroup =
          muscleGroup;
      }

      const exercises =
        await Exercise.find(
          filter
        ).sort({
          name: 1,
        });

      res.status(200).json(
        exercises
      );
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message:
          "Server Error",
      });
    }
  };

// ================= UPDATE EXERCISE =================

exports.updateExercise =
  async (req, res) => {
    try {
      const exercise =
        await Exercise.findById(
          req.params.id
        );

      if (!exercise) {
        return res
          .status(404)
          .json({
            message:
              "Exercise not found",
          });
      }

      if (
        exercise.isDefault
      ) {
        return res
          .status(403)
          .json({
            message:
              "Default exercises cannot be edited",
          });
      }

      if (
        exercise.createdBy.toString() !==
        req.user._id.toString()
      ) {
        return res
          .status(403)
          .json({
            message:
              "You can edit only your own exercises",
          });
      }

      const updatedExercise =
        await Exercise.findByIdAndUpdate(
          req.params.id,
          req.body,
          {
            new: true,
            runValidators: true,
          }
        );

      res.status(200).json({
        message:
          "Exercise Updated Successfully",

        exercise:
          updatedExercise,
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message:
          "Server Error",
      });
    }
  };

// ================= DELETE EXERCISE =================

exports.deleteExercise =
  async (req, res) => {
    try {
      const exercise =
        await Exercise.findById(
          req.params.id
        );

      if (!exercise) {
        return res
          .status(404)
          .json({
            message:
              "Exercise not found",
          });
      }

      if (
        exercise.isDefault
      ) {
        return res
          .status(403)
          .json({
            message:
              "Default exercises cannot be deleted",
          });
      }

      if (
        exercise.createdBy.toString() !==
        req.user._id.toString()
      ) {
        return res
          .status(403)
          .json({
            message:
              "You can delete only your own exercises",
          });
      }

      await exercise.deleteOne();

      res.status(200).json({
        message:
          "Exercise Deleted Successfully",
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message:
          "Server Error",
      });
    }
  };