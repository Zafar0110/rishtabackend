import express from "express";
import {
  registerExpert,
  getAllExperts,
  getExpertPhoto,
  getUnseenExpertCount,
  markExpertsSeen,
} from "../controllers/expertController.js";
import { protectAdmin } from "../middleware/adminAuth.js";

const router = express.Router();

// Public — the "Register Now" form on the match-makers page
router.post("/register", registerExpert);

// Admin only — the Expert tab in the admin panel. This is the endpoint that
// exposes names, emails and phone numbers, so it stays behind the JWT.
router.get("/all", protectAdmin, getAllExperts);
router.get("/unseen-count", protectAdmin, getUnseenExpertCount);
router.put("/mark-seen", protectAdmin, markExpertsSeen);

// Intentionally NOT admin-protected: it is loaded straight into an <img> tag,
// and a browser can't attach an Authorization header to an image request, so
// protecting it would simply make every photo fail to load. This mirrors
// /api/profile/avatar/:userId, which already serves member photos the same way.
// Only reachable with the exact 24-character document id.
router.get("/photo/:id", getExpertPhoto);

export default router;
