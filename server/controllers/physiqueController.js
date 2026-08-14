const User = require("../models/User");
const Follow = require("../models/Follow");
const PhysiquePost = require("../models/PhysiquePost");
const PhysiqueLike = require("../models/PhysiqueLike");
const PhysiqueComment = require("../models/PhysiqueComment");
const Activity = require("../models/Activity");
const { normalize: normalizeUsername } = require("../utils/username");
const { isBlockedEitherWay } = require("../utils/blocking");
const { canViewContent } = require("../utils/contentVisibility");
const { recordActivity } = require("../utils/activityFeed");
const { uploadBufferToCloudinary, destroyCloudinaryAsset } = require("../utils/cloudinary");
const { createNotificationIfNew } = require("../utils/notificationService");
const { NOTIFICATION_TYPES } = require("../constants/notificationTypes");
const {
  PHYSIQUE_CATEGORIES,
  PHYSIQUE_VISIBILITIES,
  CAPTION_MAX_LENGTH,
  COMMENT_MAX_LENGTH,
} = require("../constants/physiquePosts");

const MAX_LIST_PAGE_SIZE = 30;
const DEFAULT_LIST_PAGE_SIZE = 12;
const MAX_COMMENT_PAGE_SIZE = 50;
const DEFAULT_COMMENT_PAGE_SIZE = 20;

async function canViewPost(post, viewerId) {
  if (viewerId && String(viewerId) === String(post.user)) return true;
  if (viewerId && (await isBlockedEitherWay(viewerId, post.user))) return false;

  const owner = await User.findById(post.user).select("profileVisibility");
  if (!owner) return false;
  if (!(await canViewContent(owner, viewerId))) return false;

  if (post.visibility === "public") return true;
  if (!viewerId) return false;
  return !!(await Follow.exists({ follower: viewerId, following: post.user }));
}

function serializePost(post) {
  return {
    _id: post._id,
    user: post.user,
    imageUrl: post.imageUrl,
    caption: post.caption || "",
    category: post.category || null,
    visibility: post.visibility,
    createdAt: post.createdAt,
  };
}

async function attachEngagement(posts, viewerId) {
  const postIds = posts.map((p) => p._id);
  if (postIds.length === 0) return [];

  const [likeCounts, commentCounts, viewerLikes] = await Promise.all([
    PhysiqueLike.aggregate([{ $match: { post: { $in: postIds } } }, { $group: { _id: "$post", count: { $sum: 1 } } }]),
    PhysiqueComment.aggregate([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: "$post", count: { $sum: 1 } } },
    ]),
    viewerId ? PhysiqueLike.find({ post: { $in: postIds }, user: viewerId }).select("post") : [],
  ]);

  const likeMap = new Map(likeCounts.map((l) => [String(l._id), l.count]));
  const commentMap = new Map(commentCounts.map((c) => [String(c._id), c.count]));
  const likedSet = new Set(viewerLikes.map((l) => String(l.post)));

  return posts.map((p) => ({
    ...serializePost(p),
    likeCount: likeMap.get(String(p._id)) || 0,
    commentCount: commentMap.get(String(p._id)) || 0,
    viewerHasLiked: likedSet.has(String(p._id)),
  }));
}

exports.createPost = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "An image is required" });
    }

    const caption = String(req.body.caption || "").trim().slice(0, CAPTION_MAX_LENGTH);

    let category = req.body.category ? String(req.body.category).trim().toLowerCase() : null;
    if (category && !PHYSIQUE_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }
    if (!category) category = null;

    let visibility = req.body.visibility ? String(req.body.visibility).trim().toLowerCase() : "followers";
    if (!PHYSIQUE_VISIBILITIES.includes(visibility)) {
      return res.status(400).json({ message: "Invalid visibility" });
    }
    if (visibility === "public" && req.user.profileVisibility === "private") {
      return res.status(400).json({
        message: "Your account is private — physique updates can only be visible to followers.",
      });
    }

    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "repvyn/physique-posts",
      resource_type: "image",
      transformation: [{ width: 1080, height: 1350, crop: "fill", gravity: "auto" }],
    });

    const post = await PhysiquePost.create({
      user: req.user._id,
      imageUrl: result.secure_url,
      imageAssetId: result.public_id,
      caption,
      category,
      visibility,
    });

    try {
      await recordActivity(req.user._id, {
        type: "physiquePost",
        title: "shared a physique update",
        subtitle: caption || null,
        refId: post._id,
      });
    } catch (activityError) {
      console.error("Activity recording failed:", activityError);
    }

    res.status(201).json({ post: { ...serializePost(post), likeCount: 0, commentCount: 0, viewerHasLiked: false } });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Could not create post" });
  }
};

