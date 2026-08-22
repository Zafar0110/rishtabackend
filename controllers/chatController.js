import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

 
const cleanId = (val) => {
  if (!val) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object") return String(val._id || val.id || "").trim();
  return String(val).trim();
};

// @desc    Initiate Chat or Get Existing Conversation & Deduct Connect if New
// @route   POST /api/chat/start
export const startOrGetConversation = async (req, res) => {
   
  const requestStart = Date.now();
  try {
    const { senderId, receiverId } = req.body;

    
    if (!senderId || !receiverId) {
      return res.status(400).json({
        success: false,
        message: "Sender and Receiver IDs required"
      });
    }

     
    if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid User ID format provided"
      });
    }

     
    if (senderId.toString() === receiverId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot chat with yourself"
      });
    }

    
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

    
    const writeStart = Date.now();
    const newConversation = await Conversation.create({
      participants: [senderId, receiverId],
      initiator: senderId,
      connectCharged: false,
    });
    console.error(`[TIMING] startChat - conversation create: ${Date.now() - writeStart}ms`);

    
    const pickParticipant = (u) => ({
      _id: u._id,
      firstName: u.firstName,
      lastName: u.lastName,
      profileImage: u.profileImage,
      connects: u.connects,
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
      remainingConnects: userConnects,
      message: "New chat started! 1 connect will be used when you send your first message.",
    });
  } catch (error) {
    console.error("Start Chat Controller Error:", error);
    res.status(500).json({ success: false, message: error.message || "Server Error" });
  }
};

// @desc    Send Message & Real-time Socket Broadcast from Backend
// @route   POST /api/chat/send-message
 
const MAX_FILE_DATA_URL_LENGTH = 12 * 1024 * 1024;

export const sendMessage = async (req, res) => {
  
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

     
    let connectCharged = false;
    let remainingConnects;

    const chargeStart = Date.now();
    const claimed = await Conversation.findOneAndUpdate(
      { _id: conversationId, initiator: senderId, connectCharged: false },
      { $set: { connectCharged: true } }
    );

    if (claimed) {
      
      const releaseClaim = () =>
        Conversation.updateOne({ _id: conversationId }, { $set: { connectCharged: false } });

      let deducted;
      try {
         
        deducted = await User.findOneAndUpdate(
          {
            _id: senderId,
            $or: [{ connects: { $gt: 0 } }, { connects: { $exists: false } }, { connects: null }],
          },
          [{ $set: { connects: { $subtract: [{ $ifNull: ["$connects", 5] }, 1] } } }],
          { new: true, updatePipeline: true }
        ).select("connects");
      } catch (chargeError) {
        await releaseClaim().catch(() => {});
        throw chargeError;
      }

      if (!deducted) { 
        await releaseClaim();
        return res.status(403).json({
          success: false,
          insufficientConnects: true,
          message: "You have 0 connects left. Please purchase a package to send your first message.",
        });
      }

      connectCharged = true;
      remainingConnects = deducted.connects;
      console.error(`[TIMING] sendMessage - connect charge: ${Date.now() - chargeStart}ms`);
    }

    
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

    
    Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: newMessage._id,
      updatedAt: new Date(),
    }).catch((err) => console.error("Background lastMessage update failed:", err));

    
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
      
    }

     
    console.error(`[TIMING] sendMessage - TOTAL handler time: ${Date.now() - requestStart}ms`);
    return res.status(200).json({
      success: true,
      message: newMessage,
      connectCharged,
      ...(connectCharged && { remainingConnects }),
    });

  } catch (error) {
    console.error("Send Message Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get All Messages for a Conversation
// @route   GET /api/chat/messages/:conversationId
export const getMessages = async (req, res) => {
  
  const requestStart = Date.now();
  try {
    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ success: false, message: "Invalid Conversation ID" });
    }

     
    const messages = await Message.find({ conversationId })
      .select("-fileUrl")
      .sort({ createdAt: 1 })
      .lean();

    
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
  
  const requestStart = Date.now();
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid User ID" });
    }

    
    const conversations = await Conversation.aggregate([
      { $match: { participants: new mongoose.Types.ObjectId(userId) } },
      { $sort: { updatedAt: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "participants",
          foreignField: "_id",
          as: "participants",
          pipeline: [
            {
              $project: {
                firstName: 1,
                lastName: 1,
                profileImage: 1,
                "basicInfo.featuredImage": 1,
                "basicInfo.gender": 1,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "messages",
          localField: "lastMessage",
          foreignField: "_id",
          as: "lastMessage",
          pipeline: [
            { $project: { text: 1, fileName: 1, fileType: 1, createdAt: 1, sender: 1 } },
          ],
        },
      },
      
      { $addFields: { lastMessage: { $arrayElemAt: ["$lastMessage", 0] } } },
    ]);

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
      .select("text fileName fileType createdAt sender conversationId")
      .populate("sender", "firstName lastName basicInfo.featuredImage basicInfo.gender")
      .sort({ createdAt: -1 })
      .lean();

    const payload = unreadMessages.map((m) => {
      const s = m.sender || {};
      const featured = s.basicInfo?.featuredImage;
      return {
        ...m,
        sender: {
          _id: s._id,
          firstName: s.firstName || "",
          lastName: s.lastName || "",
          gender: s.basicInfo?.gender || "",
          hasAvatar: !!(featured && String(featured).trim() !== ""),
        },
      };
    });

    res.status(200).json({
      success: true,
      count: payload.length,
      unreadMessages: payload,
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