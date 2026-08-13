// One-off, idempotent migration: assigns a generated username to every
// existing User document that doesn't have one yet. Safe to run more than
// once — already-migrated users are excluded by the query itself, and
// assignGeneratedUsername() never overwrites an existing username.
//
// This is a best-effort convenience, not a hard requirement: the lazy
// fallback in loginUser/googleLogin (server/controllers/authController.js)
// assigns a username inline for any user this script misses, the next time
// they log in. Run this to make the rollout immediate for inactive users
// rather than waiting for their next login.
//
// Usage: node server/scripts/migrateUsernames.js
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const { assignGeneratedUsername } = require("../utils/username");

const BATCH_SIZE = 500;

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  let migrated = 0;
  let failed = 0;

  // Re-queried each iteration rather than paginated with skip/limit, since
  // migrating a document removes it from this same query's result set —
  // skip/limit would otherwise skip over users as the "missing username"
  // set shrinks out from under it.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await User.find({ username: { $exists: false } }).limit(BATCH_SIZE);
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
