import mongoose from "mongoose";

const rishtaExpertSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true }, 
    profileImage: { type: String, required: true },
 
    isActive: { type: Boolean, default: false },
 
    isSeen: { type: Boolean, default: false },
  },
  { timestamps: true }
);
 
const RishtaExpert = mongoose.model("RishtaExpert", rishtaExpertSchema, "rishta_expert");
export default RishtaExpert;
