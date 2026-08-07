import User from "../models/User.js";
import mongoose from "mongoose";
// @desc    Get complete profile data for pre-filling inputs
// @route   GET /api/profile/:userId
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-password -otp -otpExpires");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Save step data dynamically
// @route   PUT /api/profile/save-step
export const saveProfileStep = async (req, res) => {
  try {
    const { userId, step, stepData } = req.body;

    if (!userId || !step || !stepData) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Step-wise Data Mapping
    switch (Number(step)) {
      case 1:
        user.basicInfo = { ...user.basicInfo, ...stepData };
        break;
      case 2:
        user.religiousInfo = { ...user.religiousInfo, ...stepData };
        break;
      case 3:
        user.locationInfo = { ...user.locationInfo, ...stepData };
        break;
      case 4:
        user.familyInfo = { ...user.familyInfo, ...stepData };
        break;
      case 5:
        user.educationInfo = { ...user.educationInfo, ...stepData };
        break;
      case 6:
        user.proposalDetail = { ...user.proposalDetail, ...stepData };
        break;
      case 7:
        user.partnerExpectations = { ...user.partnerExpectations, ...stepData };
        user.isProfileComplete = true; // Final step completion
        break;
      default:
        return res.status(400).json({ message: "Invalid step number" });
    }

    // Update highest completed step
    if (user.completedStep < Number(step)) {
      user.completedStep = Number(step);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: `Step ${step} saved successfully`,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const getRecentProposals = async (req, res) => {
  try {
    const { userId } = req.params;
    let query = { isProfileComplete: true };

    // 1. Check karein agar userId valid character string ho (undefined/null text na ho)
    const isValidUserParam = 
      userId && 
      userId !== "all" && 
      userId !== "undefined" && 
      userId !== "null" && 
      mongoose.Types.ObjectId.isValid(userId);

    if (isValidUserParam) {
      // Current user ko exclude karein
      query._id = { $ne: new mongoose.Types.ObjectId(userId) };

      // User search karein
      const currentUser = await User.findById(userId).lean();
      
      if (currentUser?.partnerExpectations?.currentCountry) {
        const partnerCountry = currentUser.partnerExpectations.currentCountry;
        if (partnerCountry && partnerCountry !== "No Preference") {
          query["locationInfo.residenceCountry"] = partnerCountry;
        }
      }
    }

    // 2. Database query execute karein
    let users = await User.find(query)
      .select("-password -otp -otpExpires")
      .limit(30)
      .sort({ createdAt: -1 })
      .lean();

    // 3. Fallback: Agar filter se zero results milein, to filter hata kar fetch karein
    if (users.length === 0 && query["locationInfo.residenceCountry"]) {
      delete query["locationInfo.residenceCountry"];
      users = await User.find(query)
        .select("-password -otp -otpExpires")
        .limit(30)
        .sort({ createdAt: -1 })
        .lean();
    }

    return res.status(200).json({ 
      success: true, 
      count: users.length, 
      users 
    });

  } catch (error) {
    console.error("Error in getRecentProposals:", error);
    // Vercel HTML Error ki bajaye hamesha JSON Return karein
    return res.status(500).json({ 
      success: false, 
      message: "Server error fetching proposals", 
      error: error.message 
    });
  }
};