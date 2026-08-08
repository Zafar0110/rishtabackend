import express from "express";
import { getAdminDashboardStats, getAllUsers, toggleUserStatus } from "../controllers/adminController.js";
import { protectAdmin } from "../middleware/adminAuth.js";

const router = express.Router();

router.get("/dashboard-stats", protectAdmin, getAdminDashboardStats);
router.get("/users", protectAdmin, getAllUsers);
router.put("/users/:id/status", protectAdmin, toggleUserStatus);

export default router;