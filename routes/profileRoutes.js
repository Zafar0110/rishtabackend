import express from "express";
import {
  getUserProfile,
  saveProfileStep,
  getRecentProposals ,
  getAllProfiles,
  getUserAvatar,
  getSeriousSeekers
} from "../controllers/profileController.js";

const router = express.Router();

//   Specific route pehle aayega (Slider/Recent proposals ke liye)
router.get("/recent-proposals/:userId", getRecentProposals);
router.get("/all", getAllProfiles);
router.get("/serious-seekers", getSeriousSeekers);    
router.get("/avatar/:userId", getUserAvatar);   
//    Profile update route
router.put("/save-step", saveProfileStep);

//  Dynamic userId route aakhir mein aayega
router.get("/:userId", getUserProfile);

export default router;