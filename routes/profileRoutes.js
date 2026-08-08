import express from "express";
import { 
  getUserProfile, 
  saveProfileStep, 
  getRecentProposals ,
  getAllProfiles
} from "../controllers/profileController.js";

const router = express.Router();

// 1. Specific route pehle aayega (Slider/Recent proposals ke liye)
router.get("/recent-proposals/:userId", getRecentProposals);
router.get("/all", getAllProfiles);
// 2. Profile update route
router.put("/save-step", saveProfileStep);

// 3. Dynamic userId route aakhir mein aayega
router.get("/:userId", getUserProfile);

export default router;