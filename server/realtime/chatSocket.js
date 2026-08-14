const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const connections = new Map();

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
