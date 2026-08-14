import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Rss, Trophy, Flame, Award, Dumbbell, Camera, Search, Heart } from "lucide-react";
import Avatar from "../components/Avatar";
import { getFeed } from "../services/activityService";
import { likePhysiquePost, unlikePhysiquePost, createPhysiqueComment } from "../services/physiqueService";
import { formatRelativeTime } from "../utils/timeFormat";
import "./feed.css";

const TYPE_ICON = {
  personalRecord: Trophy,
  streakMilestone: Flame,
  badgeEarned: Award,
  workoutCompleted: Dumbbell,
  physiquePost: Camera,
};

function FeedCard({ activity, onToggleLike, onCommentPosted }) {
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
            <img src={activity.image} alt="" className="feed-card-image" loading="lazy" />
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

  return (
    <div className="feed-page">
      <div className="feed-header">
        <h1>
          <Rss size={20} />
          Feed
        </h1>
        <p>Training milestones and physique updates from people you follow.</p>
      </div>

      {loading && <p className="feed-status">Loading your feed...</p>}

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
            <FeedCard key={a._id} activity={a} onToggleLike={handleToggleLike} onCommentPosted={handleCommentPosted} />
          ))}
          {hasMore && (
            <button type="button" className="feed-load-more" onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default Feed;
