import React, { createContext, useContext, useState } from 'react';

const SocketContext = createContext(null);

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [connectedUsers, setConnectedUsers] = useState([]);

    return (
        <SocketContext.Provider value={{ socket, setSocket, connectedUsers, setConnectedUsers }}>
            {children}
        </SocketContext.Provider>
    );
};
