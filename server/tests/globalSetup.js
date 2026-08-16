const { MongoMemoryReplSet } = require("mongodb-memory-server");

module.exports = async function setup() {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-not-for-production-use";
  process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "test-google-client-id";

  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGO_URI = replSet.getUri("repvyn_test");

  return async function teardown() {
    await replSet.stop();
  };
};
