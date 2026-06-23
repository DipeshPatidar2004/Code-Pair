const { io } = require("socket.io-client");
const ACTIONS = require("../src/constants/Actions");

const socket = io("http://localhost:5000");

socket.on("connect", () => {
    console.log("Connected to server:", socket.id);
    
    socket.emit(ACTIONS.JOIN, { roomId: "testRoom", username: "testUser" });
});

socket.on(ACTIONS.JOINED, () => {
    console.log("Joined room successfully.");
    // Now trigger execution
    setTimeout(() => {
        console.log("Emitting EXECUTE_CODE...");
        socket.emit(ACTIONS.EXECUTE_CODE, { roomId: "testRoom", fileId: "1" }); // file 1 is index.js
    }, 1000);
});

socket.on(ACTIONS.EXECUTION_RESULT, (result) => {
    console.log("RECEIVED EXECUTION_RESULT:", result);
    if (result.status === 'success' || result.status === 'error') {
        process.exit(0);
    }
});

socket.on("connect_error", (err) => {
    console.error("Connection Error:", err.message);
    process.exit(1);
});
