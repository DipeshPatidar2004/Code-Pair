import React, { useRef, useEffect, useState } from 'react';
import Draggable from 'react-draggable';
import { FiMic, FiMicOff, FiVideo, FiVideoOff } from 'react-icons/fi';

const DraggableVideo = ({ stream, username, isLocal = false }) => {
    const videoRef = useRef(null);
    const [isMuted, setIsMuted] = useState(isLocal);
    const [isVideoOff, setIsVideoOff] = useState(false);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    const toggleAudio = () => {
        if (stream) {
            stream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!stream.getAudioTracks()[0]?.enabled);
        }
    };

    const toggleVideo = () => {
        if (stream) {
            stream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsVideoOff(!stream.getVideoTracks()[0]?.enabled);
        }
    };

    return (
        <Draggable bounds="parent" handle=".handle">
            <div className="absolute top-4 right-4 bg-gray-900 rounded-lg overflow-hidden shadow-xl border border-gray-700 z-50 flex flex-col min-w-[150px] min-h-[100px]" style={{ resize: 'both' }}>
                {/* Drag Handle */}
                <div className="handle bg-gray-800 p-1 cursor-grab active:cursor-grabbing text-center text-xs text-gray-400 font-semibold truncate shrink-0">
                    {username} {isLocal && '(You)'}
                </div>
                
                {/* Video Stream */}
                <div className="relative flex-1 bg-black flex items-center justify-center">
                    {isVideoOff ? (
                        <div className="text-gray-500 flex flex-col items-center">
                            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-lg text-white mb-1">
                                {username?.charAt(0)?.toUpperCase()}
                            </div>
                        </div>
                    ) : (
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            muted={isLocal || isMuted} 
                            className="w-full h-full object-cover"
                        />
                    )}
                    
                    {/* Controls */}
                    {isLocal && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 bg-black/60 px-2 py-1 rounded-full">
                            <button onClick={toggleAudio} className={`p-1.5 rounded-full ${isMuted ? 'bg-red-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>
                                {isMuted ? <FiMicOff size={14} /> : <FiMic size={14} />}
                            </button>
                            <button onClick={toggleVideo} className={`p-1.5 rounded-full ${isVideoOff ? 'bg-red-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>
                                {isVideoOff ? <FiVideoOff size={14} /> : <FiVideo size={14} />}
                            </button>
                        </div>
                    )}
                    
                    {/* Remote Muted Indicator */}
                    {!isLocal && isMuted && (
                        <div className="absolute bottom-2 right-2 bg-red-500 text-white p-1 rounded-full">
                            <FiMicOff size={12} />
                        </div>
                    )}
                </div>
            </div>
        </Draggable>
    );
};

export default DraggableVideo;
