import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiPlus, FiTrash2, FiLogOut, FiUsers, FiCode, FiLogIn } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { v4 as uuidV4 } from 'uuid';
import Spinner from '../../components/Spinner';
import api from '../../services/api';

const Dashboard = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
    const [roomIdToJoin, setRoomIdToJoin] = useState('');
    const [isJoiningRoom, setIsJoiningRoom] = useState(false);

    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            const res = await api.get('/rooms');
            setRooms(res.data);
        } catch (err) {
            toast.error("Failed to fetch rooms");
        } finally {
            setIsLoading(false);
        }
    };

    const createNewRoom = () => {
        const roomId = uuidV4();
        navigate(`/editor/${roomId}`, {
            state: { username: user?.username },
        });
    };

    const joinRoom = (roomId) => {
        navigate(`/editor/${roomId}`, {
            state: { username: user?.username },
        });
    };

    const openJoinRoomModal = () => {
        setRoomIdToJoin('');
        setIsJoinModalOpen(true);
    };

    const closeJoinRoomModal = () => {
        if (isJoiningRoom) return;
        setIsJoinModalOpen(false);
        setRoomIdToJoin('');
    };

    const handleJoinExistingRoom = async (event) => {
        event.preventDefault();

        const normalizedRoomId = roomIdToJoin.trim();
        if (!normalizedRoomId) {
            toast.error('Please enter a Room ID');
            return;
        }

        setIsJoiningRoom(true);
        try {
            await api.get(`/rooms/${normalizedRoomId}`);
            toast.success('Room found. Joining now.');
            setIsJoinModalOpen(false);
            setRoomIdToJoin('');
            joinRoom(normalizedRoomId);
        } catch (err) {
            const message = err.response?.data?.message || 'Room not found';
            toast.error(message);
        } finally {
            setIsJoiningRoom(false);
        }
    };

    const deleteRoom = async (roomId) => {
        if (!confirm('Are you sure you want to delete this room permanently?')) return;
        
        try {
            await api.delete(`/rooms/${roomId}`);
            toast.success("Room deleted");
            setRooms(rooms.filter(r => r.roomId !== roomId));
        } catch (err) {
            toast.error("Failed to delete room");
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="flex-1 w-full p-6 lg:p-10 relative z-10">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 premium-glass-card p-6">
                    <div className="flex items-center gap-4 mb-4 md:mb-0">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00C8FF] to-[#C586C0] flex items-center justify-center text-white shadow-lg shadow-[#00C8FF]/15">
                            <FiCode size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Welcome, {user?.username}</h1>
                            <p className="text-sm text-[#6B6B6B]">{user?.email}</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={createNewRoom}
                            className="premium-btn-primary px-6 py-3 flex items-center gap-2 shadow-lg shadow-[#00C8FF]/15"
                        >
                            <FiPlus size={18} />
                            New Room
                        </button>
                        <button
                            onClick={openJoinRoomModal}
                            className="premium-btn-secondary px-6 py-3 flex items-center gap-2"
                        >
                            <FiLogIn size={18} />
                            Join Room
                        </button>
                        <button 
                            onClick={handleLogout}
                            className="premium-btn-secondary px-6 py-3 flex items-center gap-2 text-red-400 border-red-500/20 hover:border-red-500/40 hover:text-red-300"
                        >
                            <FiLogOut size={18} />
                            Logout
                        </button>
                    </div>
                </div>

                {/* Rooms Grid */}
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-[#B3B3B3]">
                    <FiUsers /> Your Recent Rooms
                </h2>
                
                {isLoading ? (
                    <div className="flex justify-center items-center py-20">
                        <Spinner size="lg" className="text-[#00C8FF]" />
                    </div>
                ) : rooms.length === 0 ? (
                    <div className="text-center py-20 premium-glass-card border-dashed">
                        <div className="w-16 h-16 rounded-2xl bg-[rgba(255,255,255,0.04)] flex items-center justify-center mx-auto mb-4 text-[#6B6B6B]">
                            <FiCode size={28} />
                        </div>
                        <h3 className="text-xl font-semibold text-[#B3B3B3] mb-2">No rooms found</h3>
                        <p className="text-[#6B6B6B]">Create a new room to start collaborating!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {rooms.map((room) => (
                            <div key={room.roomId} className="dashboard-card group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-11 h-11 rounded-xl bg-[rgba(255,255,255,0.04)] border border-border flex items-center justify-center text-[#00C8FF]">
                                        <FiCode size={18} />
                                    </div>
                                    {room.creator === user?.id && (
                                        <button 
                                            onClick={() => deleteRoom(room.roomId)}
                                            className="text-[#6B6B6B] hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete Room"
                                        >
                                            <FiTrash2 size={16} />
                                        </button>
                                    )}
                                </div>
                                <h3 className="text-base font-bold mb-1 truncate text-white" title={room.roomId}>
                                    Room: {room.roomId.split('-')[0]}...
                                </h3>
                                <p className="text-sm text-[#6B6B6B] mb-6 flex items-center gap-2">
                                    <FiUsers size={14} />
                                    {room.participants.length} Participant(s)
                                </p>
                                <button 
                                    onClick={() => joinRoom(room.roomId)}
                                    className="w-full py-2.5 text-sm premium-btn-secondary hover:bg-[rgba(0,200,255,0.08)] hover:text-[#00C8FF] hover:border-[rgba(0,200,255,0.25)]"
                                >
                                    Join Room
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isJoinModalOpen && (
                <div className="file-delete-modal-backdrop" role="presentation" onClick={closeJoinRoomModal}>
                    <div
                        className="file-delete-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="join-room-title"
                        aria-describedby="join-room-description"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="file-delete-modal-icon">
                            <FiLogIn className="w-5 h-5 text-[#00C8FF]" />
                        </div>
                        <div className="space-y-2">
                            <h3 id="join-room-title" className="text-base font-semibold text-white">
                                Join existing room
                            </h3>
                            <p id="join-room-description" className="text-sm text-[#AAB2BD]">
                                Enter the Room ID shared by another collaborator.
                            </p>
                        </div>
                        <form className="space-y-4" onSubmit={handleJoinExistingRoom}>
                            <div className="space-y-2">
                                <label htmlFor="room-id-input" className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Room ID
                                </label>
                                <input
                                    id="room-id-input"
                                    type="text"
                                    className="w-full premium-input"
                                    placeholder="Paste the Room ID here"
                                    value={roomIdToJoin}
                                    onChange={(event) => setRoomIdToJoin(event.target.value)}
                                    autoComplete="off"
                                    spellCheck="false"
                                />
                            </div>
                            <div className="file-delete-modal-actions">
                                <button
                                    type="button"
                                    className="toolbar-btn toolbar-btn-secondary"
                                    onClick={closeJoinRoomModal}
                                    disabled={isJoiningRoom}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="toolbar-btn toolbar-btn-run"
                                    disabled={isJoiningRoom}
                                >
                                    {isJoiningRoom ? 'Joining...' : 'Join'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
