require("dotenv").config();
const mongoose = require("mongoose");

const User = require("../models/User");
const Exercise = require("../models/Exercise");
const defaultExercises = require("../data/defaultExercises");

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL;

const normalize = (name) => (name || "").trim().toLowerCase();

async function backfillForAllUsers() {
  const users = await User.find({}).select("_id email");
  console.log(`Found ${users.length} user(s).`);

  let totalInserted = 0;

  for (const user of users) {
    const existing = await Exercise.find({ createdBy: user._id }).select(
      "normalizedName name"
    );
    const existingNames = new Set(
      existing.map((e) => e.normalizedName || normalize(e.name))
    );

    const missing = defaultExercises.filter(
      (d) => !existingNames.has(normalize(d.name))
    );

    if (missing.length === 0) {
      console.log(`${user.email}: already has all ${defaultExercises.length} default exercises.`);
      continue;
    }

    try {
      await Exercise.insertMany(
        missing.map((exercise) => ({
          ...exercise,
          createdBy: user._id,
          isDefault: true,
        })),
        { ordered: false }
      );
    } catch (error) {
      if (error.code !== 11000 && error.code !== "E11000") {
        throw error;
      }
    }

    console.log(
      `${user.email}: added ${missing.length} missing exercise(s) -> ${missing.map((m) => m.name).join(", ")}`
    );
    totalInserted += missing.length;
  }

  console.log("----------------------------------------------------");
  console.log(`Total exercises inserted across all users: ${totalInserted}`);
}

async function run() {
  if (!MONGO_URI) {
    console.error("No MongoDB connection string found.");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB.");
    await backfillForAllUsers();
    console.log("Backfill complete.");
  } catch (error) {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();