const ACTIONS = require('../constants/Actions');
const executeCode = require('../services/executeCode');
const Room = require('../models/Room');

const userSocketMap = {};
const roomCallUsers = {}; // Tracks who is actively in the WebRTC call
const fileUpdateBuffer = new Map(); // fileId -> { roomId, content, timeoutId }

function getAllConnectedClients(io, roomId) {
    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    return clients.map((socketId) => ({
        socketId,
        username: userSocketMap[socketId],
    }));
}

function getInitialFiles() {
    return [
        {
            id: '1',
            name: 'index.js',
            language: 'javascript',
            content: 'console.log("Hello Node.js!");\n'
        },
        {
            id: '2',
            name: 'main.cpp',
            language: 'cpp',
            content: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello C++!" << endl;\n    return 0;\n}'
        },
        {
            id: '3',
            name: 'Main.java',
            language: 'java',
            content: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello Java!");\n    }\n}'
        }
    ];
}

function debounceFileUpdate(roomId, fileId, content) {
    if (fileUpdateBuffer.has(fileId)) {
        clearTimeout(fileUpdateBuffer.get(fileId).timeoutId);
    }
    const timeoutId = setTimeout(async () => {
        try {
            await Room.updateOne(
                { roomId, "files.id": fileId },
                { $set: { "files.$.content": content } }
            );
        } catch (err) {
            console.error("DB update error", err);
        }
        fileUpdateBuffer.delete(fileId);
    }, 2000);
    fileUpdateBuffer.set(fileId, { roomId, content, timeoutId });
}

