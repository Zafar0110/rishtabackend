import express from "express";
import { getAdminDashboardStats, getAllUsers } from "../controllers/adminController.js";

const router = express.Router();

router.get("/dashboard-stats", getAdminDashboardStats);
router.get("/users", getAllUsers);

export default router;