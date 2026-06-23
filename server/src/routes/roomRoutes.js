const express = require('express');
const Room = require('../models/Room');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

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

// Get all rooms where user is creator OR participant
router.get('/', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const rooms = await Room.find({
            $or: [
                { creator: userId },
                { participants: userId }
            ]
        }).sort({ updatedAt: -1 });
        
        res.status(200).json(rooms);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Check whether a room exists for join flow validation
router.get('/:roomId', auth, async (req, res) => {
    try {
        const { roomId } = req.params;
        const room = await Room.findOne({ roomId });

        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        res.status(200).json({ roomId: room.roomId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create a new room
router.post('/', auth, async (req, res) => {
    try {
        const roomId = uuidv4();
        const userId = req.user.id;

        const newRoom = new Room({
            roomId,
            creator: userId,
            participants: [userId],
            files: getInitialFiles(),
            chats: []
        });

        await newRoom.save();
        res.status(201).json(newRoom);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete a room
router.delete('/:roomId', auth, async (req, res) => {
    try {
        const { roomId } = req.params;
        const userId = req.user.id;

        const room = await Room.findOne({ roomId });
        
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        // Only creator can delete
        if (room.creator && room.creator.toString() !== userId) {
            return res.status(403).json({ message: 'Only the room creator can delete this room' });
        }

        await Room.deleteOne({ roomId });
        res.status(200).json({ message: 'Room deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
