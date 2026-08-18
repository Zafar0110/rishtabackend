import "./polyfills.js";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import User from "./models/User.js";  
import connectDB from "./config/db.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    //   Database Connection  
    await connectDB();
    console.log("✅ MongoDB Connected for Admin Seeder");

    const adminEmail = "admin@gmail.com";
    const plainPassword = "123123123";

    //   Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    //   Find existing or create new admin
    let adminUser = await User.findOne({ email: adminEmail });

    if (adminUser) {
      // Agar pehle se exist karta hai to reset/update kar dein
      adminUser.password = hashedPassword;
      adminUser.role = "admin";
      adminUser.isVerified = true;
      adminUser.isProfileComplete = true;
      await adminUser.save();
      console.log("🔄 Existing Admin User Updated & Password Reset Successfully!");
    } else {
      // Naya create karein
      adminUser = new User({
        firstName: "Super",
        lastName: "Admin",
        email: adminEmail,
        phone: "+923000000000",
        password: hashedPassword,
        role: "admin",
        isVerified: true,
        isProfileComplete: true,
      });
      await adminUser.save();
      console.log("  New Admin Created Successfully!");
    }

    
    console.log("  Email:", adminEmail);
    console.log("  Password:", plainPassword);
    console.log("  Role:", adminUser.role);
    

    process.exit(0);
  } catch (error) {
    console.error("  Error Seeding Admin:", error.message);
    process.exit(1);
  }
};

seedAdmin();