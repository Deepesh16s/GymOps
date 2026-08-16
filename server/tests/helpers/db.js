const mongoose = require("mongoose");

let connected = false;

async function connectTestDB() {
  if (connected) return;
  await mongoose.connect(process.env.MONGO_URI);
  connected = true;
}

async function clearTestDB() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

async function disconnectTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  connected = false;
}

module.exports = { connectTestDB, clearTestDB, disconnectTestDB };
