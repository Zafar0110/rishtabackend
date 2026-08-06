import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // Auth Data
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: "" },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    registerType: { type: String, enum: ["myself", "someone"], default: "myself" },
    relation: { type: String, default: "" },
    connects: { type: Number, default: 5 },
    currentPackage: { type: String, default: "Free" },

    // Email Verification Status
    isVerified: { type: Boolean, default: false },
    otp: { type: String },
    otpExpires: { type: Date },

    // 🚀 Profile Progress Tracking
    isProfileComplete: { type: Boolean, default: false },
    completedStep: { type: Number, default: 1 },

    // 📄 7-Step Profile Data Objects
    basicInfo: {
      featuredImage: { type: String, default: "" },
      gallery: [{ type: String }],
      gender: { type: String, default: "Male" },
      maritalStatus: { type: String, default: "Single" },
      age: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
      weight: { type: Number, default: 0 },
      complexion: { type: String, default: "Fair" },
      bodyType: { type: String, default: "Slim & Smart" },
    },
    religiousInfo: {
      religion: { type: String, default: "" },
      sect: { type: String, default: "" },
      caste: { type: String, default: "" },
      namaz: { type: String, default: "" },
    },
    locationInfo: {
      originCountry: { type: String, default: "" },
      originState: { type: String, default: "" },
      originCity: { type: String, default: "" },
      residenceCountry: { type: String, default: "" },
      residenceState: { type: String, default: "" },
      residenceCity: { type: String, default: "" },
    },
    familyInfo: {
      fatherStatus: { type: String, default: "" },
      motherStatus: { type: String, default: "" },
      brothers: { type: Number, default: 0 },
      sisters: { type: Number, default: 0 },
      familyValues: { type: String, default: "" },
    },
    educationInfo: {
      education: { type: String, default: "None" },
      profession: { type: String, default: "" },
      sourceOfIncome: { type: String, default: "Job" },
      motherTongue: { type: String, default: "Urdu" },
      income: { type: String, default: "" },
    },
    proposalDetail: {
      aboutSelf: { type: String, default: "" },
      houseDetail: { type: String, default: "" },
    },
    partnerExpectations: {
      partnerGender: { type: String, default: "Male" },
      partnerAge: { type: String, default: "Any Age" },
      currentCountry: { type: String, default: "" },
      currentState: { type: String, default: "" },
      currentCity: { type: String, default: "" },
      originCountry: { type: String, default: "" },
      partnerReligion: { type: String, default: "Islam" },
      partnerSect: { type: String, default: "No Preference" },
      partnerCaste: { type: String, default: "No Preference" },
      partnerEducation: { type: String, default: "No Preference" },
      partnerHeight: { type: String, default: "Any Height" },
      partnerMotherTongue: { type: String, default: "Urdu" },
      willingToMarryStatus: { type: String, default: "Single" },
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;