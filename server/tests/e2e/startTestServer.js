const http = require("http");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

async function main() {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-not-for-production";
  process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "test-google-client-id";

  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGO_URI = replSet.getUri("repvyn_e2e");

  const mongoose = require("mongoose");
  await mongoose.connect(process.env.MONGO_URI);

  const app = require("../../app");
  const { attach: attachChatSocket } = require("../../realtime/chatSocket");
  const PORT = process.env.PORT || 5050;
  const server = http.createServer(app);
  attachChatSocket(server);
  server.listen(PORT, () => {
    console.log(`E2E test server listening on ${PORT} (isolated in-memory DB)`);
  });

  const shutdown = async () => {
    await mongoose.disconnect();
    await replSet.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Failed to start E2E test server:", error);
  process.exit(1);
});
