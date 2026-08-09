import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

// Helper function to force clean String IDs
const cleanId = (val) => {
  if (!val) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object") return String(val._id || val.id || "").trim();
  return String(val).trim();
};

// @desc    Initiate Chat or Get Existing Conversation & Deduct Connect if New
// @route   POST /api/chat/start
export const startOrGetConversation = async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;

    // 1. Validate IDs presence
    if (!senderId || !receiverId) {
      return res.status(400).json({ 
        success: false, 
        message: "Sender and Receiver IDs required" 
      });
    }

    // 2. Validate MongoDB ObjectId Format
    if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid User ID format provided" 
      });
    }

    // 3. Prevent Self Chat
    if (senderId.toString() === receiverId.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: "You cannot chat with yourself" 
      });
    }

    // 4. Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId], $size: 2 },
    }).populate("participants", "firstName lastName profileImage connects basicInfo");

    if (conversation) {
      return res.status(200).json({
        success: true,
        isNew: false,
        conversation,
        message: "Existing conversation loaded",
      });
    }

    // 5. New Chat - Verify Sender & Connects
    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender user not found" });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ success: false, message: "Receiver user not found" });
    }

    const userConnects = sender.connects !== undefined ? sender.connects : 5;

    if (userConnects <= 0) {
      return res.status(403).json({
        success: false,
        insufficientConnects: true,
        message: "You have 0 connects left. Please purchase a package to start a new chat.",
      });
    }

    // 6. Create New Conversation
    conversation = await Conversation.create({
      participants: [senderId, receiverId],
    });

    conversation = await Conversation.findById(conversation._id).populate(
      "participants",
      "firstName lastName profileImage connects basicInfo"
    );

    // 7. Deduct 1 Connect safely
    const updatedSender = await User.findByIdAndUpdate(
      senderId,
      { $set: { connects: userConnects - 1 } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      isNew: true,
      conversation,
      remainingConnects: updatedSender.connects,
      message: "1 Connect deducted successfully. New chat started!",
    });
  } catch (error) {
    console.error("Start Chat Controller Error:", error);
    res.status(500).json({ success: false, message: error.message || "Server Error" });
  }
};

// @desc    Send Message & Real-time Socket Broadcast from Backend
// @route   POST /api/chat/send-message
// controllers/chatController.js ko replace karein sendMessage function ko

// Base64 data URL length cap (~8MB raw file, keeps the document safely under MongoDB's 16MB limit)
const MAX_FILE_DATA_URL_LENGTH = 12 * 1024 * 1024;

export const sendMessage = async (req, res) => {
  try {
    const { conversationId, senderId, receiverId, text, fileUrl, fileName, fileType, fileSize, fileDuration } = req.body;

    const trimmedText = (text || "").trim();
    const hasFile = !!fileUrl;

    if (!trimmedText && !hasFile) {
      return res.status(400).json({ success: false, message: "Message text or a file is required" });
    }

    if (hasFile && fileUrl.length > MAX_FILE_DATA_URL_LENGTH) {
      return res.status(400).json({ success: false, message: "File is too large. Please share a file under 8MB." });
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ success: false, message: "Invalid Conversation ID" });
    }

    // 1. Create Message in Database (This is already VERY FAST)
    let newMessage = await Message.create({
      conversationId,
      sender: senderId,
      receiver: receiverId,
      text: trimmedText,
      fileUrl: fileUrl || "",
      fileName: fileName || "",
      fileType: fileType || "",
      fileSize: fileSize || 0,
      fileDuration: fileDuration || 0,
    });

    // 2. Populate details
    newMessage = await Message.findById(newMessage._id)
      .populate("sender", "firstName lastName profileImage basicInfo")
      .populate("receiver", "firstName lastName profileImage basicInfo")
      .populate("conversationId");

    // 3. Update Last Message (Fast)
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: newMessage._id,
      updatedAt: new Date(),
    });

    // 🟢 4. BACKEND SOCKET BROADCAST (WRAP WITH OPTIONALITY FOR VERCEL)
    // Hum try-catch block handle kar rahy hain agar socket connection crash ho bhi jaye backend request fail na ho.
    try {
      const io = req.app.get("io");
      if (io) {
        const targetReceiverId = cleanId(receiverId);
        const targetConvId = cleanId(conversationId);

        console.log(`🚀 BACKEND EMIT (Optional) -> Receiver: [${targetReceiverId}] | Conv: [${targetConvId}]`);

        // Emit only if connection seems active
        if (targetReceiverId) {
          io.to(targetReceiverId).emit("receive_message", newMessage);
          io.to(targetReceiverId).emit("new_unread_message", newMessage);
        }

        if (targetConvId) {
          io.to(targetConvId).emit("receive_message", newMessage);
        }
      }
    } catch (socketError) {
      console.error("Non-critical Socket Broadcast Error:", socketError);
      // Backend api success response block nahi hona chahye.
    }

    // 🟢 5. RETURN SUCCESS FORAN (BINA DELAY)
    // Frontend isse optimistic logic handle karega.
    return res.status(200).json({ success: true, message: newMessage });

  } catch (error) {
    console.error("Send Message Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get All Messages for a Conversation
// @route   GET /api/chat/messages/:conversationId
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ success: false, message: "Invalid Conversation ID" });
    }

    const messages = await Message.find({ conversationId })
      .populate("sender", "firstName lastName profileImage basicInfo")
      .sort({ createdAt: 1 });

    res.status(200).json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all conversations for a specific user
// @route   GET /api/chat/conversations/:userId
export const getUserConversations = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid User ID" });
    }

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate("participants", "firstName lastName profileImage basicInfo")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Unread Messages for Logged-In User
// @route   GET /api/chat/unread/:userId
export const getUnreadMessages = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const unreadMessages = await Message.find({
      receiver: userId,
      isRead: false,
    })
      .populate("sender", "firstName lastName profileImage basicInfo")
      .populate("conversationId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: unreadMessages.length,
      unreadMessages,
    });
  } catch (error) {
    console.error("Get Unread Messages Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark Messages as Read when user opens chat window
// @route   PUT /api/chat/mark-read
export const markMessagesAsRead = async (req, res) => {
  try {
    const { conversationId, userId } = req.body;

    await Message.updateMany(
      { conversationId, receiver: userId, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({ success: true, message: "Messages marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};