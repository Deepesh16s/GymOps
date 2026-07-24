require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const exerciseRoutes = require("./routes/exerciseRoutes");
const workoutRoutes = require("./routes/workoutRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const goalRoutes = require("./routes/goalRoutes");
const dailyStepsRoutes = require("./routes/dailyStepsRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const plannedWorkoutRoutes = require("./routes/plannedWorkoutRoutes");

const app = express();

connectDB();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("GymOps Backend Running...");
});

app.use("/api/auth", authRoutes);
app.use("/api/exercises", exerciseRoutes);
app.use("/api/workouts", workoutRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/daily-steps", dailyStepsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/planned-workouts", plannedWorkoutRoutes);

// Fallback-only: only reached when no route above has already handled
// the request. Cannot alter the behavior of any existing endpoint.
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Fallback-only: only reached via next(err), which no existing
// controller calls (each handles and responds to its own errors).
// Exists solely as a safety net for a genuinely unhandled exception.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error(err);
  res.status(500).json({ message: "Server Error" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});