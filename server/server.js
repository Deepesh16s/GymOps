require("dotenv").config();

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const http = require("http");
const connectDB = require("./config/db");
const { attach: attachChatSocket } = require("./realtime/chatSocket");
const app = require("./app");

connectDB();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
attachChatSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
