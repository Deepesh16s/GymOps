require("dotenv").config();

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const connectDB = require("./config/db");
const { attach: attachChatSocket } = require("./realtime/chatSocket");

const isProduction = process.env.NODE_ENV === "production";

const authRoutes = require("./routes/authRoutes");
const exerciseRoutes = require("./routes/exerciseRoutes");
const workoutRoutes = require("./routes/workoutRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const goalRoutes = require("./routes/goalRoutes");
const dailyStepsRoutes = require("./routes/dailyStepsRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const plannedWorkoutRoutes = require("./routes/plannedWorkoutRoutes");
const pushRoutes = require("./routes/pushRoutes");
const healthRoutes = require("./routes/healthRoutes");
const userRoutes = require("./routes/userRoutes");
const conversationRoutes = require("./routes/conversationRoutes");

const app = express();

if (isProduction) {
  app.set("trust proxy", 1);
}

connectDB();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

app.use(cors(isProduction ? { origin: process.env.CLIENT_URL } : {}));
app.use(express.json());

if (!isProduction) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });
}

app.get("/", (req, res) => {
  res.send("Repvyn Backend Running...");
});

app.use("/api/auth", authRoutes);
app.use("/api/exercises", exerciseRoutes);
app.use("/api/workouts", workoutRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/daily-steps", dailyStepsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/planned-workouts", plannedWorkoutRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: status === 400 ? "Malformed request body" : "Server Error",
  });
});

const PORT = process.env.PORT || 5000;

// Plain http.Server wrapping the Express app so the chat WebSocket upgrade
// (ws/chat) can share the same port — Express itself has no concept of
// WebSocket upgrades, but Node's underlying http.Server does.
const server = http.createServer(app);
attachChatSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});