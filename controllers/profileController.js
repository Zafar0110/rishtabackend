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

// Strips the heavy base64 avatar out of a proposal document, replacing it with
// a boolean. Clients load the actual image from GET /api/profile/avatar/:id,
// which lets the browser fetch avatars in parallel and cache them — instead of
// inlining ~45KB of base64 per profile into the JSON payload.
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

    // Photos uploaded through the app are base64 data URLs, but some profiles
    // store a plain image URL instead. Those used to 404 here, which made every
    // list that relies on this endpoint fall back to a generic stock avatar —
    // hand the caller on to the real image instead.
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
    res.set("Cache-Control", "public, max-age=86400"); // cache for a day
    return res.send(buffer);
  } catch (error) {
    console.error("getUserAvatar Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Users an admin has hand-picked for the homepage seekers grid
// @route   GET /api/profile/serious-seekers
//
// Selects PROPOSAL_CARD_FIELDS deliberately: this section renders the exact same
// card component as Latest Proposals, so the two must return the same shape or
// one of them silently loses fields.
export const getSeriousSeekers = async (req, res) => {
  const requestStart = Date.now();
  try {
    // Deliberately NOT filtered by isProfileComplete: whoever the admin ticks is
    // exactly who appears, so the admin screen can't silently disagree with the
    // homepage. The card falls back gracefully on any missing field.
    // Newest account first, same rule as the proposals lists. This used to sort
    // on updatedAt, which moves whenever a user edits ANY part of their profile
    // — so a featured member could jump to the front of the section just for
    // changing their phone number.
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
    }

    // 2. Database query execute karein — every matching profile is returned
    // (no limit) so the homepage's "Show More" button can page through them
    // client-side.
    //
    // NOTE: this deliberately no longer narrows results to the viewer's
    // preferred partner country. That filter cut a logged-in user's homepage
    // from 22 profiles down to 3, which read as an empty/broken section.
    // Preference-based filtering still lives on the dedicated search page.
    // Newest account first. _id is the tie-breaker: MongoDB does not guarantee
    // a stable order for equal sort keys, and bulk-created accounts routinely
    // share the same createdAt millisecond — without this their order could
    // shuffle between page loads. An ObjectId embeds its creation time, so
    // _id: -1 keeps "newest first" within a tie too.
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
    )
      // Newest account first, matching the homepage proposals list. Without a
      // sort this returned raw insertion order, which put the newest profile
      // LAST on the search page. _id breaks ties deterministically, since
      // bulk-created accounts can share a createdAt millisecond.
      .sort({ createdAt: -1, _id: -1 })
      .lean();
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