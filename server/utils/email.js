const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const sendEmail = async ({ to, subject, html }) => {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
        throw new Error('RESEND_API_KEY and EMAIL_FROM must be configured');
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: [to],
            subject,
            html,
        }),
        signal: AbortSignal.timeout(10000),
    });

    let result = {};
    try {
        result = await response.json();
    } catch {
        // Keep the HTTP status as the useful error when the provider has no JSON response.
    }

    if (!response.ok) {
        throw new Error(result.message || `Email provider returned HTTP ${response.status}`);
    }

    return result;
};

const sendBookingEmail = async (userEmail, userName, eventTitle) => {
    try {
        await sendEmail({
            to: userEmail,
            subject: `Booking Confirmed: ${eventTitle}`,
            html: `
        <h2>Hi ${userName}!</h2>
        <p>Your booking for the event <strong>${eventTitle}</strong> is successfully confirmed.</p>
        <p>Thank you for choosing Eventora.</p>
      `
        });
        console.log('Email sent successfully to', userEmail);
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

const sendOTPEmail = async (userEmail, otp, type) => {
    const title = type === 'account_verification' ? 'Verify your Eventora Account' : 'Eventora Booking Verification';
    const msg = type === 'account_verification'
        ? 'Please use the following OTP to verify your new Eventora account.'
        : 'Please use the following OTP to verify and confirm your event booking.';

    const mailOptions = {
        to: userEmail,
        subject: title,
        html: `
                <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                    <h2 style="color: #111;">${title}</h2>
                    <p style="color: #555; font-size: 16px;">${msg}</p>
                    <div style="margin: 20px auto; padding: 15px; font-size: 24px; font-weight: bold; background: #f4f4f4; width: max-content; letter-spacing: 5px;">
                        ${otp}
                    </div>
                    <p style="color: #999; font-size: 12px;">This code expires in 5 minutes. If you didn't request this, please ignore this email.</p>
                </div>
            `
    };
    try {
        await sendEmail(mailOptions);
    } catch (error) {
        console.error('Error sending OTP email:', error);
        throw error;
    }
    console.log(`OTP sent to ${userEmail} for ${type}`);
};

module.exports = { sendBookingEmail, sendOTPEmail };
