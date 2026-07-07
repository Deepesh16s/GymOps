/* server/scripts/migrateGoalExerciseRefs.js
   ----------------------------------------------------------------
   ONE-TIME MIGRATION — safe to run multiple times (idempotent).

   Converts existing "Strength PR" Goal documents' `exercise` field
   from a free-typed string (e.g. "Bench Press") to the matching
   Exercise document's ObjectId — required after the Goal.exercise
   schema change from String -> ObjectId ref.

   Uses the raw MongoDB driver (not the Mongoose Goal model) so this
   is safe to run whether the schema file has been swapped yet or not.

   Run with:
     node server/scripts/migrateGoalExerciseRefs.js
   ---------------------------------------------------------------- */

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

    // Already an ObjectId — nothing to do
    if (raw && raw._bsontype === "ObjectID") {
      alreadyDone++;
      continue;
    }

    // Empty / missing exercise on a Strength PR goal — nothing to convert
    if (!raw || typeof raw !== "string" || !raw.trim()) {
      skipped++;
      continue;
    }

    const normalizedName = normalize(raw);

    const exerciseDoc = await Exercise.findOne({
      normalizedName,
      $or: [{ isDefault: true }, { createdBy: goal.user }],
    });

    if (!exerciseDoc) {
      console.log(
        `No matching exercise for goal "${goal.title}" (typed="${raw}") — left as-is, please check/fix manually in the Goals UI.`
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
    console.error(
      "No MongoDB connection string found. Set MONGO_URI (or MONGODB_URI / DATABASE_URL) in your environment."
    );
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