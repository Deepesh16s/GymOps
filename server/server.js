require("dotenv").config();

const express = require("express");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes"); // NEW
const exerciseRoutes = require("./routes/exerciseroutes");
const workoutRoutes = require("./routes/workoutroutes");

const app = express();

connectDB();

app.use(express.json()); // NEW MIDDLEWARE

app.get("/", (req, res) => {
  res.send("GymOps Backend Running...");
});

app.use("/api/auth", authRoutes); // NEW ROUTE
app.use("/api/exercises", exerciseRoutes);
app.use("/api/workouts", workoutRoutes);
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});