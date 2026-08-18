import "./polyfills.js";
import express from "express";
import dotenv from "dotenv";
import http from "http";
import cors from "cors";
import compression from "compression";
import { Server } from "socket.io";
import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import expertRoutes from "./routes/expertRoutes.js"; 
const PASSENGER_PORT = process.env.PORT;

dotenv.config();

const app = express(); 
const ALLOWED_ORIGIN = (process.env.FRONTEND_URL || "https://rishtapoin-front.vercel.app").replace(/\/$/, "");

app.use(compression());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(
  cors({
    origin: [ALLOWED_ORIGIN, "http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
  })
);

app.use(async (req, res, next) => { 
  const dbStart = Date.now();
  try {
    await connectDB();
    const dbTime = Date.now() - dbStart;
    if (req.originalUrl.includes("/auth/login") || req.originalUrl.includes("/chat/")) {
      console.error(`[TIMING] DB connect/reuse for ${req.method} ${req.originalUrl}: ${dbTime}ms`);
    }
    next();
  } catch (error) {
    console.error("Database connection failure:", error);
    return res.status(500).json({
      success: false,
      message: "DB Connection Failed",
      error: error.message,
    });
  }
});

const server = http.createServer(app);

const io = new Server(server, {
  maxHttpBufferSize: 1e8,  
  pingTimeout: 60000,  
  pingInterval: 25000,
  cors: {
    origin: [ALLOWED_ORIGIN, "http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
});

app.set("io", io);

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
app.use("/api/expert", expertRoutes);

app.get("/", (req, res) => {
  res.send("Rishta Point API Running...");
});


app.use("/api/admin", adminRoutes); 
const PORT = PASSENGER_PORT || process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`ðŸš€ Server running on port ${PORT}`);
});

export default app;