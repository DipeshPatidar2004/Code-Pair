const nodemailer = require('nodemailer');

const sendOtpEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email,
            subject: 'CodePair - Verify your email',
            html: `
                <div style="font-family: Arial, sans-serif; max-w-xl mx-auto p-5 border border-gray-200 rounded">
                    <h2>Welcome to CodePair!</h2>
                    <p>Thank you for registering. Please use the following OTP to verify your email address. It will expire in 10 minutes.</p>
                    <h1 style="color: #3B82F6; letter-spacing: 5px;">${otp}</h1>
                    <p>If you did not request this, please ignore this email.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending OTP email:', error);
        return false;
    }
};

module.exports = { sendOtpEmail };
