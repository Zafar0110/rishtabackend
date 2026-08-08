import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken"; // JWT Import Added
import sendEmail from "../config/sendEmail.js";

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// 🔑 Helper Function to Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "rishtapoint_secret_key", {
    expiresIn: "7d",
  });
};

// @desc    Register User & Send OTP Email
// @route   POST /api/auth/register
export const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, registerType, relation } = req.body;

    const normalizedEmail = email.trim().toLowerCase();

    let user = await User.findOne({ email: normalizedEmail });

    if (user && user.isVerified) {
      return res.status(400).json({ message: "User already registered and verified with this email" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins validity

    if (user && !user.isVerified) {
      user.firstName = firstName;
      user.lastName = lastName;
      user.phone = phone;
      user.password = hashedPassword;
      user.registerType = registerType;
      user.relation = relation;
      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();
    } else {
      user = await User.create({
        firstName,
        lastName,
        email: normalizedEmail,
        phone,
        password: hashedPassword,
        registerType,
        relation,
        otp,
        otpExpires,
      });
    }

    const emailTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rishta Point Verification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0107; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0107; padding: 40px 10px;">
    <tr>
      <td align="center">
        
        <table role="presentation" width="100%" max-width="550" border="0" cellspacing="0" cellpadding="0" style="max-width: 550px; background-color: #170310; border: 1px solid rgba(201, 169, 110, 0.25); border-radius: 20px; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.6);">
          
          <tr>
            <td align="center" style="background: linear-gradient(135deg, #800040 0%, #3b001d 100%); padding: 35px 20px 25px 20px; border-bottom: 2px solid #C9A96E;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: 2px; text-transform: uppercase;">
                RISHTA <span style="color: #C9A96E;">POINT</span>
              </h1>
              <p style="margin: 5px 0 0 0; font-size: 11px; color: #E0C79B; text-transform: uppercase; letter-spacing: 3px;">
                Connecting Hearts with Trust
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px 30px; text-align: center;">
              <h2 style="margin: 0 0 15px 0; font-size: 22px; color: #ffffff; font-weight: 700;">
                Verify Your Account
              </h2>

              <p style="margin: 0 0 25px 0; font-size: 14px; color: #D1C4CE; line-height: 1.6;">
                Welcome <strong style="color: #ffffff;">${firstName}</strong>,<br>
                Thank you for choosing Rishta Point. Please use the verification code below to complete your registration.
              </p>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0 30px 0;">
                <tr>
                  <td align="center">
                    <div style="background-color: #26051a; border: 1px dashed #A42C4F; border-radius: 14px; padding: 18px 25px; display: inline-block;">
                      <span style="font-size: 32px; font-weight: 800; color: #C9A96E; letter-spacing: 12px; font-family: monospace;">
                        ${otp}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; font-size: 12px; color: #A895A2;">
                ⏳ This security code will expire in <strong style="color: #A42C4F;">10 minutes</strong>.
              </p>

              <hr style="border: 0; height: 1px; background: rgba(255, 255, 255, 0.1); margin: 30px 0;">

              <p style="margin: 0; font-size: 11px; color: #8C7B87; line-height: 1.5;">
                If you did not request this registration, please ignore this email.<br>
                Do not share this code with anyone.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="background-color: #0d0109; padding: 20px; border-top: 1px solid rgba(255, 255, 255, 0.05);">
              <p style="margin: 0; font-size: 11px; color: #6E5C6A;">
                &copy; ${new Date().getFullYear()} Rishta Point. All rights reserved.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
    `;

    await sendEmail({
      email: user.email,
      subject: `${otp} is your Rishta Point verification code`,
      otp: otp,
      html: emailTemplate,
    });

    res.status(200).json({
      success: true,
      email: user.email,
      message: "Verification code sent to your email!",
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = email ? email.trim().toLowerCase() : "";

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Account is already verified!" });
    }

    if (user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP code!" });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      message: "Email verified successfully!",
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isProfileComplete: user.isProfileComplete || false,
        completedStep: user.completedStep || 0,
      },
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login User
// @route   POST /api/auth/login
// export const loginUser = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res.status(400).json({ message: "Please provide both email and password" });
//     }

//     const normalizedEmail = email.trim().toLowerCase();
//     const user = await User.findOne({ email: normalizedEmail });

//     if (!user) {
//       return res.status(401).json({ message: "Invalid email or password" });
//     }

//     if (!user.isVerified) {
//       return res.status(401).json({ message: "Please verify your email before logging in!" });
//     }

//     // Compare Password
//     const isMatch = await bcrypt.compare(password, user.password);

//     if (!isMatch) {
//       return res.status(401).json({ message: "Invalid email or password" });
//     }

//     // Generate Token
//     const token = generateToken(user._id);

//     // ✅ Clean Response for Frontend LoginHero Component
//     res.status(200).json({
//       success: true,
//       token,
//       user: {
//         _id: user._id,
//         firstName: user.firstName,
//         lastName: user.lastName,
//         fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
//         email: user.email,
//         isProfileComplete: user.isProfileComplete || false,
//         completedStep: user.completedStep || 0,
//       },
//       message: "Login successful!",
//     });

//   } catch (error) {
//     console.error("Login Controller Error:", error);
//     res.status(500).json({ message: error.message });
//   }
// };



export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please provide both email and password" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isVerified) {
      return res.status(401).json({ message: "Please verify your email before logging in!" });
    }

    // Block login for deactivated accounts
    if (user.isActive === false) {
      return res.status(403).json({
        message: "Your account has been deactivated. Please contact support for assistance.",
      });
    }

    // Compare Password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate Token
    const token = generateToken(user._id);

    // ✅ Clean Response with Role included
    res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email,
        role: user.role || "user", // 👈 YEH FIELD ADD KIYA HAI
        isProfileComplete: user.isProfileComplete || false,
        completedStep: user.completedStep || 0,
      },
      message: "Login successful!",
    });

  } catch (error) {
    console.error("Login Controller Error:", error);
    res.status(500).json({ message: error.message });
  }
};


export const updateUserSettings = async (req, res) => {
  try {
    const { userId, firstName, lastName, phone, currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 1. Basic Info Update
    if (firstName) user.firstName = firstName.trim();
    if (lastName !== undefined) user.lastName = lastName.trim();
    if (phone) user.phone = phone.trim();

    // 2. Password Change Logic (if newPassword is provided)
    if (newPassword && newPassword.trim() !== "") {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Please enter your current password to set a new password",
        });
      }

      // Check current password match
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect!",
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
    }

    await user.save();

    // Sensitive data exclude karke return karein
    const updatedUserData = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role || "user",
    };

    return res.status(200).json({
      success: true,
      message: "Settings updated successfully!",
      user: updatedUserData,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating settings",
      error: error.message,
    });
  }
};