import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  CalendarDays,
  UserPlus,
  UserMinus,
  Clock,
  ShieldOff,
  ShieldCheck,
  Pencil,
  MessageCircle,
  Lock,
  Award,
  TrendingUp,
  Dumbbell,
  Activity as ActivityIcon,
  ChevronRight,
  X,
  Camera,
  Trash2,
  Heart,
  Flag,
} from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import ReportDialog from "../components/ReportDialog";
import ReactionBar from "../components/ReactionBar";
import PhysiqueImage from "../components/PhysiqueImage";
import PublicHeatmap from "../components/PublicHeatmap";
import AchievementBadge from "../components/AchievementBadge";
import PhysiqueComposerModal from "../components/PhysiqueComposerModal";
import Avatar from "../components/Avatar";
import useModalEscapeAndFocus from "../hooks/useModalEscapeAndFocus";
import {
  getPublicProfile,
  followUser,
  unfollowUser,
  blockUser,
  unblockUser,
  getHeatmap,
  getSessions,
  getPRs,
  getActivity,
} from "../services/socialService";
import {
  getPhysiquePosts,
  deletePhysiquePost,
  likePhysiquePost,
  unlikePhysiquePost,
  reactToPhysiquePost,
  removePhysiqueReaction,
  getPhysiqueComments,
  createPhysiqueComment,
  deletePhysiqueComment,
} from "../services/physiqueService";
import { createConversation } from "../services/chatService";
import { formatRelativeTime } from "../utils/timeFormat";
import "./publicProfile.css";

const BADGE_DISPLAY_CAP = 14;

