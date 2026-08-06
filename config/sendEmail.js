import nodemailer from "nodemailer";

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Rishta Point Verification" <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    text: options.text || `Your Rishta Point OTP code is: ${options.otp}`, // Plain text fallback (Important for anti-phishing)
    html: options.html,
    headers: {
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
      "Importance": "High",
    },
  };

  await transporter.sendMail(mailOptions);
};

export default sendEmail;