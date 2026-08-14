require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const { assignGeneratedUsername } = require("../utils/username");

const BATCH_SIZE = 500;

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  let migrated = 0;
  let failed = 0;

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