function PublicProfile() {
  const { username } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [messagePending, setMessagePending] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportMessage, setReportMessage] = useState("");

  const [heatmap, setHeatmap] = useState(null);
  const [heatmapYear, setHeatmapYear] = useState("current");
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [activeBadgeId, setActiveBadgeId] = useState(null);
  const [badgesModalOpen, setBadgesModalOpen] = useState(false);
  const badgesContainerRef = useRef(null);

  useEffect(() => {
    if (!activeBadgeId) return undefined;
    const handleClickOutside = (e) => {
      if (badgesContainerRef.current && !badgesContainerRef.current.contains(e.target)) {
        setActiveBadgeId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeBadgeId]);

  const closeBadgesModal = useCallback(() => setBadgesModalOpen(false), []);
  useModalEscapeAndFocus(badgesModalOpen, closeBadgesModal);

  const closeBadgePopover = useCallback(() => setActiveBadgeId(null), []);
  useModalEscapeAndFocus(!!activeBadgeId, closeBadgePopover);

  const [prs, setPrs] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [sessionsHasMore, setSessionsHasMore] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [activity, setActivity] = useState([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);

  const [physiquePosts, setPhysiquePosts] = useState([]);
  const [physiquePage, setPhysiquePage] = useState(1);
  const [physiqueHasMore, setPhysiqueHasMore] = useState(false);
  const [physiqueLoading, setPhysiqueLoading] = useState(false);
  const [physiqueComposerOpen, setPhysiqueComposerOpen] = useState(false);
  const [activePhysiquePost, setActivePhysiquePost] = useState(null);
  const [physiqueDeleteConfirmOpen, setPhysiqueDeleteConfirmOpen] = useState(false);
  const [physiqueDeletePending, setPhysiqueDeletePending] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentDeleteTargetId, setCommentDeleteTargetId] = useState(null);
  const [commentDeletePending, setCommentDeletePending] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem("user") || "null");

  const closePhysiqueLightbox = useCallback(() => setActivePhysiquePost(null), []);
  useModalEscapeAndFocus(!!activePhysiquePost, closePhysiqueLightbox);
  const closePhysiqueComposer = useCallback(() => setPhysiqueComposerOpen(false), []);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setLoadError(false);
    try {
      const res = await getPublicProfile(username);
      setProfile(res.data);
    } catch (error) {
      if (error.response?.status === 404) {
        setNotFound(true);
      } else {
        setLoadError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!profile?.heatmapVisible) {
      setHeatmap(null);
      setHeatmapLoading(false);
      return;
    }
    setHeatmapLoading(true);
    getHeatmap(username, heatmapYear === "current" ? undefined : heatmapYear)
      .then((res) => setHeatmap(res.data))
      .catch(() => setHeatmap(null))
      .finally(() => setHeatmapLoading(false));
  }, [username, profile?.heatmapVisible, heatmapYear]);

  useEffect(() => {
    if (!profile?.viewerCanSeeContent) {
      setPrs(null);
      setSessions([]);
      setSessionsPage(1);
      setSessionsHasMore(false);
      return;
    }

    getPRs(username)
      .then((res) => setPrs(res.data))
      .catch(() => setPrs(null));

    setSessionsLoading(true);
    getSessions(username, 1)
      .then((res) => {
        setSessions(res.data.sessions);
        setSessionsHasMore(res.data.hasMore);
        setSessionsPage(1);
      })
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  }, [username, profile?.viewerCanSeeContent]);

  useEffect(() => {
    if (!profile?.viewerCanSeeContent) {
      setActivity([]);
      setActivityPage(1);
      setActivityHasMore(false);
      return;
    }
    setActivityLoading(true);
    getActivity(username, 1)
      .then((res) => {
        setActivity(res.data.activity);
        setActivityHasMore(res.data.hasMore);
        setActivityPage(1);
      })
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));
  }, [username, profile?.viewerCanSeeContent]);

  const handleLoadMoreSessions = async () => {
    setSessionsLoading(true);
    try {
      const nextPage = sessionsPage + 1;
      const res = await getSessions(username, nextPage);
      setSessions((prev) => [...prev, ...res.data.sessions]);
      setSessionsHasMore(res.data.hasMore);
      setSessionsPage(nextPage);
    } catch {
      /* empty */
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleLoadMoreActivity = async () => {
    setActivityLoading(true);
    try {
      const nextPage = activityPage + 1;
      const res = await getActivity(username, nextPage);
      setActivity((prev) => [...prev, ...res.data.activity]);
      setActivityHasMore(res.data.hasMore);
      setActivityPage(nextPage);
    } catch {
      /* empty */
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    if (!profile?.viewerCanSeeContent) {
      setPhysiquePosts([]);
      setPhysiquePage(1);
      setPhysiqueHasMore(false);
      return;
    }
    setPhysiqueLoading(true);
    getPhysiquePosts(username, 1)
      .then((res) => {
        setPhysiquePosts(res.data.posts);
        setPhysiqueHasMore(res.data.hasMore);
        setPhysiquePage(1);
      })
      .catch(() => setPhysiquePosts([]))
      .finally(() => setPhysiqueLoading(false));
  }, [username, profile?.viewerCanSeeContent]);

  const handleLoadMorePhysique = async () => {
    setPhysiqueLoading(true);
    try {
      const nextPage = physiquePage + 1;
      const res = await getPhysiquePosts(username, nextPage);
      setPhysiquePosts((prev) => [...prev, ...res.data.posts]);
      setPhysiqueHasMore(res.data.hasMore);
      setPhysiquePage(nextPage);
    } catch {
      /* empty */
    } finally {
      setPhysiqueLoading(false);
    }
  };

  const handlePhysiqueCreated = (post) => {
    setPhysiquePosts((prev) => [post, ...prev]);
    setPhysiqueComposerOpen(false);
  };

  const handleDeletePhysiquePost = async () => {
    if (!activePhysiquePost) return;
    setPhysiqueDeletePending(true);
    try {
      await deletePhysiquePost(activePhysiquePost._id);
      setPhysiquePosts((prev) => prev.filter((p) => p._id !== activePhysiquePost._id));
      setActivePhysiquePost(null);
      setPhysiqueDeleteConfirmOpen(false);
    } catch {
      /* empty */
    } finally {
      setPhysiqueDeletePending(false);
    }
  };

  useEffect(() => {
    if (!activePhysiquePost) {
      setComments([]);
      setCommentsPage(1);
      setCommentsHasMore(false);
      setCommentText("");
      return;
    }
    setCommentsLoading(true);
    getPhysiqueComments(activePhysiquePost._id, 1)
      .then((res) => {
        setComments(res.data.comments);
        setCommentsHasMore(res.data.hasMore);
        setCommentsPage(1);
      })
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }, [activePhysiquePost?._id]);

  const handleLoadMoreComments = async () => {
    if (!activePhysiquePost) return;
    setCommentsLoading(true);
    try {
      const nextPage = commentsPage + 1;
      const res = await getPhysiqueComments(activePhysiquePost._id, nextPage);
      setComments((prev) => [...prev, ...res.data.comments]);
      setCommentsHasMore(res.data.hasMore);
      setCommentsPage(nextPage);
    } catch {
      /* empty */
    } finally {
      setCommentsLoading(false);
    }
  };

  const applyPostUpdate = (updated) => {
    setActivePhysiquePost(updated);
    setPhysiquePosts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
  };

  const handleToggleLike = async () => {
    if (!activePhysiquePost || likePending) return;
    const before = activePhysiquePost;
    const wasLiked = !!before.viewerHasLiked;
    applyPostUpdate({
      ...before,
      viewerHasLiked: !wasLiked,
      likeCount: Math.max(0, (before.likeCount || 0) + (wasLiked ? -1 : 1)),
    });
    setLikePending(true);
    try {
      const res = wasLiked
        ? await unlikePhysiquePost(before._id)
        : await likePhysiquePost(before._id);
      applyPostUpdate({ ...before, viewerHasLiked: res.data.liked, likeCount: res.data.likeCount });
    } catch {
      applyPostUpdate(before);
    } finally {
      setLikePending(false);
    }
  };

  const handleReact = async (type) => {
    if (!activePhysiquePost) return;
    const before = activePhysiquePost;
    try {
      const res = await reactToPhysiquePost(before._id, type);
      applyPostUpdate({ ...before, reactions: res.data.reactions, viewerReaction: res.data.viewerReaction });
    } catch {
      /* empty */
    }
  };

  const handleRemoveReaction = async () => {
    if (!activePhysiquePost) return;
    const before = activePhysiquePost;
    try {
      const res = await removePhysiqueReaction(before._id);
      applyPostUpdate({ ...before, reactions: res.data.reactions, viewerReaction: res.data.viewerReaction });
    } catch {
      /* empty */
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!activePhysiquePost || !commentText.trim() || commentSubmitting) return;
    setCommentSubmitting(true);
    try {
      const res = await createPhysiqueComment(activePhysiquePost._id, commentText.trim());
      setComments((prev) => [...prev, res.data.comment]);
      setCommentText("");
      applyPostUpdate({ ...activePhysiquePost, commentCount: (activePhysiquePost.commentCount || 0) + 1 });
    } catch {
      /* empty */
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleConfirmDeleteComment = async () => {
    if (!activePhysiquePost || !commentDeleteTargetId) return;
    const commentId = commentDeleteTargetId;
    setCommentDeletePending(true);
    try {
      await deletePhysiqueComment(commentId);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
      applyPostUpdate({ ...activePhysiquePost, commentCount: Math.max(0, (activePhysiquePost.commentCount || 0) - 1) });
      setCommentDeleteTargetId(null);
    } catch {
      /* empty */
    } finally {
      setCommentDeletePending(false);
    }
  };

  const handleFollowToggle = async () => {
    setActionPending(true);
    setActionError("");
    try {
      if (profile.viewerIsFollowing || profile.viewerFollowRequestPending) {
        await unfollowUser(username);
      } else {
        await followUser(username);
      }
      await loadProfile();
    } catch (error) {
      setActionError(error.response?.data?.message || "Something went wrong.");
    } finally {
      setActionPending(false);
    }
  };

  const handleBlockConfirmed = async () => {
    setBlockConfirmOpen(false);
    setActionPending(true);
    setActionError("");
    try {
      await blockUser(username);
      await loadProfile();
    } catch (error) {
      setActionError(error.response?.data?.message || "Something went wrong.");
    } finally {
      setActionPending(false);
    }
  };

  const handleMessage = async () => {
    setMessagePending(true);
    setActionError("");
    try {
      const res = await createConversation(username);
      navigate(`/messages/${res.data._id}`);
    } catch (error) {
      setActionError(error.response?.data?.message || "Unable to start a conversation with this user.");
    } finally {
      setMessagePending(false);
    }
  };

  const handleUnblock = async () => {
    setActionPending(true);
    setActionError("");
    try {
      await unblockUser(username);
      await loadProfile();
    } catch (error) {
      setActionError(error.response?.data?.message || "Something went wrong.");
    } finally {
      setActionPending(false);
    }
  };

  if (loading) {
    return (
      <div className="public-profile-page">
        <p className="public-profile-loading">Loading profile...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="public-profile-page">
        <p className="public-profile-loading">@{username} isn't on Repvyn.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="public-profile-page">
        <p className="public-profile-loading">
          Couldn't load this profile.
          <br />
          <button type="button" className="public-profile-retry" onClick={loadProfile}>
            Retry
          </button>
        </p>
      </div>
    );
  }

  const joinedDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long" })
    : null;

  const canMessage = profile.profileVisibility !== "private" || (profile.viewerIsFollowing && profile.followsViewer);

  const followBtnLabel = profile.viewerFollowRequestPending
    ? "Requested"
    : profile.viewerIsFollowing
      ? "Unfollow"
      : "Follow";

  const currentYear = new Date().getFullYear();
  const joinYear = profile.createdAt ? new Date(profile.createdAt).getFullYear() : currentYear;
  const heatmapYearOptions = [];
  for (let y = currentYear - 1; y >= joinYear; y--) heatmapYearOptions.push(y);

  const earnedBadges = profile.badges.filter((b) => b.earned);
  const earnedBadgeCount = earnedBadges.length;
  const mostRecentEarnedBadge = earnedBadges[0] || null;
  const visibleBadges = profile.badges.slice(0, BADGE_DISPLAY_CAP);
  const fitnessStats = profile.fitnessStats;

  return (
    <div className="public-profile-page">
      <div className="public-profile-hero">
      <div className="public-profile-main">
      <div className="public-profile-card">
        <div className="public-profile-avatar public-profile-avatar-ring">
          <Avatar src={profile.picture} name={profile.name} imgClassName="public-profile-avatar-img" />
        </div>

        <h1 className="public-profile-name">{profile.name}</h1>
        <p className="public-profile-handle">
          @{profile.username}
          {profile.followsViewer && <span className="public-profile-follows-you">Follows you</span>}
        </p>

        {joinedDate && (
          <p className="public-profile-joined">
            <CalendarDays size={14} />
            Joined {joinedDate}
          </p>
        )}

        <div className="public-profile-counts">
          {fitnessStats && (
            <span className="public-profile-count public-profile-count-static">
              <strong>{fitnessStats.sessionCount}</strong> Sessions
            </span>
          )}
          <Link to={`/u/${username}/followers`} className="public-profile-count">
            <strong>{profile.followerCount}</strong> Followers
          </Link>
          <Link to={`/u/${username}/following`} className="public-profile-count">
            <strong>{profile.followingCount}</strong> Following
          </Link>
        </div>

        {fitnessStats && fitnessStats.currentStreak > 0 && (
          <p className="public-profile-highlight">
            {`🔥 ${fitnessStats.currentStreak}-day streak`}
          </p>
        )}

        {profile.viewerIsSelf ? (
          <div className="public-profile-actions">
            <Link to="/profile" className="public-profile-btn public-profile-btn-outline public-profile-edit-link">
              <Pencil size={16} />
              Edit Profile
            </Link>
            <button
              type="button"
              className="public-profile-btn public-profile-btn-outline"
              onClick={() => setPhysiqueComposerOpen(true)}
            >
              <Camera size={16} />
              Post Physique
            </button>
          </div>
        ) : (
          <>
            <div className="public-profile-actions">
              <button
                type="button"
                className={`public-profile-btn ${profile.viewerIsFollowing || profile.viewerFollowRequestPending ? "public-profile-btn-outline" : "public-profile-btn-primary"}`}
                onClick={handleFollowToggle}
                disabled={actionPending || profile.viewerHasBlocked}
              >
                {profile.viewerFollowRequestPending ? (
                  <Clock size={16} />
                ) : profile.viewerIsFollowing ? (
                  <UserMinus size={16} />
                ) : (
                  <UserPlus size={16} />
                )}
                {followBtnLabel}
              </button>

              <button
                type="button"
                className="public-profile-btn public-profile-btn-outline"
                onClick={handleMessage}
                disabled={messagePending || profile.viewerHasBlocked || !canMessage}
              >
                <MessageCircle size={16} />
                Message
              </button>

              <button
                type="button"
                className="public-profile-btn public-profile-btn-ghost"
                onClick={() => (profile.viewerHasBlocked ? handleUnblock() : setBlockConfirmOpen(true))}
                disabled={actionPending}
              >
                {profile.viewerHasBlocked ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
                {profile.viewerHasBlocked ? "Unblock" : "Block"}
              </button>

              <button
                type="button"
                className="public-profile-btn public-profile-btn-ghost"
                onClick={() => setReportTarget({ targetType: "user", targetId: profile._id })}
              >
                <Flag size={16} />
                Report
              </button>
            </div>

            {!canMessage && !profile.viewerHasBlocked && (
              <p className="public-profile-message-hint">
                You need to follow each other to message this user.
              </p>
            )}
          </>
        )}

        {actionError && <p className="public-profile-error">{actionError}</p>}
        {reportMessage && <p className="public-profile-message-hint">{reportMessage}</p>}
      </div>
      </div>

      <div className="public-profile-side">
        <div className="public-profile-side-block">
            <div className="public-profile-badges-header">
              <h2 className="public-profile-section-title">
                <Award size={16} />
                Badges
              </h2>
              <div className="public-profile-badges-header-right">
                <span className="public-profile-badges-count">{earnedBadgeCount}</span>
                {profile.badges.length > BADGE_DISPLAY_CAP && (
                  <button
                    type="button"
                    className="public-profile-badges-more"
                    onClick={() => setBadgesModalOpen(true)}
                    aria-label={`See all ${earnedBadgeCount} badges`}
                  >
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>

            {profile.badges.length === 0 ? (
              <p className="public-profile-empty-hint">No badges earned yet.</p>
            ) : (
              <>
                <div className="public-profile-badges" ref={badgesContainerRef}>
                  {visibleBadges.map((b) => (
                    <div key={b.id} className="public-profile-hexbadge-wrap">
                      {activeBadgeId === b.id && (
                        <div className="public-profile-hexbadge-tooltip">
                          <strong>{b.earned ? b.name : `Locked — ${b.name}`}</strong>
                          <span>{b.description}</span>
                          {b.earned && (
                            <span className="public-profile-hexbadge-tooltip-date">
                              Earned {new Date(b.earnedAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                      )}
                      <AchievementBadge
                        type={b.type}
                        tier={b.tier}
                        color={b.color}
                        threshold={b.threshold}
                        earned={b.earned}
                        name={`${b.name} — ${b.description}`}
                        onClick={() => setActiveBadgeId((prev) => (prev === b.id ? null : b.id))}
                      />
                    </div>
                  ))}
                </div>
                {mostRecentEarnedBadge && (
                  <p className="public-profile-badges-recent">
                    Most Recent Badge
                    <strong>{mostRecentEarnedBadge.name}</strong>
                  </p>
                )}
              </>
            )}
          </div>
      </div>
      </div>

      {heatmapLoading && !heatmap && (
        <div className="public-profile-section">
          <div className="public-profile-badges-header">
            <h2 className="public-profile-section-title">Training Activity</h2>
          </div>
          <span className="skeleton" style={{ display: "block", width: "100%", height: 140, borderRadius: 8 }} />
        </div>
      )}

      {heatmap && (
        <div className="public-profile-section">
          <div className="public-profile-badges-header">
            <h2 className="public-profile-section-title">Training Activity</h2>
            <select
              className="public-profile-year-select"
              value={heatmapYear}
              onChange={(e) => {
                const value = e.target.value;
                setHeatmapYear(value === "current" ? "current" : Number(value));
              }}
            >
              <option value="current">Current</option>
              {heatmapYearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <PublicHeatmap
            {...heatmap}
            username={username}
            canViewDetail={profile.viewerCanSeeContent}
          />
        </div>
      )}

      {profile.viewerCanSeeContent && (
        <div className="public-profile-section">
          <h2 className="public-profile-section-title">
            <Camera size={16} />
            Physique
          </h2>

          {physiquePosts.length === 0 && !physiqueLoading ? (
            <p className="public-profile-empty-hint">No physique updates yet.</p>
          ) : (
            <>
              <div className="public-profile-physique-grid">
                {physiquePosts.map((p) => (
                  <button
                    type="button"
                    key={p._id}
                    className="public-profile-physique-tile"
                    onClick={() => setActivePhysiquePost(p)}
                  >
                    <PhysiqueImage src={p.imageUrl} alt={p.caption || "Physique update"} loading="lazy" />
                  </button>
                ))}
              </div>
              {physiqueHasMore && (
                <button
                  type="button"
                  className="public-profile-load-more"
                  onClick={handleLoadMorePhysique}
                  disabled={physiqueLoading}
                >
                  {physiqueLoading ? "Loading..." : "View all"}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {!profile.viewerCanSeeContent ? (
        <div className="public-profile-section public-profile-private-notice">
          <Lock size={20} />
          <p>This account is private.</p>
          <p className="public-profile-private-hint">
            Follow @{profile.username} to see their workouts, PRs, and activity.
          </p>
        </div>
      ) : (
        <>
          {prs && prs.lifts.length > 0 && (
            <div className="public-profile-section">
              <h2 className="public-profile-section-title">
                <TrendingUp size={16} />
                Personal Records
              </h2>
              <div className="public-profile-pr-grid">
                {prs.lifts.map((lift) => (
                  <div key={lift.slot} className="public-profile-pr-card">
                    <p className="public-profile-pr-exercise">{lift.exercise}</p>
                    <p className="public-profile-pr-weight">
                      {lift.weight}kg <span>× {lift.reps}</span>
                    </p>
                    <p className="public-profile-pr-est">Est. 1RM {lift.estOneRM}kg</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="public-profile-section">
            <h2 className="public-profile-section-title">
              <Dumbbell size={16} />
              Recent Sessions
            </h2>
            {sessions.length === 0 && !sessionsLoading && (
              <p className="public-profile-empty-hint">No sessions logged yet.</p>
            )}
            <ul className="public-profile-session-list">
              {sessions.map((s, i) => (
                <li key={`${s.date}-${i}`} className="public-profile-session-item">
                  <div>
                    <p className="public-profile-session-name">{s.name}</p>
                    <p className="public-profile-session-exercises">
                      {s.exercises.length > 0 ? s.exercises.join(", ") : "Cardio"}
                    </p>
                  </div>
                  <div className="public-profile-session-meta">
                    <span>{formatRelativeTime(s.date)}</span>
                    {s.durationMinutes != null && <span>{s.durationMinutes} min</span>}
                  </div>
                </li>
              ))}
            </ul>
            {sessionsHasMore && (
              <button
                type="button"
                className="public-profile-load-more"
                onClick={handleLoadMoreSessions}
                disabled={sessionsLoading}
              >
                {sessionsLoading ? "Loading..." : "Load more"}
              </button>
            )}
          </div>
        </>
      )}

      {activity.length > 0 && (
        <div className="public-profile-section">
          <h2 className="public-profile-section-title">
            <ActivityIcon size={16} />
            Recent Activity
          </h2>
          <ul className="public-profile-activity-list">
            {activity.map((a) => (
              <li key={a._id} className="public-profile-activity-item">
                <p className="public-profile-activity-title">{a.title}</p>
                {a.subtitle && <p className="public-profile-activity-subtitle">{a.subtitle}</p>}
                <p className="public-profile-activity-time">{formatRelativeTime(a.createdAt)}</p>
              </li>
            ))}
          </ul>
          {activityHasMore && (
            <button
              type="button"
              className="public-profile-load-more"
              onClick={handleLoadMoreActivity}
              disabled={activityLoading}
            >
              {activityLoading ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={blockConfirmOpen}
        icon={ShieldOff}
        title={`Block @${username}?`}
        body="They won't be able to follow you, and any existing follow between you will be removed. You can unblock them later."
        confirmLabel="Block"
        onConfirm={handleBlockConfirmed}
        onCancel={() => setBlockConfirmOpen(false)}
        danger
      />

      <PhysiqueComposerModal
        open={physiqueComposerOpen}
        accountIsPrivate={profile.profileVisibility === "private"}
        onCancel={closePhysiqueComposer}
        onCreated={handlePhysiqueCreated}
      />

      {activePhysiquePost && (
        <div className="physique-lightbox-overlay" onMouseDown={closePhysiqueLightbox}>
          <div
            className="physique-lightbox-card"
            role="dialog"
            aria-modal="true"
            aria-label="Physique update"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button type="button" className="physique-lightbox-close" onClick={closePhysiqueLightbox} aria-label="Close">
              <X size={18} />
            </button>
            <PhysiqueImage
              src={activePhysiquePost.imageUrl}
              alt={activePhysiquePost.caption || "Physique update"}
            />
            <div className="physique-lightbox-body">
              <div className="physique-lightbox-info">
                {activePhysiquePost.caption && <p>{activePhysiquePost.caption}</p>}
                <span>{formatRelativeTime(activePhysiquePost.createdAt)}</span>
                {profile.viewerIsSelf && (
                  <span className="physique-lightbox-visibility">
                    {activePhysiquePost.visibility === "public" ? "Public" : "Followers only"}
                  </span>
                )}
                {profile.viewerIsSelf ? (
                  <button
                    type="button"
                    className="physique-lightbox-delete"
                    onClick={() => setPhysiqueDeleteConfirmOpen(true)}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                ) : (
                  <button
                    type="button"
                    className="physique-lightbox-delete"
                    onClick={() =>
                      setReportTarget({ targetType: "physiquePost", targetId: activePhysiquePost._id })
                    }
                  >
                    <Flag size={14} />
                    Report
                  </button>
                )}
              </div>

              <div className="physique-lightbox-actions">
                <button
                  type="button"
                  className={`physique-lightbox-like${activePhysiquePost.viewerHasLiked ? " physique-lightbox-like--active" : ""}`}
                  onClick={handleToggleLike}
                  disabled={likePending}
                  aria-pressed={!!activePhysiquePost.viewerHasLiked}
                >
                  <Heart size={16} fill={activePhysiquePost.viewerHasLiked ? "currentColor" : "none"} />
                  {activePhysiquePost.likeCount || 0}
                </button>
                <span className="physique-lightbox-comment-count">
                  {activePhysiquePost.commentCount || 0} comment{activePhysiquePost.commentCount === 1 ? "" : "s"}
                </span>
              </div>

              <div className="physique-lightbox-reactions">
                <ReactionBar
                  reactions={activePhysiquePost.reactions || {}}
                  viewerReaction={activePhysiquePost.viewerReaction}
                  onReact={handleReact}
                  onRemove={handleRemoveReaction}
                />
              </div>

              <div className="physique-lightbox-comments">
                {commentsLoading && comments.length === 0 ? (
                  <p className="physique-lightbox-comments-empty">Loading comments...</p>
                ) : comments.length === 0 ? (
                  <p className="physique-lightbox-comments-empty">No comments yet.</p>
                ) : (
                  <ul className="physique-lightbox-comment-list">
                    {comments.map((c) => {
                      const isOwnComment = currentUser && currentUser.username === c.user.username;
                      const canDelete = profile.viewerIsSelf || isOwnComment;
                      return (
                        <li key={c._id} className="physique-lightbox-comment">
                          <div className="physique-lightbox-comment-avatar">
                            <Avatar src={c.user.picture} name={c.user.name} />
                          </div>
                          <div className="physique-lightbox-comment-body">
                            <p>
                              <Link to={`/u/${c.user.username}`} className="physique-lightbox-comment-name">
                                {c.user.name}
                              </Link>
                              {c.text}
                            </p>
                            <div className="physique-lightbox-comment-meta">
                              <span>{formatRelativeTime(c.createdAt)}</span>
                              {canDelete && (
                                <button type="button" onClick={() => setCommentDeleteTargetId(c._id)}>
                                  Delete
                                </button>
                              )}
                              {!isOwnComment && (
                                <button
                                  type="button"
                                  onClick={() => setReportTarget({ targetType: "comment", targetId: c._id })}
                                >
                                  Report
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {commentsHasMore && (
                  <button
                    type="button"
                    className="physique-lightbox-comments-more"
                    onClick={handleLoadMoreComments}
                    disabled={commentsLoading}
                  >
                    {commentsLoading ? "Loading..." : "Load more comments"}
                  </button>
                )}
              </div>

              <form className="physique-lightbox-comment-form" onSubmit={handleAddComment}>
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  maxLength={500}
                  disabled={commentSubmitting}
                />
                <button type="submit" disabled={commentSubmitting || !commentText.trim()}>
                  Post
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={physiqueDeleteConfirmOpen}
        icon={Trash2}
        title="Delete this physique update?"
        body="This will permanently remove the photo and its post. This can't be undone."
        confirmLabel={physiqueDeletePending ? "Deleting..." : "Delete"}
        onConfirm={handleDeletePhysiquePost}
        onCancel={() => setPhysiqueDeleteConfirmOpen(false)}
        danger
      />

      <ConfirmDialog
        open={!!commentDeleteTargetId}
        icon={Trash2}
        title="Delete this comment?"
        body="This can't be undone."
        confirmLabel={commentDeletePending ? "Deleting..." : "Delete"}
        onConfirm={handleConfirmDeleteComment}
        onCancel={() => setCommentDeleteTargetId(null)}
        danger
      />

      <ReportDialog
        open={!!reportTarget}
        targetType={reportTarget?.targetType}
        targetId={reportTarget?.targetId}
        onClose={() => setReportTarget(null)}
        onSubmitted={setReportMessage}
      />

      {badgesModalOpen && (
        <div className="badges-modal-overlay" onMouseDown={closeBadgesModal}>
          <div
            className="badges-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="badges-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="badges-modal-header">
              <h2 id="badges-modal-title">All Badges ({earnedBadgeCount})</h2>
              <button type="button" className="badges-modal-close" onClick={closeBadgesModal} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="badges-modal-list">
              {profile.badges.map((b) => (
                <div key={b.id} className={`badges-modal-row${b.earned ? "" : " badges-modal-row--locked"}`}>
                  <AchievementBadge
                    type={b.type}
                    tier={b.tier}
                    color={b.color}
                    threshold={b.threshold}
                    earned={b.earned}
                    name={`${b.name} — ${b.description}`}
                  />
                  <div className="badges-modal-row-info">
                    <strong>{b.earned ? b.name : `Locked — ${b.name}`}</strong>
                    <span>{b.description}</span>
                    {b.earned && (
                      <span className="badges-modal-row-date">
                        Earned {new Date(b.earnedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PublicProfile;
