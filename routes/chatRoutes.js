import express from "express";
import { 
  startOrGetConversation, 
  sendMessage, 
  getMessages, 
  getUserConversations,
  getUnreadMessages,
  markMessagesAsRead
} from "../controllers/chatController.js";

const router = express.Router();

router.post("/start", startOrGetConversation);
router.post("/send-message", sendMessage);
router.get("/messages/:conversationId", getMessages);
router.get("/conversations/:userId", getUserConversations);
router.get("/unread/:userId", getUnreadMessages);       // 👈 Unread messages count/list API
router.put("/mark-read", markMessagesAsRead);           // 👈 Mark read API

export default router;