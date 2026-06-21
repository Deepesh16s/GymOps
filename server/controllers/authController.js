const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const Exercise = require("../models/Exercise");
const defaultExercises = require("../data/defaultExercises");

/**
 * seedDefaultExercisesForUser
 * ----------------------------
 * Seeds the default exercise library for a single user, exactly once.
 * Used by both registerUser and googleLogin so the two signup paths
 * can never drift apart.
 *
 * Guarded two ways:
 * 1. A cheap existence check up front — skips the insert entirely for
 *    any user who already has default exercises (covers normal flow,
 *    and protects existing users if this function is ever called
 *    again for them by mistake).
 * 2. `ordered: false` on insertMany + a caught duplicate-key error —
 *    if a race ever causes this to run twice concurrently for the same
 *    new user, the unique (createdBy, normalizedName) index on
 *    Exercise.js rejects the second batch's duplicates instead of
 *    creating them, and we simply swallow that specific error.
 *
 * @param {ObjectId|string} userId
 */
const seedDefaultExercisesForUser = async (userId) => {
  const alreadySeeded = await Exercise.exists({
    createdBy: userId,
    isDefault: true,
  });

  if (alreadySeeded) return;

  try {
    await Exercise.insertMany(
      defaultExercises.map((exercise) => ({
        ...exercise,
        createdBy: userId,
        isDefault: true,
      })),
      { ordered: false }
    );
  } catch (error) {
    // E11000 = duplicate key, thrown by the unique index if a race
    // condition let two seed attempts overlap for this user. Anything
    // else should still surface.
    if (error.code !== 11000 && error.code !== "E11000") {
      throw error;
    }
    console.log("Default exercise seeding skipped duplicates:", error.message);
  }
};

exports.registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    // Seed default exercise library for this new user (guarded against
    // duplicate seeding — see seedDefaultExercisesForUser above)
    await seedDefaultExercisesForUser(user._id);

    res.status(201).json({
      message: "User Registered Successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

// ================= LOGIN =================

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "Invalid Email or Password",
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid Email or Password",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login Successful",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};
exports.getMe = async (req, res) => {
  res.status(200).json(req.user);
};
// ================= UPDATE PROFILE =================
exports.updateProfile = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name: name.trim() },
      { new: true, runValidators: true }
    ).select("-password");

    res.status(200).json({ message: "Profile updated successfully", user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================= CHANGE PASSWORD =================
exports.changePassword = async (
  req,
  res
) => {
  try {
    const {
      oldPassword,
      newPassword,
    } = req.body;

    if (
      !oldPassword ||
      !newPassword
    ) {
      return res.status(400).json({
        message:
          "All fields are required",
      });
    }

    if (
      newPassword.length < 6
    ) {
      return res.status(400).json({
        message:
          "Password must be at least 6 characters",
      });
    }

    const user =
      await User.findById(
        req.user._id
      );

    if (!user) {
      return res.status(404).json({
        message:
          "User not found",
      });
    }

    const isMatch =
      await bcrypt.compare(
        oldPassword,
        user.password
      );

    if (!isMatch) {
      return res.status(400).json({
        message:
          "Current password is incorrect",
      });
    }

    const hashedPassword =
      await bcrypt.hash(
        newPassword,
        10
      );

    user.password =
      hashedPassword;

    await user.save();

    res.status(200).json({
      message:
        "Password changed successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message:
        "Server Error",
    });
  }
};

// ================= DELETE ACCOUNT =================
exports.deleteAccount = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user._id);
    res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================= GOOGLE LOGIN =================
exports.googleLogin = async (req, res) => {
  try {
    const { token: googleToken } = req.body;

    const ticket = await client.verifyIdToken({
      idToken: googleToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub, email, name, picture } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        googleId: sub,
        picture,
      });

      // Brand-new Google sign-up — seed the same default exercise
      // library as email/password registration (guarded the same way)
      await seedDefaultExercisesForUser(user._id);
    }
    // Existing user logging in via Google again: deliberately no
    // seeding call here at all — seedDefaultExercisesForUser is only
    // ever invoked once, at the moment the User doc is first created,
    // so a returning user can never trigger a second seed attempt.

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        picture: user.picture,
      },
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Google Login Failed",
    });
  }
};