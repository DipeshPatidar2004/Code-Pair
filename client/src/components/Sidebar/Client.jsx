import React from 'react';

const Client = ({ username }) => {
    const getInitials = (name) => {
        return name ? name.substring(0, 2).toUpperCase() : '?';
    };

    return (
        <div className="flex flex-col items-center mb-3">
            <div className="client-avatar mb-1.5">
                {getInitials(username)}
            </div>
            <span className="text-xs font-medium text-[#B3B3B3] truncate max-w-[60px]">{username}</span>
        </div>
    );
};

export default Client;
