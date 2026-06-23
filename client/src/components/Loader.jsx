import React from 'react';

const Loader = () => {
    return (
        <div className="premium-loader">
            <div className="flex flex-col items-center gap-5">
                <div className="premium-loader-spinner"></div>
                <h2 className="text-lg font-semibold text-[#B3B3B3]">Connecting...</h2>
            </div>
        </div>
    );
};

export default Loader;
