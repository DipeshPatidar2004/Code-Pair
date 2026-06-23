const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    language: { type: String, required: true },
    content: { type: String, default: '' }
});

const chatSchema = new mongoose.Schema({
    id: { type: String, required: true },
    username: { type: String, required: true },
    text: { type: String, required: true },
    time: { type: String, required: true }
});

const roomSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    files: [fileSchema],
    chats: [chatSchema]
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
