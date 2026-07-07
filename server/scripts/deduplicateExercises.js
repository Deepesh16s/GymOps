require("dotenv").config();
const mongoose = require("mongoose");

const Exercise = require("../models/Exercise");
const Workout = require("../models/workout");

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL;

const normalize = (name) => (name || "").trim().toLowerCase();

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
    if (docs.length < 2) continue;

    const [createdByKey] = key.split("::");

    const sorted = [...docs].sort(olderFirst);
    const kept = sorted[0];
    const duplicates = sorted.slice(1);
    const duplicateIds = duplicates.map((d) => d._id);

    const repointResult = await Workout.updateMany(
      { exercise: { $in: duplicateIds } },
      { $set: { exercise: kept._id } }
    );

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
    console.error("No MongoDB connection string found.");
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