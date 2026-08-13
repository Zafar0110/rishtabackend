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

// Loaded straight into an <img>, and a browser can't attach an Authorization
// header to an image request — so protecting this would just make every photo
// fail. Mirrors /api/profile/avatar/:userId. Returns the image only, never
// contact details, and needs the exact 24-character document id.
router.get("/photo/:id", getExpertPhoto);

// ---- Admin only ----
// These expose names, emails and phone numbers, so they stay behind the JWT.
// Fixed paths are declared before the /:id routes so they can't be swallowed.
router.get("/all", protectAdmin, getAllExperts);
router.get("/unseen-count", protectAdmin, getUnseenExpertCount);
router.put("/mark-seen", protectAdmin, markExpertsSeen);
router.put("/:id/status", protectAdmin, toggleExpertStatus);
router.delete("/:id", protectAdmin, deleteExpert);

export default router;
