const User = require("../models/User");
const OTP = require("../models/OTP");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendOTPEmail } = require("../utils/email");

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const isSmtpAuthenticationError = (error) =>
  error.code === "EAUTH" || error.responseCode === 535;

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "user", // Hardcoded to prevent frontend passing role
      isVerified: false,
    });

    const otp = generateOTP();
    const otpRecord = await OTP.create({
      email,
      otp,
      action: "account_verification",
    });
    try {
      await sendOTPEmail(email, otp, "account_verification");
    } catch (emailError) {
      await OTP.deleteOne({ _id: otpRecord._id });
      throw emailError;
    }

    res.status(201).json({
      message: "OTP sent to email. Please verify.",
      email: user.email,
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (isSmtpAuthenticationError(error)) {
      return res.status(502).json({
        message:
          "Your account was created, but we could not send the verification email. Please try signing in again later.",
      });
    }
    res.status(500).json({ message: "Server Error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    if (!user.isVerified && user.role !== "admin") {
      const otp = generateOTP();
      await OTP.findOneAndDelete({
        email: user.email,
        action: "account_verification",
      });
      const otpRecord = await OTP.create({
        email: user.email,
        otp,
        action: "account_verification",
      });
      try {
        await sendOTPEmail(user.email, otp, "account_verification");
      } catch (emailError) {
        await OTP.deleteOne({ _id: otpRecord._id });
        throw emailError;
      }
      return res.status(403).json({
        message: "Account not verified",
        needsVerification: true,
        email: user.email,
      });
    }

    res.json({
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user.id, user.role),
    });
  } catch (error) {
    console.error("Login error:", error);
    if (isSmtpAuthenticationError(error)) {
      return res.status(502).json({
        message: "We could not send your verification email. Please try again later.",
      });
    }
    res.status(500).json({ message: "Server Error" });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const validOTP = await OTP.findOne({
      email,
      otp,
      action: "account_verification",
    });

    if (!validOTP) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const user = await User.findOneAndUpdate(
      { email },
      { isVerified: true },
      { new: true },
    );
    await OTP.deleteOne({ _id: validOTP._id }); // Delete OTP after usage

    res.json({
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user.id, user.role),
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};
