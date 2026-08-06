import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";

// Routes Imports
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
dotenv.config();

const app = express();

// 🚀 Payload Limit Increased to 50MB (Base64 Images ke liye)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Enable CORS
app.use(cors());

// ⚡ Serverless Database Middleware (har request par DB await karega)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection error in middleware:", error);
    res.status(500).json({ message: "Database connection failed" });
  }
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/payment", paymentRoutes);
// Test Route
app.get("/", (req, res) => {
  res.send("Rishta Point API is Running...");
});

// Local Running Logic
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

// Export app for Vercel Serverless Function
export default app;