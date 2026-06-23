import React, { useState, useEffect, useRef } from 'react';
import { ACTIONS } from '../../constants/Actions';
import { useSocket } from '../../context/SocketContext';
import { FiSend, FiMessageSquare } from 'react-icons/fi';
import VideoGrid from '../Sidebar/VideoGrid';

const ChatPanel = ({ roomId, username, localStream, remoteStreams, connectedUsers, style }) => {
    const { socket } = useSocket();
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (message) => {
            setMessages((prev) => [...prev, message]);
        };
        
        const handleSyncChat = ({ messages }) => {
            setMessages(messages);
        };

        socket.on(ACTIONS.CHAT_MESSAGE, handleNewMessage);
        socket.on('sync-chat', handleSyncChat);

        return () => {
            socket.off(ACTIONS.CHAT_MESSAGE, handleNewMessage);
            socket.off('sync-chat', handleSyncChat);
        };
    }, [socket]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!inputValue.trim() || !socket) return;

        const messageData = {
            username,
            text: inputValue,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            id: Date.now() + Math.random()
        };

        socket.emit(ACTIONS.CHAT_MESSAGE, { roomId, message: messageData });
        setMessages((prev) => [...prev, messageData]);
        setInputValue('');
    };

    return (
        <div className="chat-panel h-full w-full" style={style}>
            <div className="chat-panel-header">
                <div className="flex items-center gap-2">
                    <FiMessageSquare className="text-[#00C8FF]" /> Team Chat
                </div>
            </div>
            
            {/* Video Grid for WebRTC */}
            <VideoGrid 
                localStream={localStream}
                remoteStreams={remoteStreams}
                connectedUsers={connectedUsers}
                username={username}
            />
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-3 min-h-0">
                {messages.length === 0 ? (
                    <div className="text-[#6B6B6B] text-sm text-center mt-4">
                        No messages yet. Say hi!
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className={`flex flex-col ${msg.username === username ? 'items-end' : 'items-start'}`}>
                            <span className="text-xs text-[#6B6B6B] mb-1">{msg.username === username ? 'You' : msg.username} <span className="ml-1 text-[10px]">{msg.time}</span></span>
                            <div className={msg.username === username ? 'chat-bubble-self' : 'chat-bubble-other'}>
                                {msg.text}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-3 border-t border-border bg-sidebar flex gap-2 shrink-0">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 chat-input"
                />
                <button
                    type="submit"
                    disabled={!inputValue.trim()}
                    className="chat-send-btn"
                >
                    <FiSend />
                </button>
            </form>
        </div>
    );
};

export default ChatPanel;
