import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Rss, Trophy, Flame, Award, Dumbbell, Camera, Search, Heart, Flag } from "lucide-react";
import Avatar from "../components/Avatar";
import ReportDialog from "../components/ReportDialog";
import ReactionBar from "../components/ReactionBar";
import PhysiqueImage from "../components/PhysiqueImage";
import { getFeed } from "../services/activityService";
import {
  likePhysiquePost,
  unlikePhysiquePost,
  createPhysiqueComment,
  reactToPhysiquePost,
  removePhysiqueReaction,
} from "../services/physiqueService";
import { formatRelativeTime } from "../utils/timeFormat";
import "./feed.css";

function FeedCardSkeleton() {
  return (
    <div className="feed-card feed-card--skeleton" aria-hidden="true">
      <span className="skeleton" style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }} />
      <div className="feed-card-body">
        <span className="skeleton" style={{ width: "40%", height: 14, display: "block", marginBottom: 8 }} />
        <span className="skeleton" style={{ width: "70%", height: 12, display: "block", marginBottom: 6 }} />
        <span className="skeleton" style={{ width: "50%", height: 12, display: "block" }} />
      </div>
    </div>
  );
}

const TYPE_ICON = {
  personalRecord: Trophy,
  streakMilestone: Flame,
  badgeEarned: Award,
  workoutCompleted: Dumbbell,
  physiquePost: Camera,
};

