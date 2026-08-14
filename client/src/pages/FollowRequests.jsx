import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { UserPlus, Check, X } from "lucide-react";
import {
  getFollowRequests,
  acceptFollowRequest,
  declineFollowRequest,
} from "../services/socialService";
import "./followRequests.css";

function FollowRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pendingUsername, setPendingUsername] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await getFollowRequests();
      setRequests(res.data.requests);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAccept = async (username) => {
    setPendingUsername(username);
    try {
      await acceptFollowRequest(username);
      setRequests((prev) => prev.filter((r) => r.user.username !== username));
    } catch {
      /* empty */
    } finally {
      setPendingUsername(null);
    }
  };

  const handleDecline = async (username) => {
    setPendingUsername(username);
    try {
      await declineFollowRequest(username);
      setRequests((prev) => prev.filter((r) => r.user.username !== username));
    } catch {
      /* empty */
    } finally {
      setPendingUsername(null);
    }
  };

  return (
    <div className="follow-requests-page">
      <h1 className="follow-requests-title">Follow Requests</h1>

      {loading && <p className="follow-requests-hint">Loading...</p>}

      {!loading && error && (
        <div className="follow-requests-hint">
          Couldn't load follow requests.
          <button type="button" className="follow-requests-retry" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && requests.length === 0 && (
        <div className="follow-requests-empty">
          <UserPlus size={28} strokeWidth={1.5} />
          <p>No pending follow requests.</p>
        </div>
      )}

      {!loading && !error && requests.length > 0 && (
        <ul className="follow-requests-list">
          {requests.map((r) => (
            <li key={r._id} className="follow-requests-item">
              <Link to={`/u/${r.user.username}`} className="follow-requests-user">
                <span className="follow-requests-avatar">
                  {r.user.name?.charAt(0).toUpperCase() || "?"}
                </span>
                <span>
                  <span className="follow-requests-name">{r.user.name}</span>
                  <span className="follow-requests-handle">@{r.user.username}</span>
                </span>
              </Link>
              <div className="follow-requests-actions">
                <button
                  type="button"
                  className="follow-requests-btn follow-requests-btn-accept"
                  onClick={() => handleAccept(r.user.username)}
                  disabled={pendingUsername === r.user.username}
                >
                  <Check size={15} />
                </button>
                <button
                  type="button"
                  className="follow-requests-btn follow-requests-btn-decline"
                  onClick={() => handleDecline(r.user.username)}
                  disabled={pendingUsername === r.user.username}
                >
                  <X size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default FollowRequests;
