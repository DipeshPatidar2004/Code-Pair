const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = require('./src/app');
const socketHandler = require('./src/config/socket');
const connectDB = require('./src/config/db');
const { initAI } = require('./src/services/aiService');

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*', // allow all in phase 1
        methods: ['GET', 'POST']
    }
});

// Connect to MongoDB & initialize AI
connectDB().then(() => {
    console.log("DB connection routine finished.");
    initAI();
});

socketHandler(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
