require("dotenv").config();
const mongoose = require("mongoose");
const Exercise = require("../models/Exercise");

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL;

const normalize = (name) => (name || "").trim().toLowerCase();

async function migrate() {
  const goalsCollection = mongoose.connection.collection("goals");
  const goals = await goalsCollection
    .find({ type: "Strength PR" })
    .toArray();

  let converted = 0;
  let alreadyDone = 0;
  let skipped = 0;

  for (const goal of goals) {
    const raw = goal.exercise;

    if (raw && raw._bsontype === "ObjectID") {
      alreadyDone++;
      continue;
    }

    if (!raw || typeof raw !== "string" || !raw.trim()) {
      skipped++;
      continue;
    }

    const normalizedName = normalize(raw);

    const exerciseDoc = await Exercise.findOne({
      normalizedName,
      createdBy: goal.user,
    });

    if (!exerciseDoc) {
      console.log(
        `No matching exercise for goal "${goal.title}" (typed="${raw}") — left as-is.`
      );
      skipped++;
      continue;
    }

    await goalsCollection.updateOne(
      { _id: goal._id },
      { $set: { exercise: exerciseDoc._id } }
    );

    converted++;
    console.log(
      `Converted goal "${goal.title}" -> exercise "${exerciseDoc.name}" (${exerciseDoc._id})`
    );
  }

  console.log("----------------------------------------------------");
  console.log(
    `Converted: ${converted}  Already migrated: ${alreadyDone}  Skipped/unmatched: ${skipped}`
  );
}

async function run() {
  if (!MONGO_URI) {
    console.error("No MongoDB connection string found.");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB.");
    await migrate();
    console.log("Migration complete.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();