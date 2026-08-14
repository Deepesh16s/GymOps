const express = require("express");
const router = express.Router();

const {
  listConversations,
  createConversation,
  getConversation,
  getMessages,
  sendMessage,
  markRead,
  deleteMessage,
} = require("../controllers/conversationController");

const { protect } = require("../middleware/authMiddleware");
const { sendMessageLimiter, createConversationLimiter } = require("../middleware/chatRateLimiters");

router.use(protect);

router.get("/", listConversations);
router.post("/", createConversationLimiter, createConversation);
router.get("/:id", getConversation);
router.get("/:id/messages", getMessages);
router.post("/:id/messages", sendMessageLimiter, sendMessage);
router.put("/:id/read", markRead);
router.delete("/:conversationId/messages/:messageId", deleteMessage);

module.exports = router;