function FeedCard({
  activity,
  onToggleLike,
  onCommentPosted,
  onReport,
  onReact,
  onRemoveReaction,
  reactionError,
}) {
  const Icon = TYPE_ICON[activity.type] || Rss;
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      await createPhysiqueComment(activity.postId, text);
      setCommentText("");
      onCommentPosted(activity);
    } catch {
      /* empty */
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="feed-card">
      <Link to={`/u/${activity.user.username}`} className="feed-card-avatar">
        <Avatar src={activity.user.picture} name={activity.user.name} />
      </Link>

      <div className="feed-card-body">
        <div className="feed-card-head">
          <Link to={`/u/${activity.user.username}`} className="feed-card-name">
            {activity.user.name}
          </Link>
          <span className="feed-card-time">{formatRelativeTime(activity.createdAt)}</span>
        </div>

        <p className="feed-card-desc">
          <Icon size={14} className="feed-card-desc-icon" />
          {activity.title}
        </p>
        {activity.subtitle && <p className="feed-card-subtitle">{activity.subtitle}</p>}

        {activity.image && (
          <div className="feed-card-image-wrap">
            <PhysiqueImage src={activity.image} alt="" className="feed-card-image" loading="lazy" />
          </div>
        )}

        {activity.postId && (
          <>
            <div className="feed-card-actions">
              <button
                type="button"
                className={`feed-card-like${activity.viewerHasLiked ? " feed-card-like--active" : ""}`}
                onClick={() => onToggleLike(activity)}
                aria-pressed={!!activity.viewerHasLiked}
              >
                <Heart size={14} fill={activity.viewerHasLiked ? "currentColor" : "none"} />
                {activity.likeCount || 0}
              </button>
              <Link to={`/u/${activity.user.username}`} className="feed-card-comment-count">
                {activity.commentCount || 0} comment{activity.commentCount === 1 ? "" : "s"}
              </Link>
              <button
                type="button"
                className="feed-card-report"
                onClick={() => onReport(activity.postId)}
              >
                <Flag size={13} />
                Report
              </button>
            </div>

            <div className="feed-card-reactions">
              <ReactionBar
                reactions={activity.reactions || {}}
                viewerReaction={activity.viewerReaction}
                onReact={(type) => onReact(activity, type)}
                onRemove={() => onRemoveReaction(activity)}
              />
              {reactionError && (
                <p className="feed-card-reaction-error" role="alert">
                  {reactionError}
                </p>
              )}
            </div>

            <form className="feed-card-comment-form" onSubmit={handleSubmitComment}>
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                maxLength={500}
                disabled={submitting}
              />
              <button type="submit" disabled={submitting || !commentText.trim()}>
                Post
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Feed() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [error, setError] = useState(false);
  const [reportPostId, setReportPostId] = useState(null);
  const [reportMessage, setReportMessage] = useState("");
  const [reactionErrors, setReactionErrors] = useState({});

  const flashReactionError = (activityId, message) => {
    setReactionErrors((prev) => ({ ...prev, [activityId]: message }));
    setTimeout(() => {
      setReactionErrors((prev) => {
        if (prev[activityId] !== message) return prev;
        const next = { ...prev };
        delete next[activityId];
        return next;
      });
    }, 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await getFeed();
      setActivities(res.data.activities);
      setHasMore(res.data.hasMore);
      setNextCursor(res.data.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await getFeed(nextCursor);
      setActivities((prev) => [...prev, ...res.data.activities]);
      setHasMore(res.data.hasMore);
      setNextCursor(res.data.nextCursor);
    } catch {
      /* empty */
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggleLike = async (activity) => {
    const wasLiked = !!activity.viewerHasLiked;
    const optimistic = {
      ...activity,
      viewerHasLiked: !wasLiked,
      likeCount: Math.max(0, (activity.likeCount || 0) + (wasLiked ? -1 : 1)),
    };
    setActivities((prev) => prev.map((a) => (a._id === activity._id ? optimistic : a)));
    try {
      const res = wasLiked ? await unlikePhysiquePost(activity.postId) : await likePhysiquePost(activity.postId);
      setActivities((prev) =>
        prev.map((a) =>
          a._id === activity._id ? { ...a, viewerHasLiked: res.data.liked, likeCount: res.data.likeCount } : a
        )
      );
    } catch {
      setActivities((prev) => prev.map((a) => (a._id === activity._id ? activity : a)));
    }
  };

  const handleCommentPosted = (activity) => {
    setActivities((prev) =>
      prev.map((a) => (a._id === activity._id ? { ...a, commentCount: (a.commentCount || 0) + 1 } : a))
    );
  };

  const applyReactionResult = (activity, data) => {
    setActivities((prev) =>
      prev.map((a) =>
        a._id === activity._id ? { ...a, reactions: data.reactions, viewerReaction: data.viewerReaction } : a
      )
    );
  };

  const handleReact = async (activity, type) => {
    const before = activity;
    try {
      const res = await reactToPhysiquePost(activity.postId, type);
      applyReactionResult(activity, res.data);
    } catch (err) {
      applyReactionResult(activity, { reactions: before.reactions, viewerReaction: before.viewerReaction });
      flashReactionError(activity._id, err.response?.data?.message || "Couldn't update your reaction.");
    }
  };

  const handleRemoveReaction = async (activity) => {
    const before = activity;
    try {
      const res = await removePhysiqueReaction(activity.postId);
      applyReactionResult(activity, res.data);
    } catch (err) {
      applyReactionResult(activity, { reactions: before.reactions, viewerReaction: before.viewerReaction });
      flashReactionError(activity._id, err.response?.data?.message || "Couldn't update your reaction.");
    }
  };

  return (
    <div className="feed-page">
      <div className="feed-header">
        <h1>
          <Rss size={20} />
          Feed
        </h1>
        <p>Training milestones and physique updates from people you follow.</p>
      </div>

      {loading && (
        <div className="feed-list" aria-busy="true" aria-live="polite">
          <span className="feed-sr-only">Loading your feed…</span>
          <FeedCardSkeleton />
          <FeedCardSkeleton />
          <FeedCardSkeleton />
        </div>
      )}

      {!loading && error && (
        <p className="feed-status">
          Couldn't load your feed.
          <br />
          <button type="button" className="feed-retry" onClick={load}>
            Retry
          </button>
        </p>
      )}

      {!loading && !error && activities.length === 0 && (
        <div className="feed-empty">
          <Rss size={28} />
          <p className="feed-empty-title">Your feed is empty.</p>
          <p className="feed-empty-hint">
            Follow people to see their training milestones and physique updates here.
          </p>
          <Link to="/search" className="feed-empty-cta">
            <Search size={15} />
            Find people to follow
          </Link>
        </div>
      )}

      {!loading && !error && activities.length > 0 && (
        <div className="feed-list">
          {activities.map((a) => (
            <FeedCard
              key={a._id}
              activity={a}
              onToggleLike={handleToggleLike}
              onCommentPosted={handleCommentPosted}
              onReport={setReportPostId}
              onReact={handleReact}
              onRemoveReaction={handleRemoveReaction}
              reactionError={reactionErrors[a._id]}
            />
          ))}
          {hasMore && (
            <button type="button" className="feed-load-more" onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      )}

      {reportMessage && <p className="feed-status">{reportMessage}</p>}

      <ReportDialog
        open={!!reportPostId}
        targetType="physiquePost"
        targetId={reportPostId}
        onClose={() => setReportPostId(null)}
        onSubmitted={setReportMessage}
      />
    </div>
  );
}

export default Feed;
