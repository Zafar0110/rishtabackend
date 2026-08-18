import "./polyfills.js";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import User from "./models/User.js"; // Path verified matching user model
import connectDB from "./config/db.js";

dotenv.config();

// 20 Unique Verified Images (10 Male + 10 Female - Har user ki image completely DIFFERENT hai)
const maleImages = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=400&auto=format&fit=crop"
];

const femaleImages = [
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?q=80&w=400&auto=format&fit=crop"
];

// Diverse Countries List with States & Cities
const locationPool = [
  { country: "PK", state: "PB", city: "Lahore" },
  { country: "AE", state: "DU", city: "Dubai" },
  { country: "SA", state: "01", city: "Riyadh" },
  { country: "GB", state: "ENG", city: "London" },
  { country: "CA", state: "ON", city: "Toronto" },
  { country: "US", state: "NY", city: "New York" },
  { country: "QA", state: "DA", city: "Doha" },
  { country: "OM", state: "MA", city: "Muscat" },
  { country: "KW", state: "KU", city: "Kuwait City" },
  { country: "TR", state: "34", city: "Istanbul" },
];

const firstNamesMale = ["Hamza", "Usman", "Bilal", "Zaid", "Omar", "Ali", "Saad", "Shahzaib", "Fahad", "Danish"];
const firstNamesFemale = ["Alina", "Fatima", "Ayesha", "Zainab", "Sana", "Mariam", "Hira", "Anum", "Noor", "Iqra"];
const lastNames = ["Khan", "Malik", "Sheikh", "Chaudhry", "Raja", "Syed", "Arain", "Butt", "Qureshi", "Bhatti"];
const professions = ["Software Engineer", "Doctor", "Graphic Designer", "Civil Engineer", "Chartered Accountant", "Business Owner", "Banker", "Teacher", "HR Manager", "Architect"];
const sects = ["Sunni", "Shia", "Ahl-e-Hadith"];
const castes = ["Rajput", "Arain", "Kashmiri", "Sheikh", "Jatt", "Syed", "Malik"];

const generate20Users = async () => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash("Password123", salt);
  const users = [];

  let maleIndex = 0;
  let femaleIndex = 0;

  for (let i = 1; i <= 20; i++) {
    const isMale = i % 2 !== 0; // Alternate Male & Female
    
    // Pick unique image and name for each user
    const firstName = isMale ? firstNamesMale[maleIndex] : firstNamesFemale[femaleIndex];
    const featuredImg = isMale ? maleImages[maleIndex] : femaleImages[femaleIndex];

    if (isMale) maleIndex++;
    else femaleIndex++;

    const lastName = lastNames[(i - 1) % lastNames.length];
    const loc = locationPool[(i - 1) % locationPool.length]; // Diverse Countries
    const age = 22 + (i % 10);

    users.push({
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
      phone: `0300${1000000 + i}`,
      password: hashedPassword,
      registerType: "myself",
      isVerified: true,
      isProfileComplete: true,
      completedStep: 7,
      basicInfo: {
        featuredImage: featuredImg, // Guaranteed UNIQUE image
        gallery: [
          featuredImg,
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300",
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=300"
        ],
        gender: isMale ? "Male" : "Female",
        maritalStatus: "Single",
        age,
        height: isMale ? 5.9 : 5.4,
        weight: isMale ? 74 : 58,
        complexion: i % 2 === 0 ? "Fair" : "Wheatish",
        bodyType: "Slim & Smart",
      },
      religiousInfo: {
        religion: "Islam",
        sect: sects[i % sects.length],
        caste: castes[i % castes.length],
        namaz: "Regular",
      },
      locationInfo: {
        originCountry: "PK",
        originState: "PB",
        originCity: "Lahore",
        residenceCountry: loc.country,
        residenceState: loc.state,
        residenceCity: loc.city,
      },
      familyInfo: {
        fatherStatus: "Alive (Business)",
        motherStatus: "Alive (Housewife)",
        brothers: (i % 3),
        sisters: (i % 2),
        familyValues: "Moderate",
      },
      educationInfo: {
        education: "Bachelors Degree",
        profession: professions[i % professions.length],
        sourceOfIncome: "Job",
        motherTongue: "Urdu",
        income: `${80000 + i * 10000} PKR`,
      },
      proposalDetail: {
        aboutSelf: `${firstName} is a dedicated professional working as a ${professions[i % professions.length]} based in ${loc.city}, ${loc.country}. Looking for an educated and decent life partner.`,
        houseDetail: "Personal Residence",
      },
      partnerExpectations: {
        partnerGender: isMale ? "Female" : "Male",
        partnerAge: `${age - 3}-${age + 2} Years`,
        currentCountry: loc.country,
        currentState: loc.state,
        currentCity: loc.city,
        originCountry: "PK",
        partnerReligion: "Islam",
        partnerSect: "No Preference",
        partnerCaste: "No Preference",
        partnerEducation: "Graduate",
        partnerHeight: "Any Height",
        partnerMotherTongue: "Urdu",
        willingToMarryStatus: "Single",
      },
    });
  }

  return users;
};

const seedData = async () => {
  try {
    await connectDB();
    console.log("🔗 MongoDB Connected for Seeding...");

    // Remove previous dummy accounts matching @example.com
    await User.deleteMany({ email: /@example\.com$/ });
    console.log("🧹 Previous dummy users cleaned up.");

    const dummy20Users = await generate20Users();
    const createdUsers = await User.insertMany(dummy20Users);

    console.log(`  SUCCESS: 20 Unique Profiles Successfully Inserted!`);
    console.log("=========================================================");
    createdUsers.forEach((u, idx) => {
      console.log(`${idx + 1}. ${u.firstName} ${u.lastName} (${u.basicInfo.gender}) | Residence: ${u.locationInfo.residenceCountry} - ${u.locationInfo.residenceCity} | ID: ${u._id}`);
    });
    console.log("=========================================================");

    process.exit();
  } catch (error) {
    console.error(`  Seeding Error: ${error.message}`);
    process.exit(1);
  }
};

seedData();