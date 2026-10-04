const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const { isIP } = require('net');

dotenv.config();

const smtpConfigurationError = (message) => {
    const error = new Error(message);
    error.code = 'SMTP_CONFIG';
    return error;
};

const getSMTPConfig = () => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw smtpConfigurationError('EMAIL_USER and EMAIL_PASS must be configured to send email');
    }

    const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    if (!host || /\s/.test(host) || (!isIP(host) && !/^[a-zA-Z0-9.-]+$/.test(host))) {
        throw smtpConfigurationError('SMTP_HOST must be a valid SMTP hostname');
    }

    const port = Number(process.env.SMTP_PORT || 465);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw smtpConfigurationError('SMTP_PORT must be a valid port number');
    }

    const secureSetting = process.env.SMTP_SECURE?.trim().toLowerCase();
    if (secureSetting && secureSetting !== 'true' && secureSetting !== 'false') {
        throw smtpConfigurationError('SMTP_SECURE must be set to true or false');
    }
    const secure = secureSetting === undefined ? port === 465 : secureSetting === 'true';

    if (process.env.NODE_ENV === 'production') {
        if (host.toLowerCase() === 'smtp.gmail.com') {
            throw smtpConfigurationError('Gmail SMTP is not reachable from Render. Configure an SMTP relay host and its SMTP credentials in Render environment variables.');
        }
        if ([25, 465, 587].includes(port)) {
            throw smtpConfigurationError(`Render cannot connect to SMTP port ${port}. Configure your SMTP relay to use a supported port such as 2525.`);
        }
    }

    return { host, port, secure };
};

const sendMail = async (mailOptions) => {
    const config = getSMTPConfig();
    const transporter = nodemailer.createTransport({
        ...config,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    try {
        return await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('SMTP delivery failed', {
            host: config.host,
            port: config.port,
            secure: config.secure,
            code: error.code,
            command: error.command,
            responseCode: error.responseCode
        });

        const smtpError = new Error(
            error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION'
                ? `Cannot connect to SMTP server ${config.host}:${config.port}. On Render, use an SMTP relay that supports port 2525; Gmail SMTP is not reachable.`
                : error.code === 'EAUTH' || error.responseCode === 535
                    ? 'SMTP authentication failed. Check EMAIL_USER and EMAIL_PASS against the SMTP relay credentials.'
                    : 'SMTP rejected the email. Check the SMTP settings and sender address.'
        );
        smtpError.code = 'SMTP_DELIVERY';
        throw smtpError;
    }
};

const getFromAddress = () => process.env.EMAIL_FROM || process.env.EMAIL_USER;

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
    await sendMail(mailOptions);
    console.log('Booking confirmation email sent successfully to', userEmail);
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

    await sendMail(mailOptions);
    console.log(`OTP sent to ${userEmail} for ${type}`);
};

module.exports = { sendBookingEmail, sendOTPEmail };
