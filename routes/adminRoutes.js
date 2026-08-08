import express from "express";
import { getAdminDashboardStats } from "../controllers/adminController.js";

const router = express.Router();

router.get("/dashboard-stats", getAdminDashboardStats);

export default router;