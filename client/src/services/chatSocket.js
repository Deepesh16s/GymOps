// Real-time chat transport — a thin, optional convenience layer, not a
// dependency chat correctness relies on. REST (chatService.js) is the
// source of truth for every read and write; this module only pushes a
// "here's what just happened" event to whoever's listening so open chat
// screens/the conversation list can update live instead of waiting for the
// next navigation or manual refresh. If the socket never connects or drops
// (e.g. the free-tier backend instance spun down), nothing breaks — the
// app just isn't "live" until it reconnects or the user revisits a page.
//
// No global state library in this app — this follows the same
// module-singleton + custom `window` event pattern as the existing
// "repvyn:user-updated" convention (see Layout.jsx/ProfileDropdown.jsx)
// rather than introducing one.

const EVENT_NAME = "repvyn:chat-event";
const MAX_BACKOFF_MS = 30000;

let socket = null;
let intentionalClose = false;
let backoffMs = 1000;
let reconnectTimer = null;

function getWsUrl() {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  const base = apiUrl.replace(/\/api\/?$/, "");
  const wsBase = base.replace(/^http/, "ws");
  const token = localStorage.getItem("token") || "";
  return `${wsBase}/ws/chat?token=${encodeURIComponent(token)}`;
}

function scheduleReconnect() {
  if (intentionalClose || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, backoffMs);
  backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
}

export function connect() {
  if (!localStorage.getItem("token")) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  intentionalClose = false;
  socket = new WebSocket(getWsUrl());

  socket.onopen = () => {
    backoffMs = 1000;
  };

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
    } catch {
      // Ignore malformed frames rather than throwing inside a socket handler.
    }
  };

  socket.onclose = () => {
    socket = null;
    scheduleReconnect();
  };

  socket.onerror = () => {
    // onclose always follows onerror for browser WebSocket — reconnect is
    // scheduled there, nothing additional needed here.
  };
}

export function disconnect() {
  intentionalClose = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  backoffMs = 1000;
  if (socket) {
    socket.close();
    socket = null;
  }
}

// Components subscribe with: chatSocket.subscribe(handler) inside useEffect,
// and call the returned function to unsubscribe on cleanup.
export function subscribe(handler) {
  const listener = (event) => handler(event.detail);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
