const Goal = require("../models/Goal");
const Exercise = require("../models/Exercise");
const Workout = require("../models/workout");

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

    // ================= FIX: Validation =================
    // target=0 is a legitimate value and was previously rejected because
    // 0 is falsy. Explicitly check for undefined/null instead of relying
    // on truthiness.
    if (
      !title ||
      !type ||
      target === undefined ||
      target === null ||
      !unit
    ) {
      return res.status(400).json({
        message: "All required fields must be provided",
      });
    }

    // ================= BACKFILL: Calculate initial `current` value =================
    // Seeds `current` from existing workout history at creation time, so a
    // goal doesn't start at 0/target when relevant workouts already exist.
    // This only runs once, at creation — ongoing updates after this point
    // still flow through updateGoals.js (updateGoalsForWorkout /
    // recalculateGlobalAutoGoals) as normal.
    let current = 0;

    if (type === "Strength PR" && exercise) {
      // ---- Strength PR: resolve the exercise via normalizedName ----
      // Matches either the user's own custom exercise or a default one,
      // same scoping rule used elsewhere for exercise lookups.
      const normalizedExercise = exercise.trim().toLowerCase();

      const exerciseDoc = await Exercise.findOne({
  normalizedName: normalizedExercise,
  createdBy: req.user._id,
});

      if (exerciseDoc) {
        // ---- Support both legacy (string) and current (ObjectId) workout formats ----
        // Older workout docs may have stored exercise as the raw name string;
        // newer ones reference the Exercise document by _id.
        const workouts = await Workout.find({
          user: req.user._id,
          $or: [
            { exercise: exerciseDoc._id },
            { exercise: exerciseDoc.name },
          ],
        });

        let maxWeight = 0;

        // Loop through every workout, then every set, tracking the heaviest set.
        // Number(set.weight) || 0 guards against missing/malformed weight values.
        workouts.forEach((workout) => {
          (workout.workoutSets || []).forEach((set) => {
            const weight = Number(set.weight) || 0;
            if (weight > maxWeight) {
              maxWeight = weight;
            }
          });
        });

        current = maxWeight;
      } else {
        // No matching exercise on record — nothing to backfill from
        current = 0;
      }
    } else if (type === "Weekly Workout") {
      // ---- Weekly Workout: count workouts since this week's Monday ----
      // Uses the identical Monday 00:00 boundary logic as startOfWeek()
      // in updateGoals.js, so the backfilled value matches what
      // recalculateGlobalAutoGoals would compute right now.
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0=Sun … 6=Sat
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diffToMon);
      monday.setHours(0, 0, 0, 0);

      const workoutCount = await Workout.countDocuments({
        user: req.user._id,
        date: { $gte: monday },
      });

      current = workoutCount;
    } else if (type === "Monthly Volume") {
      // ---- Monthly Volume: sum (weight * reps) since the 1st of this month ----
      // Number(...) || 0 guards on both fields avoid NaN if a set is incomplete.
      const firstOfMonth = new Date();
      firstOfMonth.setDate(1);
      firstOfMonth.setHours(0, 0, 0, 0);

      const monthWorkouts = await Workout.find({
        user: req.user._id,
        date: { $gte: firstOfMonth },
      });

      let monthlyVolume = 0;

      monthWorkouts.forEach((workout) => {
        (workout.workoutSets || []).forEach((set) => {
          const weight = Number(set.weight) || 0;
          const reps = Number(set.reps) || 0;
          monthlyVolume += weight * reps;
        });
      });

      current = monthlyVolume;
    } else if (type === "Current Streak") {
      // ---- Current Streak: identical algorithm to computeCurrentStreak() in updateGoals.js ----
      // Build a Set of "YYYY-MM-DD" strings from workout dates, then walk
      // backwards day by day starting from today, counting consecutive
      // days present in the set. Stops at the first missing day. If
      // today itself has no workout, the loop never starts and current
      // stays 0.
      const allWorkouts = await Workout.find({ user: req.user._id }).select(
        "date createdAt"
      );

      if (allWorkouts.length) {
        const dateStrings = new Set(
          allWorkouts.map((w) => {
            const d = new Date(w.date || w.createdAt);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          })
        );

        const cursor = new Date();
        cursor.setHours(0, 0, 0, 0);
        let streak = 0;

        while (true) {
          const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
          if (!dateStrings.has(key)) break;
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        }

        current = streak;
      } else {
        current = 0;
      }
    }

    // ================= BACKFILL: Determine initial status =================
    // Number(...) on both sides guards against string-typed target/current
    // causing incorrect comparisons.
    const status =
      Number(current) >= Number(target) ? "Completed" : "In Progress";

    // ================= Create the goal with backfilled values =================
    const goal = await Goal.create({
      user: req.user._id,
      title: title.trim(),
      type,
      target: Number(target),
      current,
      unit: unit.trim(),
      exercise: exercise || "",
      deadline: deadline || null,
      status,
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