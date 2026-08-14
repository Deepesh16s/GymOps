import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, ShieldOff } from "lucide-react";
import { listConversations } from "../services/chatService";
import * as chatSocket from "../services/chatSocket";
import { formatRelativeTime } from "../utils/timeFormat";
import "./messages.css";

function Messages() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await listConversations();
      setConversations(res.data.conversations || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return chatSocket.subscribe((event) => {
      if (event.type !== "message:new") return;
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c._id === event.conversationId);
        if (idx === -1) {
          load();
          return prev;
        }
        const updated = {
          ...prev[idx],
          lastMessageAt: event.message.createdAt,
          lastMessagePreview: event.message.body,
          unreadCount: prev[idx].unreadCount + 1,
        };
        const rest = prev.filter((_, i) => i !== idx);
        return [updated, ...rest];
      });
    });
  }, [load]);

  return (
    <div className="messages-page">
      <h1 className="messages-title">Messages</h1>

      {loading && <p className="messages-hint">Loading...</p>}

      {!loading && error && (
        <div className="messages-hint messages-error">
          Couldn't load your conversations.
          <button type="button" className="messages-retry" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && conversations.length === 0 && (
        <div className="messages-empty">
          <MessageCircle size={28} strokeWidth={1.5} />
          <p>No conversations yet.</p>
          <p className="messages-empty-hint">
            Visit someone's profile and tap Message to start one.
          </p>
        </div>
      )}

      {!loading && !error && conversations.length > 0 && (
        <ul className="messages-list">
          {conversations.map((c) => (
            <li key={c._id}>
              <Link to={`/messages/${c._id}`} className="messages-item">
                <span className="messages-avatar">
                  {c.otherUser?.name?.charAt(0).toUpperCase() || "?"}
                </span>
                <span className="messages-item-body">
                  <span className="messages-item-top">
                    <span className="messages-item-name">{c.otherUser?.name}</span>
                    {c.lastMessageAt && (
                      <span className="messages-item-time">{formatRelativeTime(c.lastMessageAt)}</span>
                    )}
                  </span>
                  <span className="messages-item-bottom">
                    <span className="messages-item-preview">
                      {c.isBlocked && <ShieldOff size={12} />}
                      {c.lastMessagePreview || "Say hello."}
                    </span>
                    {c.unreadCount > 0 && (
                      <span className="messages-unread-badge">{c.unreadCount}</span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Messages;
