import React from 'react';

const Footer = () => {
    return (
        <footer className="w-full bg-sidebar/80 backdrop-blur-md border-t border-border py-5 mt-auto relative z-10">
            <div className="max-w-6xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-[#6B6B6B] text-sm font-medium">
                    &copy; {new Date().getFullYear()} CodePair. All rights reserved.
                </div>
                <div className="flex items-center gap-2 text-sm text-[#6B6B6B] bg-[rgba(255,255,255,0.03)] px-4 py-2 rounded-full border border-border">
                    <span className="text-[#00C8FF] font-bold">Developed by</span>
                    <span className="font-semibold text-white">Avi Kedare</span>
                    <span>and</span>
                    <span className="font-semibold text-white">Dipesh Patidar</span>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
