const Follow = require("../models/Follow");
const Block = require("../models/Block");
const Activity = require("../models/Activity");
const PhysiquePost = require("../models/PhysiquePost");
const PhysiqueLike = require("../models/PhysiqueLike");
const PhysiqueComment = require("../models/PhysiqueComment");

const MAX_FEED_PAGE_SIZE = 30;
const DEFAULT_FEED_PAGE_SIZE = 20;

exports.getFeed = async (req, res) => {
  try {
    const viewerId = req.user._id;
    const limit = Math.min(Number(req.query.limit) || DEFAULT_FEED_PAGE_SIZE, MAX_FEED_PAGE_SIZE);

    const [follows, blocks] = await Promise.all([
      Follow.find({ follower: viewerId }).select("following"),
      Block.find({ $or: [{ blocker: viewerId }, { blocked: viewerId }] }).select("blocker blocked"),
    ]);

    const blockedIds = new Set();
    blocks.forEach((b) => {
      blockedIds.add(String(b.blocker) === String(viewerId) ? String(b.blocked) : String(b.blocker));
    });

    const actorIds = follows.map((f) => f.following).filter((id) => !blockedIds.has(String(id)));

    if (actorIds.length === 0) {
      return res.status(200).json({ activities: [], nextCursor: null, hasMore: false });
    }

    const query = { user: { $in: actorIds } };
    if (req.query.before) {
      const beforeDate = new Date(req.query.before);
      if (!Number.isNaN(beforeDate.getTime())) query.createdAt = { $lt: beforeDate };
    }

    const rows = await Activity.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate("user", "username name picture");

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);

    const postIds = page.filter((a) => a.type === "physiquePost" && a.refId).map((a) => a.refId);
    const [posts, likeCounts, commentCounts, viewerLikes] = postIds.length
      ? await Promise.all([
          PhysiquePost.find({ _id: { $in: postIds } }).select("imageUrl"),
          PhysiqueLike.aggregate([
            { $match: { post: { $in: postIds } } },
            { $group: { _id: "$post", count: { $sum: 1 } } },
          ]),
          PhysiqueComment.aggregate([
            { $match: { post: { $in: postIds } } },
            { $group: { _id: "$post", count: { $sum: 1 } } },
          ]),
          PhysiqueLike.find({ post: { $in: postIds }, user: viewerId }).select("post"),
        ])
      : [[], [], [], []];
    const postById = new Map(posts.map((p) => [String(p._id), p]));
    const likeCountByPost = new Map(likeCounts.map((l) => [String(l._id), l.count]));
    const commentCountByPost = new Map(commentCounts.map((c) => [String(c._id), c.count]));
    const likedPostSet = new Set(viewerLikes.map((l) => String(l.post)));

    const activities = page
      .filter((a) => a.user)
      .filter((a) => a.type !== "physiquePost" || postById.has(String(a.refId)))
      .map((a) => {
        const postId = a.type === "physiquePost" ? String(a.refId) : null;
        return {
          _id: a._id,
          type: a.type,
          title: a.title,
          subtitle: a.subtitle,
          createdAt: a.createdAt,
          user: {
            username: a.user.username,
            name: a.user.name,
            picture: a.user.picture || "",
          },
          image: postId ? postById.get(postId).imageUrl : null,
          postId,
          likeCount: postId ? likeCountByPost.get(postId) || 0 : null,
          commentCount: postId ? commentCountByPost.get(postId) || 0 : null,
          viewerHasLiked: postId ? likedPostSet.has(postId) : null,
        };
      });

    res.status(200).json({
      activities,
      nextCursor: hasMore && page.length ? page[page.length - 1].createdAt : null,
      hasMore,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};
