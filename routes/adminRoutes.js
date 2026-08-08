import express from "express";
import { getAdminDashboardStats, getAllUsers, toggleUserStatus } from "../controllers/adminController.js";

const router = express.Router();

router.get("/dashboard-stats", getAdminDashboardStats);
router.get("/users", getAllUsers);
router.put("/users/:id/status", toggleUserStatus);

export default router;