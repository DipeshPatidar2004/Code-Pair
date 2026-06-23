import { io } from 'socket.io-client';

export const initSocket = async () => {
    const options = {
        'force new connection': true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        timeout: 10000,
        transports: ['websocket'],
    };
    return io(import.meta.env.VITE_SERVER_URL, options);
};
