import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

dotenv.config();

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors({ origin: "*", credentials: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// 🟢 CRUCIAL: Attach Socket.io instance to Express app
app.set("io", io);

// Helper to extract clean String ID from any Object/String format
const parseCleanId = (val) => {
  if (!val) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object") {
    return String(val._id || val.id || val.user?._id || val.user?.id || "").trim();
  }
  return String(val).trim();
};

// 💬 Socket.io Handlers
io.on("connection", (socket) => {
  console.log("⚡ User connected to Socket:", socket.id);

  socket.on("join_user", (userId) => {
    const cleanUserId = parseCleanId(userId);
    if (cleanUserId) {
      socket.join(cleanUserId);
      console.log(`👤 Socket [${socket.id}] joined user room: [${cleanUserId}]`);
    }
  });

  socket.on("join_conversation", (conversationId) => {
    const cleanConvId = parseCleanId(conversationId);
    if (cleanConvId) {
      socket.join(cleanConvId);
      console.log(`💬 Socket [${socket.id}] joined conv room: [${cleanConvId}]`);
    }
  });

  socket.on("send_message", (messageData) => {
    const convId = parseCleanId(messageData.conversationId);
    const receiverId = parseCleanId(messageData.receiverId || messageData.receiver);
    const senderId = parseCleanId(messageData.senderId || messageData.sender);

    console.log(`🚀 REALTIME EMIT -> Sender:[${senderId}] | Receiver:[${receiverId}] | Conv:[${convId}]`);

    // Broadcast to Conversation Room (Active Chat)
    if (convId) {
      io.to(convId).emit("receive_message", messageData);
    }

    // Direct Broadcast to Receiver's Personal Room
    if (receiverId) {
      io.to(receiverId).emit("receive_message", messageData);
      io.to(receiverId).emit("new_unread_message", messageData);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket Disconnected:", socket.id);
  });
});

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({ message: "Database connection failed" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/chat", chatRoutes);

app.get("/", (req, res) => {
  res.send("Rishta Point API Running...");
});

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

export default app;