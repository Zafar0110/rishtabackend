import mongoose from "mongoose";

const rishtaExpertSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    // Stored as a compressed base64 data URL, the same way profile photos and
    // chat attachments are handled elsewhere in this app. Required — Mongoose
    // treats an empty string as missing for `required`, so a blank value is
    // rejected rather than quietly stored.
    profileImage: { type: String, required: true },

    // Approval switch. Defaults to false so a fresh application is never shown
    // publicly until an admin activates it; once true the expert is listed in
    // "Professional Experts" on the match-makers page.
    isActive: { type: Boolean, default: false },

    // False until an admin opens the Expert tab. Drives the red "unseen" badge.
    // Records created before this field existed read as undefined, which is
    // falsy — so they correctly count as unseen rather than being hidden.
    isSeen: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Third argument pins the collection name to `rishta_expert` — without it
// Mongoose would pluralise the model name into `rishtaexperts`.
const RishtaExpert = mongoose.model("RishtaExpert", rishtaExpertSchema, "rishta_expert");
export default RishtaExpert;
