const User = require('../models/User');
const OTP = require('../models/OTP');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomInt } = require('crypto');
const { sendOTPEmail } = require('../utils/email');

const generateOTP = () => randomInt(100000, 1000000).toString();
const ACCOUNT_VERIFICATION = 'account_verification';

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const replaceVerificationOTP = async (email, otp, registration) => {
    await OTP.deleteMany({ email, action: ACCOUNT_VERIFICATION });
    const pendingOTP = await OTP.create({
        email,
        otp,
        action: ACCOUNT_VERIFICATION,
        ...(registration ? { registration } : {})
    });

    try {
        await sendOTPEmail(email, otp, ACCOUNT_VERIFICATION);
    } catch (error) {
        await OTP.deleteOne({ _id: pendingOTP._id });
        throw error;
    }
};

exports.register = async (req, res) => {
    try {
        const body = req.body || {};
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = body.password;
        if (!name || !email || typeof password !== 'string' || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                message: existingUser.isVerified
                    ? 'User already exists'
                    : 'An unverified account already exists. Sign in to verify it.'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();
        await replaceVerificationOTP(email, otp, { name, password: hashedPassword });

        res.status(201).json({
            message: 'OTP sent to email. Please verify.',
            email
        });
    } catch (error) {
        console.error('Registration failed:', error);
        res.status(500).json({
            message: ['SMTP_CONFIG', 'SMTP_DELIVERY'].includes(error.code)
                ? error.message
                : 'Unable to send verification email. Check the server email configuration and try again.'
        });
    }
};

exports.login = async (req, res) => {
    try {
        const body = req.body || {};
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = body.password;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const isMatch = typeof password === 'string' && await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        if (!user.isVerified) {
            const otp = generateOTP();
            await replaceVerificationOTP(user.email, otp);
            return res.status(403).json({ message: 'Account not verified', needsVerification: true, email: user.email });
        }

        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user.id, user.role)
        });
    } catch (error) {
        console.error('Login failed:', error);
        res.status(500).json({ message: 'Unable to complete login. If your account needs verification, check the server email configuration.' });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const body = req.body || {};
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const otp = typeof body.otp === 'string' ? body.otp.trim() : '';
        const validOTP = await OTP.findOne({
            email,
            otp,
            action: ACCOUNT_VERIFICATION,
            createdAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) }
        });

        if (!validOTP) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        let user;
        if (validOTP.registration?.name && validOTP.registration?.password) {
            user = await User.create({
                name: validOTP.registration.name,
                email,
                password: validOTP.registration.password,
                role: 'user',
                isVerified: true
            });
        } else {
            user = await User.findOneAndUpdate({ email }, { isVerified: true }, { new: true });
            if (!user) {
                await OTP.deleteOne({ _id: validOTP._id });
                return res.status(400).json({ message: 'No account is awaiting verification' });
            }
        }

        await OTP.deleteOne({ _id: validOTP._id });
        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user.id, user.role)
        });
    } catch (error) {
        console.error('OTP verification failed:', error);
        if (error.code === 11000) {
            return res.status(409).json({ message: 'An account with this email already exists' });
        }
        res.status(500).json({ message: 'Unable to verify account' });
    }
};
