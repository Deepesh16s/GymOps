import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, UserPlus, UserMinus, Clock } from "lucide-react";
import { getFollowers, getFollowing, followUser, unfollowUser } from "../services/socialService";
import "./followList.css";

const MODES = {
  followers: { fetch: getFollowers, title: "Followers", empty: "No followers yet." },
  following: { fetch: getFollowing, title: "Following", empty: "Not following anyone yet." },
};

function FollowList({ mode }) {
  const { username } = useParams();
  const { fetch: fetchList, title, empty } = MODES[mode];

  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [pendingUsername, setPendingUsername] = useState(null);

  const loadPage = useCallback(
    async (targetPage) => {
      setError(false);
      if (targetPage === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await fetchList(username, targetPage);
        const { users: pageUsers, limit } = res.data;
        setUsers((prev) => (targetPage === 1 ? pageUsers : [...prev, ...pageUsers]));
        setHasMore(pageUsers.length === limit);
        setPage(targetPage);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [fetchList, username]
  );

  useEffect(() => {
    setUsers([]);
    setPage(1);
    loadPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, mode]);

  const handleFollowToggle = async (target) => {
    setPendingUsername(target.username);
    try {
      if (target.viewerIsFollowing || target.viewerFollowRequestPending) {
        await unfollowUser(target.username);
        setUsers((prev) =>
          prev.map((u) =>
            u.username === target.username
              ? { ...u, viewerIsFollowing: false, viewerFollowRequestPending: false }
              : u
          )
        );
      } else {
        const res = await followUser(target.username);
        setUsers((prev) =>
          prev.map((u) =>
            u.username === target.username
              ? {
                  ...u,
                  viewerIsFollowing: res.data.status === "following",
                  viewerFollowRequestPending: res.data.status === "requested",
                }
              : u
          )
        );
      }
    } catch {
      /* empty */
    } finally {
      setPendingUsername(null);
    }
  };

  return (
    <div className="follow-list-page">
      <Link to={`/u/${username}`} className="follow-list-back">
        <ChevronLeft size={16} />
        @{username}
      </Link>
      <h1 className="follow-list-title">{title}</h1>

      {loading && <p className="follow-list-hint">Loading...</p>}

      {!loading && error && (
        <div className="follow-list-hint follow-list-error">
          Couldn't load this list.
          <button type="button" className="follow-list-retry" onClick={() => loadPage(1)}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && users.length === 0 && <p className="follow-list-hint">{empty}</p>}

      {!loading && !error && users.length > 0 && (
        <ul className="follow-list-results">
          {users.map((u) => (
            <li key={u.username} className="follow-list-result">
              <Link to={`/u/${u.username}`} className="follow-list-result-link">
                <span className="follow-list-avatar">{u.name?.charAt(0).toUpperCase() || "?"}</span>
                <span>
                  <span className="follow-list-result-name">
                    {u.name}
                    {u.followsViewer && <span className="follow-list-follows-you">Follows you</span>}
                  </span>
                  <span className="follow-list-result-handle">@{u.username}</span>
                </span>
              </Link>
              {!u.viewerIsSelf && u.viewerIsFollowing !== undefined && (
                <button
                  type="button"
                  className={`follow-list-btn ${u.viewerIsFollowing || u.viewerFollowRequestPending ? "follow-list-btn-outline" : "follow-list-btn-primary"}`}
                  onClick={() => handleFollowToggle(u)}
                  disabled={pendingUsername === u.username}
                >
                  {u.viewerFollowRequestPending ? (
                    <Clock size={14} />
                  ) : u.viewerIsFollowing ? (
                    <UserMinus size={14} />
                  ) : (
                    <UserPlus size={14} />
                  )}
                  {u.viewerFollowRequestPending ? "Requested" : u.viewerIsFollowing ? "Unfollow" : "Follow"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && hasMore && (
        <button
          type="button"
          className="follow-list-load-more"
          onClick={() => loadPage(page + 1)}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
}

export default FollowList;
