require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
require("../models/workout");
require("../models/Exercise");
require("../models/Badge");
require("../models/Notification");
require("../models/Activity");
const { evaluateBadges } = require("../utils/badges");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const users = await User.find({}).select("_id");
  let usersAwarded = 0;
  let badgesAwarded = 0;

  for (const user of users) {
    const newlyEarned = await evaluateBadges(user._id);
    if (newlyEarned.length > 0) {
      usersAwarded += 1;
      badgesAwarded += newlyEarned.length;
    }
  }

  console.log(
    `Badge backfill complete. Users newly awarded: ${usersAwarded}, badges awarded: ${badgesAwarded}`
  );
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error("Badge backfill script failed:", error);
  process.exit(1);
});
