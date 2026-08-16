require("dotenv").config();
const mongoose = require("mongoose");
const Exercise = require("../models/Exercise");

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL;

const RECLASSIFY = {
  Quads: [
    "Squat",
    "Front Squat",
    "Hack Squat",
    "Leg Press",
    "Leg Extension",
    "Lunges",
    "Bulgarian Split Squat",
    "Adductor Machine",
  ],
  Glutes: ["Hip Thrust", "Cable Kickback", "Abductor Machine"],
  Hamstrings: ["Leg Curl", "Lying Leg Curl", "Seated Leg Curl", "Romanian Deadlift", "Nordic Curl"],
  Calves: ["Calf Raise", "Seated Calf Raise"],
};

async function reclassify() {
  let totalUpdated = 0;

  for (const [newGroup, names] of Object.entries(RECLASSIFY)) {
    const result = await Exercise.updateMany(
      { muscleGroup: "Legs", name: { $in: names } },
      { $set: { muscleGroup: newGroup } }
    );
    console.log(
      `${newGroup}: matched ${result.matchedCount}, updated ${result.modifiedCount}`
    );
    totalUpdated += result.modifiedCount || 0;
  }

  console.log("----------------------------------------------------");
  console.log(`Total exercises reclassified: ${totalUpdated}`);
}

async function run() {
  if (!MONGO_URI) {
    console.error("No MongoDB connection string found.");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB.");
    await reclassify();
    console.log("Migration complete.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
