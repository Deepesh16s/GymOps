/* server/scripts/deduplicateExercises.js
   ----------------------------------------------------------------
   ONE-TIME MIGRATION — safe to run multiple times (idempotent).

   What it does:
   1. Backfills `normalizedName` (trim + lowercase of `name`) on every
      Exercise document, including ones created before that field
      existed.
   2. Groups exercises per user (createdBy) by normalizedName.
   3. For each group with more than one document, keeps the OLDEST
      (by createdAt, falling back to ObjectId timestamp) and deletes
      the rest.
   4. Before deleting a duplicate, repoints any Workout documents that
      reference it (Workout.exercise) to the kept exercise's _id, so
      no workout history is lost.
   5. Prints a per-user, per-exercise-name summary of what was
      deleted.

   Run with:
     node server/scripts/deduplicateExercises.js
   ---------------------------------------------------------------- */

require("dotenv").config();
const mongoose = require("mongoose");

const Exercise = require("../models/Exercise");
const Workout = require("../models/workout");

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL;

const normalize = (name) => (name || "").trim().toLowerCase();

/* Oldest-first comparator. Prefers createdAt (set by timestamps: true
   on the schema); falls back to the ObjectId's embedded timestamp for
   any document that somehow lacks createdAt. */
const olderFirst = (a, b) => {
  const aTime = a.createdAt
    ? new Date(a.createdAt).getTime()
    : a._id.getTimestamp().getTime();
  const bTime = b.createdAt
    ? new Date(b.createdAt).getTime()
    : b._id.getTimestamp().getTime();
  return aTime - bTime;
};

async function backfillNormalizedNames() {
  // Only touch docs missing normalizedName, or where it's stale
  // relative to the current `name` — cheap to just recompute for
  // every doc and only write the ones that actually changed.
  const exercises = await Exercise.find({}).select("name normalizedName");

  const ops = [];
  exercises.forEach((ex) => {
    const correct = normalize(ex.name);
    if (ex.normalizedName !== correct) {
      ops.push({
        updateOne: {
          filter: { _id: ex._id },
          update: { $set: { normalizedName: correct } },
        },
      });
    }
  });

  if (ops.length) {
    await Exercise.bulkWrite(ops);
  }

  console.log(
    `Backfilled normalizedName on ${ops.length} exercise document(s).`
  );
}

async function deduplicateExercises() {
  const exercises = await Exercise.find({}).lean();

  // Group key: createdBy (stringified, "null" if missing) + normalizedName
  const groups = new Map();

  exercises.forEach((ex) => {
    const createdByKey = ex.createdBy ? String(ex.createdBy) : "null";
    const normalizedName = ex.normalizedName || normalize(ex.name);
    const key = `${createdByKey}::${normalizedName}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ex);
  });

  let totalDuplicatesDeleted = 0;
  let totalWorkoutsRepointed = 0;

  for (const [key, docs] of groups.entries()) {
    if (docs.length < 2) continue; // no duplicates in this group

    const [createdByKey, normalizedName] = key.split("::");

    // Oldest doc survives; everything else is a duplicate to remove.
    const sorted = [...docs].sort(olderFirst);
    const kept = sorted[0];
    const duplicates = sorted.slice(1);
    const duplicateIds = duplicates.map((d) => d._id);

    // ── Repoint any workouts referencing a duplicate to the kept doc ──
    const repointResult = await Workout.updateMany(
      { exercise: { $in: duplicateIds } },
      { $set: { exercise: kept._id } }
    );

    // ── Delete the duplicate exercise documents ──
    await Exercise.deleteMany({ _id: { $in: duplicateIds } });

    totalDuplicatesDeleted += duplicateIds.length;
    totalWorkoutsRepointed += repointResult.modifiedCount || 0;

    console.log(
      `userId=${createdByKey === "null" ? "(none/default)" : createdByKey}  ` +
        `exercise="${kept.name}"  ` +
        `deletedIdsCount=${duplicateIds.length}  ` +
        `workoutsRepointed=${repointResult.modifiedCount || 0}`
    );
  }

  console.log("----------------------------------------------------");
  console.log(`Total duplicate exercises deleted: ${totalDuplicatesDeleted}`);
  console.log(`Total workouts repointed: ${totalWorkoutsRepointed}`);
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

    console.log("Step 1: Backfilling normalizedName...");
    await backfillNormalizedNames();

    console.log("Step 2: Deduplicating exercises...");
    await deduplicateExercises();

    console.log("Migration complete.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();