exports.listUserPosts = async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);
    const target = await User.findOne({ username }).select("_id profileVisibility");
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    const viewerId = req.user?._id;
    const isSelf = viewerId && String(viewerId) === String(target._id);

    if (!isSelf && viewerId && (await isBlockedEitherWay(viewerId, target._id))) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || DEFAULT_LIST_PAGE_SIZE, MAX_LIST_PAGE_SIZE);

    let visibilityFilter;
    if (isSelf) {
      visibilityFilter = null;
    } else {
      if (!(await canViewContent(target, viewerId))) {
        return res.status(200).json({ posts: [], page, limit, hasMore: false });
      }
      const isFollowing = viewerId
        ? !!(await Follow.exists({ follower: viewerId, following: target._id }))
        : false;
      visibilityFilter = isFollowing ? { $in: ["public", "followers"] } : "public";
    }

    const query = { user: target._id };
    if (visibilityFilter) query.visibility = visibilityFilter;

    const posts = await PhysiquePost.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      posts: await attachEngagement(posts, viewerId),
      page,
      limit,
      hasMore: posts.length === limit,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const post = await PhysiquePost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    if (String(post.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await destroyCloudinaryAsset(post.imageAssetId).catch((err) => console.log(err));
    await PhysiquePost.deleteOne({ _id: post._id });
    await Activity.deleteMany({ type: "physiquePost", refId: post._id });
    await PhysiqueLike.deleteMany({ post: post._id });
    await PhysiqueComment.deleteMany({ post: post._id });

    res.status(200).json({ message: "Post deleted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.likePost = async (req, res) => {
  try {
    const post = await PhysiquePost.findById(req.params.id).select("user visibility");
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    if (!(await canViewPost(post, req.user._id))) {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      await PhysiqueLike.create({ post: post._id, user: req.user._id });
    } catch (error) {
      if (error.code !== 11000 && error.code !== "E11000") throw error;
    }

    if (String(post.user) !== String(req.user._id)) {
      createNotificationIfNew(post.user, {
        type: NOTIFICATION_TYPES.PHYSIQUE_LIKED,
        category: "social",
        icon: "Heart",
        title: `@${req.user.username} liked your physique update`,
        navigationTarget: `/u/${req.user.username}`,
        dedupeKey: `physique-like:${post._id}:${req.user._id}`,
      }).catch((error) => console.error("Physique like notification failed:", error));
    }

    const likeCount = await PhysiqueLike.countDocuments({ post: post._id });
    res.status(200).json({ liked: true, likeCount });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.unlikePost = async (req, res) => {
  try {
    const post = await PhysiquePost.findById(req.params.id).select("user visibility");
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    if (!(await canViewPost(post, req.user._id))) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await PhysiqueLike.deleteOne({ post: post._id, user: req.user._id });
    const likeCount = await PhysiqueLike.countDocuments({ post: post._id });
    res.status(200).json({ liked: false, likeCount });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.listComments = async (req, res) => {
  try {
    const post = await PhysiquePost.findById(req.params.id).select("user visibility");
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    if (!(await canViewPost(post, req.user?._id))) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || DEFAULT_COMMENT_PAGE_SIZE, MAX_COMMENT_PAGE_SIZE);

    const comments = await PhysiqueComment.find({ post: post._id })
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("user", "username name picture");

    res.status(200).json({
      comments: comments
        .filter((c) => c.user)
        .map((c) => ({
          _id: c._id,
          text: c.text,
          createdAt: c.createdAt,
          user: { username: c.user.username, name: c.user.name, picture: c.user.picture || "" },
        })),
      page,
      limit,
      hasMore: comments.length === limit,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.createComment = async (req, res) => {
  try {
    const post = await PhysiquePost.findById(req.params.id).select("user visibility");
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    if (!(await canViewPost(post, req.user._id))) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const text = String(req.body.text || "").trim().slice(0, COMMENT_MAX_LENGTH);
    if (!text) {
      return res.status(400).json({ message: "Comment cannot be empty" });
    }

    const comment = await PhysiqueComment.create({ post: post._id, user: req.user._id, text });

    if (String(post.user) !== String(req.user._id)) {
      createNotificationIfNew(post.user, {
        type: NOTIFICATION_TYPES.PHYSIQUE_COMMENTED,
        category: "social",
        icon: "MessageCircle",
        title: `@${req.user.username} commented on your physique update`,
        subtitle: text,
        navigationTarget: `/u/${req.user.username}`,
        dedupeKey: `physique-comment:${comment._id}`,
      }).catch((error) => console.error("Physique comment notification failed:", error));
    }

    res.status(201).json({
      comment: {
        _id: comment._id,
        text: comment.text,
        createdAt: comment.createdAt,
        user: { username: req.user.username, name: req.user.name, picture: req.user.picture || "" },
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const comment = await PhysiqueComment.findById(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const isAuthor = String(comment.user) === String(req.user._id);
    let isPostOwner = false;
    if (!isAuthor) {
      const post = await PhysiquePost.findById(comment.post).select("user");
      isPostOwner = !!post && String(post.user) === String(req.user._id);
    }
    if (!isAuthor && !isPostOwner) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await PhysiqueComment.deleteOne({ _id: comment._id });
    res.status(200).json({ message: "Comment deleted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};
