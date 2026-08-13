import express from "express";
import { getAdminDashboardStats, getAllUsers, toggleUserStatus, toggleSeriousSeeker } from "../controllers/adminController.js";
import { protectAdmin } from "../middleware/adminAuth.js";

const router = express.Router();

router.get("/dashboard-stats", protectAdmin, getAdminDashboardStats);
router.get("/users", protectAdmin, getAllUsers);
router.put("/users/:id/status", protectAdmin, toggleUserStatus);
router.put("/users/:id/serious-seeker", protectAdmin, toggleSeriousSeeker);

export default router;