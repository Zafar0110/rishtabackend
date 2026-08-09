import User from "../models/User.js";
import mongoose from "mongoose";
// @desc    Get complete profile data for pre-filling inputs
// @route   GET /api/profile/:userId
export const getUserProfile = async (req, res) => {
  // TEMPORARY performance diagnostics — remove once the slow-API cause is confirmed
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
  // TEMPORARY performance diagnostics — remove once the slow-API cause is confirmed
  const requestStart = Date.now();
  try {
    const { userId, step, stepData } = req.body;

    if (!userId || !step || !stepData) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    // Which embedded object this step writes into
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

    // Build a dot-notation $set so only the changed keys are written. The old
    // implementation did findById() -> mutate -> user.save(), which round-
    // tripped the ENTIRE user document (including every base64 profile/gallery
    // photo) twice, then returned it in the response a third time. Now it's a
    // single targeted update that sends only the fields being changed.
    const setOps = {};
    for (const [key, value] of Object.entries(stepData)) {
      setOps[`${targetField}.${key}`] = value;
    }

    if (stepNumber === 7) {
      setOps.isProfileComplete = true; // Final step completion
    }

    const updateOps = {
      $set: setOps,
      // Only ever raise completedStep, never lower it (matches previous logic)
      $max: { completedStep: stepNumber },
    };

    const result = await User.updateOne({ _id: userId }, updateOps);

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    console.error(`[TIMING] saveProfileStep (step ${stepNumber}) - ${Date.now() - requestStart}ms`);

    // The full user object is deliberately NOT returned — none of the 14
    // frontend callers read the response body, and sending it back meant
    // shipping every base64 photo over the wire again.
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


// Only the fields the homepage proposal card actually renders. Critically this
// EXCLUDES basicInfo.gallery — gallery photos are stored as base64 blobs, and
// returning them for every profile made this endpoint 2.8MB / 99 seconds.
const PROPOSAL_CARD_FIELDS = [
  "firstName",
  "lastName",
  "profileImage",
  "basicInfo.featuredImage",
  "basicInfo.gender",
  "basicInfo.age",
  "religiousInfo.sect",
  "religiousInfo.caste",
  "locationInfo.residenceCity",
  "locationInfo.originCountry",
  "educationInfo.profession",
  "createdAt",
].join(" ");

export const getRecentProposals = async (req, res) => {
  // TEMPORARY performance diagnostics — remove once the slow-API cause is confirmed
  const requestStart = Date.now();
  try {
    const { userId } = req.params;
    // Admins are excluded so staff accounts never appear as proposals
    let query = { isProfileComplete: true, role: { $ne: "admin" } };

    // 1. Check karein agar userId valid character string ho (undefined/null text na ho)
    const isValidUserParam =
      userId &&
      userId !== "all" &&
      userId !== "undefined" &&
      userId !== "null" &&
      mongoose.Types.ObjectId.isValid(userId);

    if (isValidUserParam) {
      // Logged-in user ka apna profile exclude karein
      query._id = { $ne: new mongoose.Types.ObjectId(userId) };

      // Fetch only the one field needed for the preference filter, instead of
      // pulling the entire user document (photos included) just to read it.
      const currentUser = await User.findById(userId)
        .select("partnerExpectations.currentCountry")
        .lean();

      const partnerCountry = currentUser?.partnerExpectations?.currentCountry;
      if (partnerCountry && partnerCountry !== "No Preference") {
        query["locationInfo.residenceCountry"] = partnerCountry;
      }
    }

    // 2. Database query execute karein — no limit, the frontend's "Show More"
    // button pages through the full list client-side.
    let users = await User.find(query)
      .select(PROPOSAL_CARD_FIELDS)
      .sort({ createdAt: -1 })
      .lean();

    // 3. Fallback: Agar filter se zero results milein, to filter hata kar fetch karein
    if (users.length === 0 && query["locationInfo.residenceCountry"]) {
      delete query["locationInfo.residenceCountry"];
      users = await User.find(query)
        .select(PROPOSAL_CARD_FIELDS)
        .sort({ createdAt: -1 })
        .lean();
    }

    const sizeKB = (JSON.stringify(users).length / 1024).toFixed(1);
    console.error(`[TIMING] getRecentProposals - ${users.length} users, ${sizeKB}KB, ${Date.now() - requestStart}ms`);

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


export const getAllProfiles = async (req, res) => {
  // TEMPORARY performance diagnostics — remove once the slow-API cause is confirmed
  const requestStart = Date.now();
  try {
    // 1. Database level query: Admins filter out honge aur Passwords/OTPs hide honge.
    // basicInfo.gallery is excluded too — Search.jsx (the only consumer of this
    // endpoint) never reads it, and gallery photos can be large base64 blobs
    // that were bloating this response for every single user in the list.
    const queryStart = Date.now();
    const users = await User.find(
      { role: { $ne: "admin" } },
      "-password -otp -otpExpires -basicInfo.gallery"
    ).lean();
    console.error(`[TIMING] getAllProfiles - query (${users.length} users): ${Date.now() - queryStart}ms`);

    // 2. Clean Frontend Data Mapping
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