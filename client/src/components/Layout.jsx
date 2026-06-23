import React from 'react';
import Footer from './Navbar/Footer';

const Layout = ({ children }) => {
    return (
        <div className="flex flex-col min-h-screen bg-background text-text">
            {/* Abstract geometric background shapes */}
            <div className="bg-shapes-container">
                <div className="bg-shape bg-shape-1"></div>
                <div className="bg-shape bg-shape-2"></div>
                <div className="bg-shape bg-shape-3"></div>
                <div className="bg-shape bg-shape-4"></div>
            </div>

            {/* Main Content */}
            <main className="flex-grow flex flex-col relative z-10">
                {children}
            </main>

            {/* Global Footer */}
            <Footer />
        </div>
    );
};

export default Layout;
