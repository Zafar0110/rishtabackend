import express from "express";
import {
  registerExpert,
  getAllExperts,
  getActiveExperts,
  getExpertPhoto,
  getUnseenExpertCount,
  markExpertsSeen,
  toggleExpertStatus,
  deleteExpert,
} from "../controllers/expertController.js";
import { protectAdmin } from "../middleware/adminAuth.js";

const router = express.Router();

// ---- Public ----
// The "Register Now" form on the match-makers page
router.post("/register", registerExpert);

// Activated experts rendered in the public "Professional Experts" section
router.get("/active", getActiveExperts);

 
router.get("/photo/:id", getExpertPhoto);

// ---- Admin only ---- 
router.get("/all", protectAdmin, getAllExperts);
router.get("/unseen-count", protectAdmin, getUnseenExpertCount);
router.put("/mark-seen", protectAdmin, markExpertsSeen);
router.put("/:id/status", protectAdmin, toggleExpertStatus);
router.delete("/:id", protectAdmin, deleteExpert);

export default router;
