const Follow = require("../models/Follow");

async function canViewContent(profileUser, viewerId) {
  if (viewerId && String(viewerId) === String(profileUser._id)) return true;
  if (profileUser.profileVisibility === "public") return true;
  if (!viewerId) return false;
  return !!(await Follow.exists({ follower: viewerId, following: profileUser._id }));
}

module.exports = { canViewContent };
