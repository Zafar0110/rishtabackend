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
  // TEMPORARY performance diagnostics — remove once the slow-API cause is confirmed
  const requestStart = Date.now();
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
    const existingCheckStart = Date.now();
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId], $size: 2 },
    }).populate("participants", "firstName lastName profileImage connects basicInfo");
    console.error(`[TIMING] startChat - existing-conversation check: ${Date.now() - existingCheckStart}ms`);

    if (conversation) {
      console.error(`[TIMING] startChat (existing) - TOTAL: ${Date.now() - requestStart}ms`);
      return res.status(200).json({
        success: true,
        isNew: false,
        conversation,
        message: "Existing conversation loaded",
      });
    }

    // 5. New Chat - Verify Sender & Connects. Fetch both users concurrently
    // instead of sequentially — they don't depend on each other.
    const usersStart = Date.now();
    const [sender, receiver] = await Promise.all([
      User.findById(senderId),
      User.findById(receiverId),
    ]);
    console.error(`[TIMING] startChat - parallel sender+receiver lookup: ${Date.now() - usersStart}ms`);

    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender user not found" });
    }
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

    // 6. Create the conversation and deduct the connect concurrently — these
    // are independent writes, no need to wait for one before the other.
    const writeStart = Date.now();
    const [newConversation] = await Promise.all([
      Conversation.create({ participants: [senderId, receiverId] }),
      User.updateOne({ _id: senderId }, { $set: { connects: userConnects - 1 } }),
    ]);
    console.error(`[TIMING] startChat - parallel create+deduct: ${Date.now() - writeStart}ms`);

    // Build the populated shape from data already in memory (sender/receiver
    // docs fetched above) instead of an extra findById().populate() round-trip.
    const pickParticipant = (u) => ({
      _id: u._id,
      firstName: u.firstName,
      lastName: u.lastName,
      profileImage: u.profileImage,
      connects: u._id.toString() === senderId.toString() ? userConnects - 1 : u.connects,
      basicInfo: u.basicInfo,
    });

    conversation = {
      _id: newConversation._id,
      participants: [pickParticipant(sender), pickParticipant(receiver)],
      createdAt: newConversation.createdAt,
      updatedAt: newConversation.updatedAt,
    };

    console.error(`[TIMING] startChat (new) - TOTAL: ${Date.now() - requestStart}ms`);
    res.status(200).json({
      success: true,
      isNew: true,
      conversation,
      remainingConnects: userConnects - 1,
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
  // TEMPORARY performance diagnostics — remove once the slow-API cause is confirmed
  const requestStart = Date.now();
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

    console.error(`[TIMING] sendMessage - payload size: ${JSON.stringify(req.body).length} bytes`);

    // 1. Create Message in Database — the only DB round-trip on the response's
    // critical path. sender/receiver/conversationId are stored exactly as sent
    // (plain ObjectIds, which serialize to hex strings over JSON/socket) — no
    // re-fetch/populate needed, since the frontend only ever reads the raw
    // sender ID for left/right bubble alignment, never a populated name/avatar
    // on a per-message basis. Each populate() here used to cost a full extra
    // network round-trip to the database.
    const createStart = Date.now();
    const newMessage = await Message.create({
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
    console.error(`[TIMING] sendMessage - Message.create: ${Date.now() - createStart}ms`);

    // 2. Update the conversation's lastMessage in the background — intentionally
    // not awaited, since it's not needed for the sender's own response (they
    // already have the message) and shouldn't add another round-trip of latency
    // to every send.
    Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: newMessage._id,
      updatedAt: new Date(),
    }).catch((err) => console.error("Background lastMessage update failed:", err));

    // 3. Real-time socket broadcast (best-effort, never blocks the response)
    try {
      const io = req.app.get("io");
      if (io) {
        const targetReceiverId = cleanId(receiverId);
        const targetConvId = cleanId(conversationId);

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

    // 4. Respond immediately — frontend handles this optimistically
    console.error(`[TIMING] sendMessage - TOTAL handler time: ${Date.now() - requestStart}ms`);
    return res.status(200).json({ success: true, message: newMessage });

  } catch (error) {
    console.error("Send Message Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get All Messages for a Conversation
// @route   GET /api/chat/messages/:conversationId
export const getMessages = async (req, res) => {
  // TEMPORARY performance diagnostics — remove once the slow-API cause is confirmed
  const requestStart = Date.now();
  try {
    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ success: false, message: "Invalid Conversation ID" });
    }

    // No populate — the frontend only reads the raw sender ID per-message
    // (for left/right alignment), never a populated name/avatar. .lean()
    // skips document hydration since these are read-only.
    //
    // fileUrl (the base64 attachment blob) is deliberately EXCLUDED here: a
    // thread of only 7-21 messages was measured at 1.3-1.9s on production
    // purely because every attachment's full binary was dragged along. The
    // remaining file metadata (name/type/size/duration) is enough to render
    // the bubble immediately; the blob itself is fetched on demand per
    // attachment via GET /api/chat/attachment/:messageId.
    const messages = await Message.find({ conversationId })
      .select("-fileUrl")
      .sort({ createdAt: 1 })
      .lean();

    // Flag which messages have an attachment to lazy-load, without shipping it.
    const withFlags = messages.map((m) => ({
      ...m,
      hasAttachment: !!m.fileName || !!m.fileType,
    }));

    console.error(`[TIMING] getMessages - query (${messages.length} msgs): ${Date.now() - requestStart}ms`);
    res.status(200).json({ success: true, messages: withFlags });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Fetch a single message's attachment blob (lazy-loaded by the client)
// @route   GET /api/chat/attachment/:messageId
export const getMessageAttachment = async (req, res) => {
  const requestStart = Date.now();
  try {
    const { messageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ success: false, message: "Invalid Message ID" });
    }

    const message = await Message.findById(messageId)
      .select("fileUrl fileName fileType fileSize fileDuration")
      .lean();

    if (!message || !message.fileUrl) {
      return res.status(404).json({ success: false, message: "Attachment not found" });
    }

    console.error(`[TIMING] getMessageAttachment - ${Date.now() - requestStart}ms`);
    res.status(200).json({ success: true, attachment: message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all conversations for a specific user
// @route   GET /api/chat/conversations/:userId
export const getUserConversations = async (req, res) => {
  // TEMPORARY performance diagnostics — remove once the slow-API cause is confirmed
  const requestStart = Date.now();
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid User ID" });
    }

    // Both populates are field-limited so no base64 blobs ride along:
    //  - participants: only the avatar/name fields the inbox actually renders
    //    (basicInfo.featuredImage + gender), NOT the whole basicInfo object
    //    with its gallery array.
    //  - lastMessage: only what the preview line shows — excludes fileUrl.
    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate("participants", "firstName lastName profileImage basicInfo.featuredImage basicInfo.gender")
      .populate("lastMessage", "text fileName fileType createdAt sender")
      .sort({ updatedAt: -1 })
      .lean();

    console.error(`[TIMING] getUserConversations - query (${conversations.length} convs): ${Date.now() - requestStart}ms`);
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