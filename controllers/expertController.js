import mongoose from "mongoose";
import RishtaExpert from "../models/RishtaExpert.js";

 
const MAX_IMAGE_DATA_URL_LENGTH = 3 * 1024 * 1024;

// @desc    Public: submit a "Register Now" application from the match-makers page
// @route   POST /api/expert/register
export const registerExpert = async (req, res) => {
  try {
    const { fullName, email, phone, profileImage } = req.body;

    const cleanName = (fullName || "").trim();
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanPhone = (phone || "").trim();

    if (!cleanName || !cleanEmail || !cleanPhone) {
      return res.status(400).json({
        success: false,
        message: "Full name, email and phone are all required",
      });
    }

    const cleanImage = (profileImage || "").trim();

    if (!cleanImage) {
      return res.status(400).json({
        success: false,
        message: "A profile image is required",
      });
    }

     
    if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(cleanImage)) {
      return res.status(400).json({
        success: false,
        message: "Profile image must be a valid image file",
      });
    }

     
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address" });
    }

    if (cleanImage.length > MAX_IMAGE_DATA_URL_LENGTH) {
      return res.status(400).json({
        success: false,
        message: "Profile image is too large. Please choose a smaller picture.",
      });
    }

    const expert = await RishtaExpert.create({
      fullName: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      profileImage: cleanImage,
    });

    return res.status(201).json({
      success: true,
      message: "Thank you! Your registration has been submitted.",
       
      expert: {
        _id: expert._id,
        fullName: expert.fullName,
        email: expert.email,
        phone: expert.phone,
        createdAt: expert.createdAt,
      },
    });
  } catch (error) {
    console.error("Register Expert Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while submitting your registration",
      error: error.message,
    });
  }
};

// @desc    Admin: list every submitted expert application
// @route   GET /api/expert/all   
export const getAllExperts = async (req, res) => {
  try {
    const experts = await RishtaExpert.find()
      .select("-profileImage")
      .sort({ createdAt: -1, _id: -1 })
      .lean();

    const payload = experts.map((e) => ({
      ...e,
      hasPhoto: true,
      isSeen: e.isSeen === true,
      isActive: e.isActive === true,
    }));

    return res.status(200).json({
      success: true,
      count: payload.length,
      unseenCount: payload.filter((e) => !e.isSeen).length,
      experts: payload,
    });
  } catch (error) {
    console.error("Get All Experts Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching expert registrations",
      error: error.message,
    });
  }
};

// @desc    Public: the activated experts shown in "Professional Experts"
// @route   GET /api/expert/active
 
export const getActiveExperts = async (req, res) => {
  try {
    const experts = await RishtaExpert.find({ isActive: true })
      .select("fullName phone createdAt")
      .sort({ createdAt: -1, _id: -1 })
      .lean();

    return res.status(200).json({ success: true, count: experts.length, experts });
  } catch (error) {
    console.error("Get Active Experts Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching experts",
      error: error.message,
    });
  }
};

// @desc    Admin: activate / deactivate an expert
// @route   PUT /api/expert/:id/status   
export const toggleExpertStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ success: false, message: "isActive (boolean) is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const result = await RishtaExpert.updateOne({ _id: id }, { $set: { isActive } });
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Expert not found" });
    }

    return res.status(200).json({
      success: true,
      message: isActive
        ? "Expert activated and is now listed publicly"
        : "Expert deactivated and removed from the public page",
      expert: { _id: id, isActive },
    });
  } catch (error) {
    console.error("Toggle Expert Status Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin: permanently delete an expert registration
// @route   DELETE /api/expert/:id   (protectAdmin)
export const deleteExpert = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const result = await RishtaExpert.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Expert not found" });
    }

    return res.status(200).json({ success: true, message: "Expert registration deleted" });
  } catch (error) {
    console.error("Delete Expert Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin: how many registrations the admin hasn't looked at yet
// @route   GET /api/expert/unseen-count   (protectAdmin) 
export const getUnseenExpertCount = async (req, res) => {
  try {
    const count = await RishtaExpert.countDocuments({ isSeen: { $ne: true } });
    return res.status(200).json({ success: true, count });
  } catch (error) {
    console.error("Unseen Expert Count Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin: mark every pending registration as seen
// @route   PUT /api/expert/mark-seen   (protectAdmin)
export const markExpertsSeen = async (req, res) => {
  try {
    const result = await RishtaExpert.updateMany(
      { isSeen: { $ne: true } },
      { $set: { isSeen: true } }
    );
    return res.status(200).json({ success: true, markedSeen: result.modifiedCount });
  } catch (error) {
    console.error("Mark Experts Seen Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Serve one applicant's photo as a real, cacheable image
// @route   GET /api/expert/photo/:id 
export const getExpertPhoto = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const expert = await RishtaExpert.findById(req.params.id).select("profileImage").lean();
    const dataUrl = expert?.profileImage;

    if (!dataUrl) {
      return res.status(404).json({ success: false, message: "No photo uploaded" });
    }

    const match = dataUrl.match(/^data:(.+?);base64,(.*)$/s);
    if (!match) {
      return res.status(404).json({ success: false, message: "Photo is not a valid image" });
    }

    res.set("Content-Type", match[1]);
    res.set("Cache-Control", "public, max-age=86400");
    return res.send(Buffer.from(match[2], "base64"));
  } catch (error) {
    console.error("Get Expert Photo Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
