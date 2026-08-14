const Activity = require("../models/Activity");

async function recordActivity(userId, { type, title, subtitle = null, metadata = null, refId = null }) {
  return Activity.create({ user: userId, type, title, subtitle, metadata, refId });
}

module.exports = { recordActivity };
