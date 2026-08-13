const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Real-time layer for Phase S3 chat, evaluated deliberately rather than
// defaulted to:
//
// - Single Render instance, no horizontal scaling — an in-memory
//   userId -> sockets map is sufficient; no Redis/pub-sub adapter needed.
// - `ws` chosen over Socket.IO: it's a ~50KB, zero-dependency library that
//   talks the plain WebSocket protocol the browser (and React Native) already
//   speak natively, so no client library is needed either. Socket.IO's extra
//   transport-fallback/room/adapter machinery solves problems this app
//   doesn't have at this scale.
// - REST remains the source of truth for every read and write. This module
//   only pushes a "here's what just happened" event to already-open sockets
//   as a live-update convenience — if a socket never connects, reconnects
//   after a drop, or the free-tier instance spins down between requests,
//   chat still fully works via the REST endpoints; the user just needs to
//   revisit/refocus the conversation to see the update instead of watching
//   it arrive instantly. This is the "clean transport boundary" fallback,
//   deliberately not backed by a background poll loop.
// - Browser `WebSocket` cannot set custom headers on the handshake, so the
//   JWT is passed as a query param on the upgrade URL and verified with the
//   same secret/logic as authMiddleware.protect.

const connections = new Map(); // userId (string) -> Set<WebSocket>

function registerConnection(userId, ws) {
  const key = String(userId);
  if (!connections.has(key)) connections.set(key, new Set());
  connections.get(key).add(ws);
}

function unregisterConnection(userId, ws) {
  const key = String(userId);
  const set = connections.get(key);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) connections.delete(key);
}

// Pushes a JSON event to every open socket for a user. A no-op if that user
// has no live connection — callers never need to check first.
function notifyUser(userId, event) {
  const set = connections.get(String(userId));
  if (!set || set.size === 0) return;
  const payload = JSON.stringify(event);
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}

function attach(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/chat" });

  wss.on("connection", async (ws, req) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const token = url.searchParams.get("token");
      if (!token) {
        ws.close(4001, "Missing token");
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("_id");
      if (!user) {
        ws.close(4001, "Invalid token");
        return;
      }

      const userId = String(user._id);
      registerConnection(userId, ws);

      ws.on("close", () => unregisterConnection(userId, ws));
      ws.on("error", () => unregisterConnection(userId, ws));
    } catch {
      ws.close(4001, "Invalid token");
    }
  });

  return wss;
}

module.exports = { attach, notifyUser };
