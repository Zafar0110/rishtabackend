import User from "../models/User.js";
import mongoose from "mongoose";
// @desc    Get complete profile data for pre-filling inputs
// @route   GET /api/profile/:userId
export const getUserProfile = async (req, res) => {
  
  const requestStart = Date.now();
  try {
    const user = await User.findById(req.params.userId)
      .select("-password -otp -otpExpires")
      .lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const sizeKB = (JSON.stringify(user).length / 1024).toFixed(1);
    console.error(`[TIMING] getUserProfile - ${Date.now() - requestStart}ms, size: ${sizeKB}KB`);
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Save step data dynamically
// @route   PUT /api/profile/save-step
export const saveProfileStep = async (req, res) => { 
  const requestStart = Date.now();
  try {
    const { userId, step, stepData } = req.body;

    if (!userId || !step || !stepData) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    
    const stepFieldMap = {
      1: "basicInfo",
      2: "religiousInfo",
      3: "locationInfo",
      4: "familyInfo",
      5: "educationInfo",
      6: "proposalDetail",
      7: "partnerExpectations",
    };

    const stepNumber = Number(step);
    const targetField = stepFieldMap[stepNumber];

    if (!targetField) {
      return res.status(400).json({ message: "Invalid step number" });
    }

     
    const setOps = {};
    for (const [key, value] of Object.entries(stepData)) {
      setOps[`${targetField}.${key}`] = value;
    }

    if (stepNumber === 7) {
      setOps.isProfileComplete = true; 
    }

    const updateOps = {
      $set: setOps,
      
      $max: { completedStep: stepNumber },
    };

    const result = await User.updateOne({ _id: userId }, updateOps);

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    console.error(`[TIMING] saveProfileStep (step ${stepNumber}) - ${Date.now() - requestStart}ms`);

     
    res.status(200).json({
      success: true,
      message: `Step ${step} saved successfully`,
      completedStep: stepNumber,
    });
  } catch (error) {
    console.error("saveProfileStep Error:", error);
    res.status(500).json({ message: error.message });
  }
};
 
const PROPOSAL_CARD_FIELDS = [
  "firstName",
  "lastName",
  "basicInfo.featuredImage",
  "basicInfo.gender",
  "basicInfo.age",
  "religiousInfo.sect",
  "religiousInfo.caste", 
  "basicInfo.height",
  "religiousInfo.religion",
  "locationInfo.residenceCountry",
  "locationInfo.residenceCity",
  "locationInfo.originCountry",
  "educationInfo.profession",
  "createdAt",
].join(" ");

 
const stripAvatar = (u) => {
  const { basicInfo = {}, ...rest } = u;
  const { featuredImage, ...basicRest } = basicInfo;
  return {
    ...rest,
    basicInfo: basicRest,
    hasAvatar: !!(featuredImage && featuredImage.trim() !== ""),
  };
};

// @desc    Serve a user's profile photo as a real, cacheable image response
// @route   GET /api/profile/avatar/:userId
export const getUserAvatar = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid User ID" });
    }

    const user = await User.findById(userId).select("basicInfo.featuredImage").lean();
    const dataUrl = user?.basicInfo?.featuredImage;

    if (!dataUrl) {
      return res.status(404).json({ success: false, message: "No avatar set" });
    }

     
    if (/^https?:\/\//i.test(dataUrl)) {
      res.set("Cache-Control", "public, max-age=86400");
      return res.redirect(302, dataUrl);
    }

    if (!dataUrl.startsWith("data:")) {
      return res.status(404).json({ success: false, message: "No avatar set" });
    }

    const match = dataUrl.match(/^data:(.+?);base64,(.*)$/s);
    if (!match) {
      return res.status(404).json({ success: false, message: "Avatar is not a valid data URL" });
    }

    const buffer = Buffer.from(match[2], "base64");

    res.set("Content-Type", match[1]);
    res.set("Cache-Control", "public, max-age=86400"); 
    return res.send(buffer);
  } catch (error) {
    console.error("getUserAvatar Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Users an admin has hand-picked for the homepage seekers grid
// @route   GET /api/profile/serious-seekers 
export const getSeriousSeekers = async (req, res) => {
  const requestStart = Date.now();
  try {
     
    const users = await User.find({ isSeriousSeeker: true, role: { $ne: "admin" } })
      .select(PROPOSAL_CARD_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .lean();

    const payload = users.map(stripAvatar);
    console.error(`[TIMING] getSeriousSeekers - ${payload.length} users, ${Date.now() - requestStart}ms`);

    return res.status(200).json({ success: true, count: payload.length, users: payload });
  } catch (error) {
    console.error("Error in getSeriousSeekers:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching serious marriage seekers",
      error: error.message,
    });
  }
};

export const getRecentProposals = async (req, res) => { 
  const requestStart = Date.now();
  try {
    const { userId } = req.params; 
    let query = { isProfileComplete: true, role: { $ne: "admin" } }; 
    const isValidUserParam =
      userId &&
      userId !== "all" &&
      userId !== "undefined" &&
      userId !== "null" &&
      mongoose.Types.ObjectId.isValid(userId);

    if (isValidUserParam) { 
      query._id = { $ne: new mongoose.Types.ObjectId(userId) };
    }

    
    const users = await User.find(query)
      .select(PROPOSAL_CARD_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .lean();

    const payload = users.map(stripAvatar);
    const sizeKB = (JSON.stringify(payload).length / 1024).toFixed(1);
    console.error(`[TIMING] getRecentProposals - ${payload.length} users, ${sizeKB}KB, ${Date.now() - requestStart}ms`);

    return res.status(200).json({
      success: true,
      count: payload.length,
      users: payload
    });

  } catch (error) {
    console.error("Error in getRecentProposals:", error); 
    return res.status(500).json({
      success: false,
      message: "Server error fetching proposals",
      error: error.message
    });
  }
};


export const getAllProfiles = async (req, res) => { 
  const requestStart = Date.now();
  try { 
    const queryStart = Date.now();
    const users = await User.find(
      { role: { $ne: "admin" } },
      "-password -otp -otpExpires -basicInfo.gallery"
    )
       
      .sort({ createdAt: -1, _id: -1 })
      .lean();
    console.error(`[TIMING] getAllProfiles - query (${users.length} users): ${Date.now() - queryStart}ms`);

     
    const profiles = users.map((u) => {
      const basic = u.basicInfo || {};
      const religious = u.religiousInfo || {};
      const location = u.locationInfo || {};
      const education = u.educationInfo || {};

      return {
        _id: u._id,
        user: u._id,
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || "User",
        email: u.email,
        phone: u.phone,
        role: u.role || "user",
        
        // Basic Info
        image: basic.featuredImage || "/assets/homepage/proposal/first.webp",
        gender: basic.gender || "Male",
        maritalStatus: basic.maritalStatus || "Single",
        age: basic.age || 0,
        height: basic.height || 0,
        weight: basic.weight || 0,
        bodyType: basic.bodyType || "Slim & Smart",
        complexion: basic.complexion || "Fair",

        // Religious Info
        religious: religious.religion || "Islam",
        sect: religious.sect || "",
        caste: religious.caste || "",

        // Location Info
        location: location.residenceCity || location.residenceCountry || "",
        origin: location.originCountry || "",
        residenceCountry: location.residenceCountry || "",
        residenceState: location.residenceState || "",
        residenceCity: location.residenceCity || "",

        // Education & Profession Info
        education: education.education || "None",
        profession: education.profession || "",
        motherTongue: education.motherTongue || "Urdu",
        income: education.income || "",

        // Flags
        isProfileComplete: u.isProfileComplete || false,
        completedStep: u.completedStep || 1,
      };
    });

    const responseBody = { success: true, count: profiles.length, profiles };
    const sizeKB = (JSON.stringify(responseBody).length / 1024).toFixed(1);
    console.error(`[TIMING] getAllProfiles - response size: ${sizeKB}KB, TOTAL: ${Date.now() - requestStart}ms`);

    return res.status(200).json(responseBody);
  } catch (error) {
    console.error("Error in getAllProfiles:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error: Unable to fetch profiles",
      error: error.message,
    });
  }
};