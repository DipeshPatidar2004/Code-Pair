import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'simple-peer';
import { ACTIONS } from '../constants/Actions';
import toast from 'react-hot-toast';

export const useWebRTC = (socket, roomId, username, connectedUsers, callUsers = []) => {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({});
    const peersRef = useRef({});

    const joinCall = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            
            socket.emit('JOIN_CALL', { roomId });

            // For every OTHER user who is ALREADY in the call
            const activeCallUsers = connectedUsers.filter(u => callUsers.includes(u.socketId));
            
            activeCallUsers.forEach(user => {
                if (user.socketId === socket.id) return;

                if (peersRef.current[user.socketId]) {
                    try {
                        peersRef.current[user.socketId].addStream(stream);
                    } catch (e) {
                        console.error("Failed to add stream to existing peer", e);
                    }
                } else {
                    const peer = new Peer({
                        initiator: true,
                        trickle: false,
                        stream,
                    });

                    peer.on('signal', signal => {
                        socket.emit(ACTIONS.WEBRTC_SIGNAL, { to: user.socketId, signal });
                    });

                    peer.on('stream', remoteStream => {
                        setRemoteStreams(prev => ({ ...prev, [user.socketId]: remoteStream }));
                    });

                    peersRef.current[user.socketId] = peer;
                }
            });
        } catch (err) {
            console.error("Failed to get local stream", err);
            toast.error("Camera/Microphone permission denied");
        }
    };

    const leaveCall = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        
        socket.emit('LEAVE_CALL', { roomId });
        
        Object.values(peersRef.current).forEach(peer => peer.destroy());
        peersRef.current = {};
        setRemoteStreams({});
    };

    useEffect(() => {
        if (!socket) return;

        const handleWebRTCSignal = async ({ from, signal }) => {
            // Only process signals if we are actually in the call ourselves
            if (!localStream) return;

            let peer = peersRef.current[from];

            if (!peer) {
                peer = new Peer({
                    initiator: false,
                    trickle: false,
                    stream: localStream || undefined,
                });

                peer.on('signal', answerSignal => {
                    socket.emit(ACTIONS.WEBRTC_SIGNAL, { to: from, signal: answerSignal });
                });

                peer.on('stream', remoteStream => {
                    setRemoteStreams(prev => ({ ...prev, [from]: remoteStream }));
                });

                peersRef.current[from] = peer;
            }

            peer.signal(signal);
        };

        const handleUserDisconnected = ({ socketId }) => {
            if (peersRef.current[socketId]) {
                peersRef.current[socketId].destroy();
                delete peersRef.current[socketId];
            }
            setRemoteStreams(prev => {
                const newStreams = { ...prev };
                delete newStreams[socketId];
                return newStreams;
            });
        };

        socket.on(ACTIONS.WEBRTC_SIGNAL, handleWebRTCSignal);
        socket.on(ACTIONS.DISCONNECTED, handleUserDisconnected);
        socket.on('USER_LEFT_CALL', handleUserDisconnected);

        return () => {
            socket.off(ACTIONS.WEBRTC_SIGNAL, handleWebRTCSignal);
            socket.off(ACTIONS.DISCONNECTED, handleUserDisconnected);
            socket.off('USER_LEFT_CALL', handleUserDisconnected);
        };
    }, [socket, localStream]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            Object.values(peersRef.current).forEach(peer => peer.destroy());
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return { localStream, remoteStreams, joinCall, leaveCall };
};
