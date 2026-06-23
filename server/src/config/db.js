const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) {
            console.warn('⚠️ No MONGO_URI provided in .env. Skipping MongoDB connection. Data will not be saved.');
            return false;
        }

        await mongoose.connect(uri);
        console.log('✅ MongoDB Connected successfully.');
        return true;
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
