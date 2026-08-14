const Block = require("../models/Block");

async function isBlockedEitherWay(userIdA, userIdB) {
  const blocked = await Block.exists({
    $or: [
      { blocker: userIdA, blocked: userIdB },
      { blocker: userIdB, blocked: userIdA },
    ],
  });
  return !!blocked;
}

module.exports = { isBlockedEitherWay };
