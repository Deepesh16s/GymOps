require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const BATCH_SIZE = 500;

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  let migrated = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await User.find({ profileVisibility: { $exists: false } })
      .select("_id")
      .limit(BATCH_SIZE);
    if (batch.length === 0) break;

    await User.updateMany(
      { _id: { $in: batch.map((u) => u._id) } },
      { $set: { profileVisibility: "private", showTrainingActivity: false } }
    );
    migrated += batch.length;
  }

  console.log(`Migration complete. Migrated: ${migrated}`);
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error("Migration script failed:", error);
  process.exit(1);
});
