import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, UserPlus, UserMinus, ShieldOff, ShieldCheck } from "lucide-react";
import api from "../services/api";
import "./publicProfile.css";

function PublicProfile() {
  const { username } = useParams();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await api.get(`/users/${username}`);
      setProfile(res.data);
    } catch (error) {
      if (error.response?.status === 404) {
        setNotFound(true);
      } else {
        console.log(error);
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
        await api.delete(`/users/${username}/follow`);
      } else {
        await api.post(`/users/${username}/follow`);
      }
      await loadProfile();
    } catch (error) {
      setActionError(error.response?.data?.message || "Something went wrong.");
    } finally {
      setActionPending(false);
    }
  };

  const handleBlockToggle = async () => {
    setActionPending(true);
    setActionError("");
    try {
      if (profile.viewerHasBlocked) {
        await api.delete(`/users/${username}/block`);
      } else {
        await api.post(`/users/${username}/block`);
      }
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
          <div className="public-profile-count">
            <strong>{profile.followerCount}</strong> Followers
          </div>
          <div className="public-profile-count">
            <strong>{profile.followingCount}</strong> Following
          </div>
        </div>

        {!profile.viewerIsSelf && (
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
              onClick={handleBlockToggle}
              disabled={actionPending}
            >
              {profile.viewerHasBlocked ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
              {profile.viewerHasBlocked ? "Unblock" : "Block"}
            </button>
          </div>
        )}

        {actionError && <p className="public-profile-error">{actionError}</p>}
      </div>
    </div>
  );
}

export default PublicProfile;
