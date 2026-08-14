require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Follow = require("../models/Follow");
const FollowRequest = require("../models/FollowRequest");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const follows = await Follow.find({});
  let converted = 0;
  let kept = 0;

  for (const follow of follows) {
    const target = await User.findById(follow.following).select("profileVisibility");
    if (!target) continue;

    const visibility = target.profileVisibility || "private";
    if (visibility !== "private") {
      kept += 1;
      continue;
    }

    const reverseExists = await Follow.exists({
      follower: follow.following,
      following: follow.follower,
    });
    if (reverseExists) {
      kept += 1;
      continue;
    }

    try {
      await FollowRequest.create({ requester: follow.follower, target: follow.following });
      await Follow.deleteOne({ _id: follow._id });
      converted += 1;
    } catch (error) {
      if (error.code !== 11000 && error.code !== "E11000") throw error;
    }
  }

  console.log(`Migration complete. Converted to requests: ${converted}, Kept as follows: ${kept}`);
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error("Migration script failed:", error);
  process.exit(1);
});
