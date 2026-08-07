import express from "express";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

dotenv.config();

const app = express();
const ALLOWED_ORIGIN = "https://rishtapoin-front.vercel.app";

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// 1. Express Level CORS Setup
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// 2. Database Middleware
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection failure:", error);
    return res.status(500).json({ success: false, message: "DB Connection Failed", error: error.message });
  }
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
});

app.set("io", io);

// 🟢 FIX FOR CREDENTIALS CORS: Explicitly force origin header before engine handle
app.use("/socket.io", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  io.engine.handleRequest(req, res);
});

const parseCleanId = (val) => {
  if (!val) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object") {
    return String(val._id || val.id || val.user?._id || val.user?.id || "").trim();
  }
  return String(val).trim();
};

io.on("connection", (socket) => {
  socket.on("join_user", (userId) => {
    const cleanUserId = parseCleanId(userId);
    if (cleanUserId) socket.join(cleanUserId);
  });

  socket.on("join_conversation", (conversationId) => {
    const cleanConvId = parseCleanId(conversationId);
    if (cleanConvId) socket.join(cleanConvId);
  });

  socket.on("send_message", (messageData) => {
    const convId = parseCleanId(messageData.conversationId);
    const receiverId = parseCleanId(messageData.receiverId || messageData.receiver);

    if (convId) io.to(convId).emit("receive_message", messageData);
    if (receiverId) {
      io.to(receiverId).emit("receive_message", messageData);
      io.to(receiverId).emit("new_unread_message", messageData);
    }
  });
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
  server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

export default app;