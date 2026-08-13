const User = require("../models/User");
const Follow = require("../models/Follow");
const Block = require("../models/Block");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const Exercise = require("../models/Exercise");
const defaultExercises = require("../data/defaultExercises");
const sendEmail = require("../utils/sendEmail");
const {
  normalize: normalizeUsername,
  validateFormat: validateUsernameFormat,
  isAvailable: isUsernameAvailable,
  assignGeneratedUsername,
} = require("../utils/username");

// Included in every auth response's `user` object so clients (web + mobile)
// always have what they need to decide whether to show the username prompt,
// without a second round trip.
const publicUsernameFields = (user) => ({
  username: user.username,
  usernameChosenByUser: user.usernameChosenByUser,
  usernamePromptDismissedAt: user.usernamePromptDismissedAt,
});

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
    if (error.code !== 11000 && error.code !== "E11000") {
      throw error;
    }
    console.log("Default exercise seeding skipped duplicates:", error.message);
  }
};

exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, username } = req.body;

    if (!name || !name.trim() || !email || !email.trim() || !password || !username) {
      return res.status(400).json({
        message: "Name, email, password, and username are required",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({
        message: "Please enter a valid email address",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedUsername = normalizeUsername(username);
    const usernameFormatError = validateUsernameFormat(normalizedUsername);
    if (usernameFormatError) {
      return res.status(400).json({ message: usernameFormatError });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    if (!(await isUsernameAvailable(normalizedUsername))) {
      return res.status(400).json({ message: "Username is already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let user;
    try {
      user = await User.create({
        name,
        email,
        password: hashedPassword,
        username: normalizedUsername,
        usernameChosenByUser: true,
      });
    } catch (error) {
      // Availability was checked above, but a concurrent registration could
      // still win the race — the unique index is the actual guarantee.
      if (error.code === 11000 || error.code === "E11000") {
        return res.status(400).json({ message: "Username is already taken" });
      }
      throw error;
    }

    await seedDefaultExercisesForUser(user._id);

    res.status(201).json({
      message: "User Registered Successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        ...publicUsernameFields(user),
      },
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "Invalid Email or Password",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        message: "Invalid Email or Password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid Email or Password",
      });
    }

    // Existing-user migration lazy fallback — covers anyone the one-off
    // batch script missed (see server/scripts/migrateUsernames.js). Never
    // overwrites an existing username.
    if (!user.username) {
      await assignGeneratedUsername(user);
    }

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
        ...publicUsernameFields(user),
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

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;

    await user.save();

    res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Scoped to this phase only: clean up the Follow/Block/Conversation/
    // Message records this and the prior social phase introduce, so neither
    // adds to the account-deletion debt. The pre-existing gap (workouts,
    // goals, notifications, health data, etc. are not cascaded) is a
    // separate, already-documented issue not addressed here.
    //
    // Conversations (and every message in them) are hard-deleted for BOTH
    // participants when either side deletes their account — matching the
    // existing Follow/Block precedent of full removal rather than a
    // per-user soft-delete/anonymization model. A conversation can't be
    // kept for the remaining participant without leaving a message.sender
    // pointing at a User._id that no longer exists.
    await Follow.deleteMany({ $or: [{ follower: userId }, { following: userId }] });
    await Block.deleteMany({ $or: [{ blocker: userId }, { blocked: userId }] });

    const ownedConversations = await Conversation.find({ participants: userId }).select("_id");
    const conversationIds = ownedConversations.map((c) => c._id);
    if (conversationIds.length) {
      await Message.deleteMany({ conversation: { $in: conversationIds } });
      await Conversation.deleteMany({ _id: { $in: conversationIds } });
    }

    await User.findByIdAndDelete(userId);
    res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.checkUsernameAvailable = async (req, res) => {
  try {
    const { username } = req.query;
    const value = normalizeUsername(username);

    const formatError = validateUsernameFormat(value);
    if (formatError) {
      return res.status(200).json({ available: false, message: formatError });
    }

    const available = await isUsernameAvailable(value);
    res.status(200).json({ available });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.updateUsername = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const value = normalizeUsername(username);
    const formatError = validateUsernameFormat(value);
    if (formatError) {
      return res.status(400).json({ message: formatError });
    }

    if (!(await isUsernameAvailable(value, { excludeUserId: req.user._id }))) {
      return res.status(400).json({ message: "Username is already taken" });
    }

    let user;
    try {
      user = await User.findByIdAndUpdate(
        req.user._id,
        { username: value, usernameChosenByUser: true },
        { new: true, runValidators: true }
      ).select("-password");
    } catch (error) {
      if (error.code === 11000 || error.code === "E11000") {
        return res.status(400).json({ message: "Username is already taken" });
      }
      throw error;
    }

    res.status(200).json({ message: "Username updated successfully", user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.dismissUsernamePrompt = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { usernamePromptDismissedAt: new Date() },
      { new: true }
    ).select("-password");

    res.status(200).json({ message: "Prompt dismissed", user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

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

      await seedDefaultExercisesForUser(user._id);
    }

    // Applies both to brand-new Google users and to pre-existing users the
    // migration hasn't reached yet — same shared assignment path either way,
    // no separate Google-specific username logic.
    if (!user.username) {
      await assignGeneratedUsername(user);
    }

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
        ...publicUsernameFields(user),
      },
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Google Login Failed",
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
      await user.save();

      const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

      await sendEmail({
        to: user.email,
        subject: "Reset your Repvyn password",
        html: `<p>Click the link below to reset your password. This link expires in 15 minutes.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
      });
    }

    res.status(200).json({
      message: "If an account with that email exists, a reset link has been sent.",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};