const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const getTransporter = () => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error('EMAIL_USER and EMAIL_PASS must be configured to send email');
    }

    const port = Number(process.env.SMTP_PORT || 465);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('SMTP_PORT must be a valid port number');
    }

    const secureSetting = process.env.SMTP_SECURE?.toLowerCase();
    if (secureSetting && secureSetting !== 'true' && secureSetting !== 'false') {
        throw new Error('SMTP_SECURE must be set to true or false');
    }
    const secure = secureSetting === undefined ? port === 465 : secureSetting === 'true';

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port,
        secure,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

const getFromAddress = () => {
    const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    if (process.env.NODE_ENV === 'production' && !process.env.EMAIL_FROM) {
        throw new Error('EMAIL_FROM must be set to a verified sender address in production');
    }
    return fromAddress;
};

const sendMail = async (mailOptions, recipient, messageType) => {
    const result = await getTransporter().sendMail(mailOptions);
    const recipientAccepted = result.accepted.some(
        (acceptedAddress) => acceptedAddress.toLowerCase() === recipient.toLowerCase()
    );

    if (!recipientAccepted) {
        throw new Error(`SMTP server did not accept ${messageType} for the recipient`);
    }

    console.log(`${messageType} accepted by SMTP`, {
        messageId: result.messageId,
        response: result.response,
        acceptedRecipients: result.accepted.length
    });
};

const sendBookingEmail = async (userEmail, userName, eventTitle) => {
    const mailOptions = {
        from: getFromAddress(),
        to: userEmail,
        subject: `Booking Confirmed: ${eventTitle}`,
        html: `
        <h2>Hi ${userName}!</h2>
        <p>Your booking for the event <strong>${eventTitle}</strong> is successfully confirmed.</p>
        <p>Thank you for choosing Eventora.</p>
      `
    };
    await sendMail(mailOptions, userEmail, 'Booking confirmation email');
};

const sendOTPEmail = async (userEmail, otp, type) => {
    const title = type === 'account_verification' ? 'Verify your Eventora Account' : 'Eventora Booking Verification';
    const msg = type === 'account_verification'
        ? 'Please use the following OTP to verify your new Eventora account.'
        : 'Please use the following OTP to verify and confirm your event booking.';

    const mailOptions = {
        from: getFromAddress(),
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

    await sendMail(mailOptions, userEmail, `OTP email (${type})`);
};

module.exports = { sendBookingEmail, sendOTPEmail };
