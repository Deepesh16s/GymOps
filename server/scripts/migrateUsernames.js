require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const { assignGeneratedUsername, generateBaseUsername, isAvailable } = require("../utils/username");

const BATCH_SIZE = 500;
const isDryRun = process.argv.includes("--dry-run");

async function previewFor(user) {
  const base = generateBaseUsername(user.email, user._id);
  let candidate = base;
  let suffix = 0;
  while (!(await isAvailable(candidate))) {
    suffix += 1;
    candidate = `${base}${suffix}`.slice(0, 20);
  }
  return candidate;
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const filter = { username: { $exists: false } };
  const totalCandidates = await User.countDocuments(filter);
  console.log(`Found ${totalCandidates} user(s) with no username field at all.`);

  if (totalCandidates === 0) {
    console.log("Nothing to migrate.");
    await mongoose.disconnect();
    return;
  }

  if (isDryRun) {
    console.log("Dry run — no changes will be made.\n");
    const candidates = await User.find(filter).select("_id email createdAt");
    const seenThisRun = new Set();
    let malformed = 0;

    for (const user of candidates) {
      const hasUsableEmail = typeof user.email === "string" && user.email.includes("@");
      if (!hasUsableEmail) malformed += 1;

      let proposed = await previewFor(user);
      while (seenThisRun.has(proposed)) {
        proposed = `${proposed}${Math.floor(Math.random() * 10)}`.slice(0, 20);
      }
      seenThisRun.add(proposed);

      console.log(
        `  ${user._id}  email=${user.email || "(none)"}  createdAt=${user.createdAt?.toISOString() || "?"}  -> would become @${proposed}`
      );
    }

    console.log(`\n${malformed} record(s) have no usable email and would fall back to a generic "userNNNNNN" name.`);
    console.log("Re-run without --dry-run to apply.");
    await mongoose.disconnect();
    return;
  }

  let migrated = 0;
  let failed = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await User.find(filter).limit(BATCH_SIZE);
    if (batch.length === 0) break;

    for (const user of batch) {
      try {
        await assignGeneratedUsername(user);
        migrated += 1;
      } catch (error) {
        failed += 1;
        console.error(`Failed to assign username for user ${user._id}:`, error.message);
      }
    }
  }

  console.log(`Migration complete. Migrated: ${migrated}, Failed: ${failed}`);
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error("Migration script failed:", error);
  process.exit(1);
});
