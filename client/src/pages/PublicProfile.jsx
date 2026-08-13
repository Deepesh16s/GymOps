import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { CalendarDays, UserPlus, UserMinus, ShieldOff, ShieldCheck, Pencil } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  getPublicProfile,
  followUser,
  unfollowUser,
  blockUser,
  unblockUser,
} from "../services/socialService";
import "./publicProfile.css";

function PublicProfile() {
  const { username } = useParams();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);

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

  const handleFollowToggle = async () => {
    setActionPending(true);
    setActionError("");
    try {
      if (profile.viewerIsFollowing) {
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

  return (
    <div className="public-profile-page">
      <div className="public-profile-card">
        <div className="public-profile-avatar">
          {profile.name?.charAt(0).toUpperCase() || "?"}
        </div>

        <h1 className="public-profile-name">{profile.name}</h1>
        <p className="public-profile-handle">@{profile.username}</p>

        {joinedDate && (
          <p className="public-profile-joined">
            <CalendarDays size={14} />
            Joined {joinedDate}
          </p>
        )}

        <div className="public-profile-counts">
          <Link to={`/u/${username}/followers`} className="public-profile-count">
            <strong>{profile.followerCount}</strong> Followers
          </Link>
          <Link to={`/u/${username}/following`} className="public-profile-count">
            <strong>{profile.followingCount}</strong> Following
          </Link>
        </div>

        {profile.viewerIsSelf ? (
          <Link to="/profile" className="public-profile-btn public-profile-btn-outline public-profile-edit-link">
            <Pencil size={16} />
            Edit Profile
          </Link>
        ) : (
          <div className="public-profile-actions">
            <button
              type="button"
              className={`public-profile-btn ${profile.viewerIsFollowing ? "public-profile-btn-outline" : "public-profile-btn-primary"}`}
              onClick={handleFollowToggle}
              disabled={actionPending || profile.viewerHasBlocked}
            >
              {profile.viewerIsFollowing ? <UserMinus size={16} /> : <UserPlus size={16} />}
              {profile.viewerIsFollowing ? "Unfollow" : "Follow"}
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
          </div>
        )}

        {actionError && <p className="public-profile-error">{actionError}</p>}
      </div>

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
    </div>
  );
}

export default PublicProfile;
