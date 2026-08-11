require("dotenv").config();
const mongoose = require("mongoose");
const Exercise = require("../models/Exercise");

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL;

const RECLASSIFY = {
  Biceps: ["Bicep Curl", "Incline DB Curl", "Hammer Curl", "Preacher Curl", "Concentration Curl", "Cable Curl", "Spider Curl", "EZ Bar Curl"],
  Triceps: ["Tricep Pushdown", "Rope Pushdown", "Overhead Extension", "Overhead Cable Extension", "Skull Crusher", "Close Grip Bench Press", "Tricep Kickback", "Diamond Push Up"],
};

async function reclassify() {
  let totalUpdated = 0;

  for (const [newGroup, names] of Object.entries(RECLASSIFY)) {
    const result = await Exercise.updateMany(
      { muscleGroup: "Arms", name: { $in: names } },
      { $set: { muscleGroup: newGroup } }
    );
    console.log(
      `${newGroup}: matched ${result.matchedCount}, updated ${result.modifiedCount}`
    );
    totalUpdated += result.modifiedCount || 0;
  }

  const remaining = await Exercise.countDocuments({ muscleGroup: "Arms" });
  console.log("----------------------------------------------------");
  console.log(`Total exercises reclassified: ${totalUpdated}`);
  console.log(`Remaining exercises still tagged "Arms": ${remaining}`);
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
