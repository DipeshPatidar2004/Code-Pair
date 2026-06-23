const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { sendOtpEmail } = require('../utils/mailer');

const router = express.Router();

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP
};

router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if user exists and is verified
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            if (existingUser.isVerified) {
                return res.status(400).json({ message: 'User already exists' });
            }
        } else {
            // Create unverified user
            const newUser = new User({ username, email, password });
            await newUser.save();
        }

        // Generate OTP
        const otp = generateOTP();
        
        // Save OTP
        await Otp.deleteMany({ email }); // clear previous
        const newOtp = new Otp({ email, otp });
        await newOtp.save();

        // Send Email
        const emailSent = await sendOtpEmail(email, otp);
        if (!emailSent) {
            return res.status(500).json({ message: 'Failed to send OTP email. Check server SMTP config.' });
        }

        res.status(200).json({ message: 'OTP sent to email. Please verify.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }

        const otpRecord = await Otp.findOne({ email, otp });
        if (!otpRecord) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        user.isVerified = true;
        await user.save();
        
        // Delete the used OTP
        await Otp.deleteMany({ email });

        // Generate JWT
        const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });

        res.status(200).json({ 
            message: 'Email verified successfully', 
            token, 
            user: { id: user._id, username: user.username, email: user.email } 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        if (!user.isVerified) {
            return res.status(400).json({ message: 'Please verify your email first' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });

        res.status(200).json({ 
            message: 'Login successful', 
            token, 
            user: { id: user._id, username: user.username, email: user.email } 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