function handleSocketConnection(io) {
    io.on('connection', (socket) => {

        socket.on(ACTIONS.JOIN, async ({ roomId, username, userId }) => {
            if (!roomId || !username) {
                return socket.emit(ACTIONS.ERROR, { message: 'Username and Room ID are required' });
            }

            userSocketMap[socket.id] = username;
            socket.join(roomId);
            
            // Database operations
            let room;
            try {
                room = await Room.findOne({ roomId });
                if (!room) {
                    room = new Room({
                        roomId,
                        creator: userId,
                        participants: userId ? [userId] : [],
                        files: getInitialFiles(),
                        chats: []
                    });
                    await room.save();
                } else if (userId && (!room.participants || !room.participants.includes(userId))) {
                    // Add user to participants if not already there
                    room.participants.push(userId);
                    await room.save();
                }
            } catch (err) {
                console.error("MongoDB error on JOIN", err);
                return socket.emit(ACTIONS.ERROR, { message: 'Failed to connect to room database' });
            }

            if (!roomCallUsers[roomId]) {
                roomCallUsers[roomId] = [];
            }

            const clients = getAllConnectedClients(io, roomId);

            clients.forEach(({ socketId }) => {
                io.to(socketId).emit(ACTIONS.JOINED, {
                    clients,
                    username,
                    socketId: socket.id,
                });
            });
            
            socket.emit(ACTIONS.SYNC_FILES, { files: room.files });
            socket.emit('sync-chat', { messages: room.chats });
            socket.emit('sync-call-users', { callUsers: roomCallUsers[roomId] });
        });

        socket.on(ACTIONS.FILE_UPDATED, ({ roomId, fileId, content }) => {
            // Optimistically update other clients immediately
            socket.in(roomId).emit(ACTIONS.FILE_UPDATED, { fileId, content });
            // Debounce save to MongoDB
            debounceFileUpdate(roomId, fileId, content);
        });

        socket.on(ACTIONS.FILE_CREATED, async ({ roomId, file }) => {
            socket.in(roomId).emit(ACTIONS.FILE_CREATED, { file });
            try {
                await Room.updateOne(
                    { roomId },
                    { $push: { files: file } }
                );
            } catch (err) {
                console.error(err);
            }
        });

        socket.on(ACTIONS.FILE_RENAMED, async ({ roomId, fileId, newName, newLanguage }) => {
            socket.in(roomId).emit(ACTIONS.FILE_RENAMED, { fileId, newName, newLanguage });
            try {
                await Room.updateOne(
                    { roomId, "files.id": fileId },
                    { $set: { "files.$.name": newName, "files.$.language": newLanguage } }
                );
            } catch (err) {
                console.error(err);
            }
        });

        socket.on(ACTIONS.FILE_DELETED, async ({ roomId, fileId }) => {
            try {
                const room = await Room.findOne({ roomId });
                if (!room || !room.files || room.files.length <= 1) {
                    return;
                }

                if (!room.files.find(file => file.id === fileId)) {
                    return;
                }
            } catch (err) {
                console.error(err);
                return;
            }

            socket.in(roomId).emit(ACTIONS.FILE_DELETED, { fileId });
            if (fileUpdateBuffer.has(fileId)) {
                clearTimeout(fileUpdateBuffer.get(fileId).timeoutId);
                fileUpdateBuffer.delete(fileId);
            }
            try {
                await Room.updateOne(
                    { roomId },
                    { $pull: { files: { id: fileId } } }
                );
            } catch (err) {
                console.error(err);
            }
        });

        socket.on(ACTIONS.EXECUTE_CODE, async ({ roomId, fileId }) => {
            try {
                const room = await Room.findOne({ roomId });
                if (!room) throw new Error("Room not found");
                
                // If there's an active buffered write for this file, execute that instead of what's in DB
                let contentToRun = '';
                let languageToRun = '';
                let nameToRun = '';
                
                const file = room.files.find(f => f.id === fileId);
                if (!file) {
                    io.to(socket.id).emit(ACTIONS.EXECUTION_RESULT, {
                        status: 'error',
                        output: 'File not found on server.'
                    });
                    return;
                }
                
                contentToRun = fileUpdateBuffer.has(fileId) ? fileUpdateBuffer.get(fileId).content : file.content;
                languageToRun = file.language;
                nameToRun = file.name;

                io.to(roomId).emit(ACTIONS.EXECUTION_RESULT, { 
                    status: 'running', 
                    output: 'Compiling and executing locally...' 
                });

                const result = await executeCode(languageToRun, nameToRun, contentToRun);

                let finalOutput = '';
                let isError = false;

                if (result.error || result.stderr) {
                    isError = true;
                    finalOutput = result.stderr || result.error;
                } else {
                    finalOutput = result.stdout;
                }

                io.to(roomId).emit(ACTIONS.EXECUTION_RESULT, { 
                    status: isError ? 'error' : 'success', 
                    output: finalOutput || 'Executed successfully with no output.'
                });
            } catch (err) {
                console.error(err);
                io.to(roomId).emit(ACTIONS.EXECUTION_RESULT, { 
                    status: 'error', 
                    output: 'Execution failed: ' + err.message
                });
            }
        });

        socket.on(ACTIONS.CHAT_MESSAGE, async ({ roomId, message }) => {
            socket.in(roomId).emit(ACTIONS.CHAT_MESSAGE, message);
            try {
                await Room.updateOne(
                    { roomId },
                    { $push: { chats: message } }
                );
            } catch (err) {
                console.error(err);
            }
        });

        socket.on('JOIN_CALL', ({ roomId }) => {
            socket.join(`${roomId}-call`);
            if (roomCallUsers[roomId] && !roomCallUsers[roomId].includes(socket.id)) {
                roomCallUsers[roomId].push(socket.id);
            }
            socket.in(roomId).emit('USER_JOINED_CALL', { socketId: socket.id });
        });

        socket.on('LEAVE_CALL', ({ roomId }) => {
            if (roomCallUsers[roomId]) {
                roomCallUsers[roomId] = roomCallUsers[roomId].filter(id => id !== socket.id);
            }
            socket.leave(`${roomId}-call`);
            socket.in(roomId).emit('USER_LEFT_CALL', { socketId: socket.id });
        });

        socket.on(ACTIONS.CURSOR_MOVED, ({ roomId, cursorData }) => {
            socket.in(roomId).emit(ACTIONS.CURSOR_MOVED, cursorData);
        });

        socket.on(ACTIONS.WEBRTC_SIGNAL, ({ signal, to }) => {
            io.to(to).emit(ACTIONS.WEBRTC_SIGNAL, {
                signal,
                from: socket.id
            });
        });

        socket.on('disconnecting', () => {
            const rooms = [...socket.rooms];
            rooms.forEach((roomId) => {
                if (roomCallUsers[roomId]) {
                    roomCallUsers[roomId] = roomCallUsers[roomId].filter(id => id !== socket.id);
                    socket.in(roomId).emit('USER_LEFT_CALL', { socketId: socket.id });
                }
                socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                    socketId: socket.id,
                    username: userSocketMap[socket.id],
                });
            });
            delete userSocketMap[socket.id];
            socket.leave();
        });
    });
}

module.exports = handleSocketConnection;
