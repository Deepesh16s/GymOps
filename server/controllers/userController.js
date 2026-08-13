const User = require("../models/User");
const Follow = require("../models/Follow");
const Block = require("../models/Block");
const { normalize: normalizeUsername } = require("../utils/username");

const MAX_SEARCH_RESULTS = 20;
const MAX_LIST_RESULTS = 50;

// Explicit public-user representation — every route in this controller goes
// through this, never `res.json(user)` on a raw document. Deliberately
// excludes email, googleId, password/reset fields, and the private
// username-tracking flags (usernameChosenByUser, usernamePromptDismissedAt).
// Health Connect data is structurally unreachable here — this function never
// touches HealthSample/HealthSleepSession at all.
function toPublicUser(user) {
  return {
    username: user.username,
    name: user.name,
    picture: user.picture || "",
  };
}

async function findByUsername(rawUsername, select) {
  const username = normalizeUsername(rawUsername);
  return User.findOne({ username }).select(select);
}

exports.searchUsers = async (req, res) => {
  try {
    const query = String(req.query.q || "")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");

    if (!query) {
      return res.status(200).json({ users: [] });
    }

    const limit = Math.min(Number(req.query.limit) || MAX_SEARCH_RESULTS, MAX_SEARCH_RESULTS);

    // Query is pre-stripped to [a-z0-9_] only, so this anchored regex can't
    // contain regex metacharacters — safe to interpolate directly. Matches
    // against the already-lowercase-stored username, so no case-insensitive
    // flag/collation is needed for the index to be used efficiently.
    const users = await User.find({ username: { $regex: `^${query}` } })
      .select("username name picture")
      .limit(limit);

    res.status(200).json({ users: users.map(toPublicUser) });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getPublicProfile = async (req, res) => {
  try {
    const user = await findByUsername(req.params.username, "username name picture createdAt");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const viewerId = req.user?._id;
    const isSelf = viewerId && String(viewerId) === String(user._id);

    const [followerCount, followingCount, isFollowing, hasBlocked] = await Promise.all([
      Follow.countDocuments({ following: user._id }),
      Follow.countDocuments({ follower: user._id }),
      isSelf || !viewerId ? false : Follow.exists({ follower: viewerId, following: user._id }),
      isSelf || !viewerId ? false : Block.exists({ blocker: viewerId, blocked: user._id }),
    ]);

    res.status(200).json({
      ...toPublicUser(user),
      createdAt: user.createdAt,
      followerCount,
      followingCount,
      viewerIsSelf: !!isSelf,
      viewerIsFollowing: !!isFollowing,
      viewerHasBlocked: !!hasBlocked,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getFollowers = async (req, res) => {
  try {
    const user = await findByUsername(req.params.username, "_id");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, MAX_LIST_RESULTS);

    const follows = await Follow.find({ following: user._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("follower", "username name picture");

    res.status(200).json({
      users: follows.filter((f) => f.follower).map((f) => toPublicUser(f.follower)),
      page,
      limit,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getFollowing = async (req, res) => {
  try {
    const user = await findByUsername(req.params.username, "_id");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, MAX_LIST_RESULTS);

    const follows = await Follow.find({ follower: user._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("following", "username name picture");

    res.status(200).json({
      users: follows.filter((f) => f.following).map((f) => toPublicUser(f.following)),
      page,
      limit,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.followUser = async (req, res) => {
  try {
    const target = await findByUsername(req.params.username, "_id");
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    const followerId = req.user._id;
    const followingId = target._id;

    if (String(followerId) === String(followingId)) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const blocked = await Block.exists({
      $or: [
        { blocker: followerId, blocked: followingId },
        { blocker: followingId, blocked: followerId },
      ],
    });
    if (blocked) {
      return res.status(403).json({ message: "Unable to follow this user" });
    }

    try {
      await Follow.create({ follower: followerId, following: followingId });
    } catch (error) {
      // Already following — the unique index caught it, treat as success
      // rather than surfacing a duplicate-key error to the client.
      if (error.code !== 11000 && error.code !== "E11000") throw error;
    }

    res.status(200).json({ message: "Followed" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.unfollowUser = async (req, res) => {
  try {
    const target = await findByUsername(req.params.username, "_id");
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    await Follow.deleteOne({ follower: req.user._id, following: target._id });
    res.status(200).json({ message: "Unfollowed" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.blockUser = async (req, res) => {
  try {
    const target = await findByUsername(req.params.username, "_id");
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    const blockerId = req.user._id;
    const blockedId = target._id;

    if (String(blockerId) === String(blockedId)) {
      return res.status(400).json({ message: "You cannot block yourself" });
    }

    try {
      await Block.create({ blocker: blockerId, blocked: blockedId });
    } catch (error) {
      if (error.code !== 11000 && error.code !== "E11000") throw error;
    }

    // Blocking removes any existing follow relationship in either direction.
    await Follow.deleteMany({
      $or: [
        { follower: blockerId, following: blockedId },
        { follower: blockedId, following: blockerId },
      ],
    });

    res.status(200).json({ message: "Blocked" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    const target = await findByUsername(req.params.username, "_id");
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    // Deliberately does not recreate any prior follow relationship.
    await Block.deleteOne({ blocker: req.user._id, blocked: target._id });
    res.status(200).json({ message: "Unblocked" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};
