require("dotenv").config();
const mongoose = require("mongoose");
const Goal = require("../models/Goal");
const { GOAL_TYPES } = require("../constants/goalTypes");

const BATCH_SIZE = 500;
const isDryRun = process.argv.includes("--dry-run");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const filter = {
    type: GOAL_TYPES.WEIGHT,
    direction: { $exists: false },
  };

  const totalCandidates = await Goal.countDocuments(filter);
  console.log(`Found ${totalCandidates} Weight Goal document(s) without a direction field.`);

  if (isDryRun) {
    const sample = await Goal.find(filter).limit(10).select("_id user current target status createdAt");
    console.log("Dry run — no changes made. Sample of affected documents:");
    sample.forEach((g) =>
      console.log(
        `  ${g._id} user=${g.user} current=${g.current} target=${g.target} status=${g.status} createdAt=${g.createdAt.toISOString()}`
      )
    );
    if (totalCandidates > sample.length) console.log(`  ...and ${totalCandidates - sample.length} more`);
    await mongoose.disconnect();
    return;
  }

  let migrated = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await Goal.find(filter).select("_id").limit(BATCH_SIZE);
    if (batch.length === 0) break;

    await Goal.updateMany(
      { _id: { $in: batch.map((g) => g._id) } },
      { $set: { direction: "gain", startingValue: null } }
    );
    migrated += batch.length;
  }

  console.log(`Migration complete. Migrated: ${migrated}. Status field left untouched for all of them.`);
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error("Migration script failed:", error);
  process.exit(1);
});
