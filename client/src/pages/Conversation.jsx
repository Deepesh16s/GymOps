import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, Send, ShieldOff, Trash2 } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  getConversation,
  getMessages,
  sendMessage,
  markConversationRead,
  deleteMessage,
} from "../services/chatService";
import * as chatSocket from "../services/chatSocket";
import { formatRelativeTime } from "../utils/timeFormat";
import "./conversation.css";

const MAX_MESSAGE_LENGTH = 2000;

function readCurrentUserId() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null")?._id || null;
  } catch {
    return null;
  }
}

function Conversation() {
  const { id } = useParams();
  const viewerId = readCurrentUserId();

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const shouldStickToBottom = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [convRes, msgRes] = await Promise.all([getConversation(id), getMessages(id)]);
      setConversation(convRes.data);
      setMessages(msgRes.data.messages);
      setHasMore(msgRes.data.hasMore);
      markConversationRead(id).catch(() => {});
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (shouldStickToBottom.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages]);

  // One-shot refresh when the tab regains focus — a supplementary safety
  // net alongside the WebSocket push, not a polling replacement (see
  // chatSocket.js).
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [load]);

  useEffect(() => {
    return chatSocket.subscribe((event) => {
      if (event.conversationId !== id) return;

      if (event.type === "message:new") {
        shouldStickToBottom.current = true;
        setMessages((prev) => [...prev, event.message]);
        markConversationRead(id).catch(() => {});
      } else if (event.type === "message:read") {
        setMessages((prev) =>
          prev.map((m) => (m.senderId === viewerId && !m.readAt ? { ...m, readAt: event.readAt } : m))
        );
      } else if (event.type === "message:deleted") {
        setMessages((prev) =>
          prev.map((m) => (m._id === event.messageId ? { ...m, deleted: true, body: null } : m))
        );
      }
    });
  }, [id, viewerId]);

  const handleLoadOlder = async () => {
    if (!messages.length) return;
    setLoadingMore(true);
    shouldStickToBottom.current = false;
    const container = scrollRef.current;
    const prevHeight = container?.scrollHeight || 0;
    try {
      const res = await getMessages(id, { before: messages[0].createdAt });
      setMessages((prev) => [...res.data.messages, ...prev]);
      setHasMore(res.data.hasMore);
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - prevHeight;
      });
    } catch {
      // Leave the list as-is; the Load older button remains available to retry.
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setSendError("");
    try {
      const res = await sendMessage(id, body);
      shouldStickToBottom.current = true;
      setMessages((prev) => [...prev, res.data]);
      setDraft("");
    } catch (err) {
      setSendError(err.response?.data?.message || "Couldn't send that message.");
    } finally {
      setSending(false);
    }
  };

  const handleConfirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    try {
      await deleteMessage(id, target._id);
      setMessages((prev) =>
        prev.map((m) => (m._id === target._id ? { ...m, deleted: true, body: null } : m))
      );
    } catch {
      // The message stays as-is; nothing destructive happened client-side.
    }
  };

  if (loading) {
    return (
      <div className="conversation-page">
        <p className="conversation-hint">Loading conversation...</p>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="conversation-page">
        <p className="conversation-hint">
          Couldn't load this conversation.
          <br />
          <button type="button" className="conversation-retry" onClick={load}>
            Retry
          </button>
        </p>
      </div>
    );
  }

  const lastOwnMessage = [...messages].reverse().find((m) => m.senderId === viewerId);

  return (
    <div className="conversation-page">
      <div className="conversation-header">
        <Link to="/messages" className="conversation-back">
          <ChevronLeft size={18} />
        </Link>
        <Link
          to={`/u/${conversation.otherUser?.username}`}
          className="conversation-header-user"
        >
          <span className="conversation-avatar">
            {conversation.otherUser?.name?.charAt(0).toUpperCase() || "?"}
          </span>
          <span>
            <span className="conversation-header-name">{conversation.otherUser?.name}</span>
            <span className="conversation-header-handle">@{conversation.otherUser?.username}</span>
          </span>
        </Link>
      </div>

      <div className="conversation-scroll" ref={scrollRef}>
        {hasMore && (
          <button
            type="button"
            className="conversation-load-older"
            onClick={handleLoadOlder}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load older messages"}
          </button>
        )}

        {messages.map((m) => {
          const isOwn = m.senderId === viewerId;
          return (
            <div key={m._id} className={`conversation-row ${isOwn ? "conversation-row-own" : ""}`}>
              <div className={`conversation-bubble ${isOwn ? "conversation-bubble-own" : ""}`}>
                {m.deleted ? (
                  <span className="conversation-bubble-deleted">Message deleted</span>
                ) : (
                  <span className="conversation-bubble-text">{m.body}</span>
                )}
                <span className="conversation-bubble-time">{formatRelativeTime(m.createdAt)}</span>
              </div>
              {isOwn && !m.deleted && (
                <button
                  type="button"
                  className="conversation-delete-btn"
                  onClick={() => setDeleteTarget(m)}
                  aria-label="Delete message"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          );
        })}

        {lastOwnMessage && lastOwnMessage.readAt && !lastOwnMessage.deleted && (
          <p className="conversation-read-receipt">Read</p>
        )}

        <div ref={bottomRef} />
      </div>

      {conversation.isBlocked ? (
        <div className="conversation-blocked-notice">
          <ShieldOff size={15} />
          You can't send messages in this conversation.
        </div>
      ) : (
        <form className="conversation-composer" onSubmit={handleSend}>
          <input
            type="text"
            className="conversation-input"
            placeholder="Write a message..."
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            disabled={sending}
          />
          <button
            type="submit"
            className="conversation-send-btn"
            disabled={sending || !draft.trim()}
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </form>
      )}

      {sendError && <p className="conversation-send-error">{sendError}</p>}

      <ConfirmDialog
        open={!!deleteTarget}
        icon={Trash2}
        title="Delete this message?"
        body="This can't be undone. The other person will see that a message was deleted."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}

export default Conversation;
