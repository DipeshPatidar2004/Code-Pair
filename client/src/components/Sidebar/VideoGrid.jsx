import React, { useRef, useEffect, useState } from 'react';
import { FiMic, FiMicOff, FiVideo, FiVideoOff } from 'react-icons/fi';

const VideoBox = ({ stream, username, isLocal = false, isPinned, onClick }) => {
    const videoRef = useRef(null);
    const [isMuted, setIsMuted] = useState(isLocal);
    const [isVideoOff, setIsVideoOff] = useState(false);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    const toggleAudio = (e) => {
        e.stopPropagation();
        if (stream) {
            stream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!stream.getAudioTracks()[0]?.enabled);
        }
    };

    const toggleVideo = (e) => {
        e.stopPropagation();
        if (stream) {
            stream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsVideoOff(!stream.getVideoTracks()[0]?.enabled);
        }
    };

    return (
        <div 
            onClick={onClick}
            className={`relative aspect-video bg-black flex items-center justify-center border border-border rounded-lg overflow-hidden w-full cursor-pointer transition-all ${isPinned ? 'ring-2 ring-blue-500' : 'hover:ring-1 hover:ring-gray-600'}`}
        >
            <div className="absolute top-2 left-2 z-10 bg-black/60 px-2 py-0.5 rounded text-xs text-white font-semibold shadow-sm">
                {username} {isLocal && '(You)'}
            </div>
            
            {isVideoOff || !stream ? (
                <div className="text-gray-500 flex flex-col items-center pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-xl text-white mb-1 shadow-inner">
                        {username?.charAt(0)?.toUpperCase()}
                    </div>
                </div>
            ) : (
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted={isLocal || isMuted} 
                    className="w-full h-full object-cover pointer-events-none"
                />
            )}
            
            {/* Controls */}
            {isLocal && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 bg-black/60 px-2 py-1 rounded-full z-10">
                    <button onClick={toggleAudio} className={`p-1.5 rounded-full transition-colors ${isMuted ? 'bg-red-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>
                        {isMuted ? <FiMicOff size={14} /> : <FiMic size={14} />}
                    </button>
                    <button onClick={toggleVideo} className={`p-1.5 rounded-full transition-colors ${isVideoOff ? 'bg-red-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>
                        {isVideoOff ? <FiVideoOff size={14} /> : <FiVideo size={14} />}
                    </button>
                </div>
            )}
            
            {/* Remote Muted Indicator */}
            {!isLocal && isMuted && (
                <div className="absolute bottom-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-md z-10">
                    <FiMicOff size={12} />
                </div>
            )}
        </div>
    );
};

const VideoGrid = ({ localStream, remoteStreams, connectedUsers, username }) => {
    const [pinnedId, setPinnedId] = useState(null);
    
    // Collect all valid streams to render
    const allStreams = [];
    
    if (localStream) {
        allStreams.push({ id: 'local', stream: localStream, username, isLocal: true });
    }
    
    Object.entries(remoteStreams).forEach(([socketId, stream]) => {
        const user = connectedUsers.find(u => u.socketId === socketId);
        if (stream) {
            allStreams.push({ id: socketId, stream, username: user?.username || 'Peer', isLocal: false });
        }
    });

    if (allStreams.length === 0) return null;

    // Filter streams if one is pinned
    const streamsToRender = pinnedId && allStreams.find(s => s.id === pinnedId) 
        ? [allStreams.find(s => s.id === pinnedId)] 
        : allStreams;

    const handlePin = (id) => {
        if (pinnedId === id) {
            setPinnedId(null); // Unpin if already pinned
        } else {
            setPinnedId(id);
        }
    };

    // Determine grid columns based on number of participants
    const numStreams = streamsToRender.length;
    let gridCols = "grid-cols-1";
    if (numStreams > 1) gridCols = "grid-cols-2";

    return (
        <div className={`grid ${gridCols} gap-2 p-3 bg-sidebar border-b border-border relative`}>
            {streamsToRender.map(s => (
                <VideoBox 
                    key={s.id} 
                    stream={s.stream} 
                    username={s.username} 
                    isLocal={s.isLocal} 
                    isPinned={pinnedId === s.id}
                    onClick={() => handlePin(s.id)}
                />
            ))}
            
            {pinnedId && (
                <div className="absolute top-1 right-1 text-[10px] bg-black/80 text-gray-400 px-1.5 py-0.5 rounded pointer-events-none z-20">
                    Click to unpin
                </div>
            )}
        </div>
    );
};

export default VideoGrid;
