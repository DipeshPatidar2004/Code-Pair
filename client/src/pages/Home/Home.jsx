import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiCode, FiMail, FiLock, FiUser, FiArrowRight, FiEye, FiEyeOff } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Spinner from '../../components/Spinner';

const Home = () => {
    const navigate = useNavigate();
    const { login, register, verifyOtp, user } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [step, setStep] = useState(1); // 1: form, 2: otp
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');

    useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            if (isLogin) {
                if (!email || !password) return toast.error("Please fill all fields");
                const success = await login(email, password);
                if (success) navigate('/dashboard');
            } else {
                if (step === 1) {
                    if (!username || !email || !password) return toast.error("Please fill all fields");
                    const success = await register(username, email, password);
                    if (success) setStep(2);
                } else {
                    if (!otp) return toast.error("Please enter the OTP");
                    const success = await verifyOtp(email, otp);
                    if (success) navigate('/dashboard');
                }
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-grow items-center justify-center p-4 lg:p-12 relative z-10 selection:bg-[#00C8FF]/30 selection:text-white">
            <div className="workspace-wrapper flex flex-col lg:flex-row w-full max-w-5xl min-h-[550px] lg:h-[600px] overflow-hidden">
                {/* Left Side - Branding */}
                <div className="hidden lg:flex w-1/2 bg-[#2A2A2A]/80 flex-col justify-center px-12 relative overflow-hidden border-r border-[rgba(255,255,255,0.08)]">
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00C8FF] to-[#C586C0] flex items-center justify-center text-white shadow-xl shadow-[#00C8FF]/15">
                                <FiCode className="w-8 h-8" />
                            </div>
                            <span className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">CodePair</span>
                        </div>
                        <h1 className="text-5xl font-bold leading-tight mb-6">Code Together,<br/>Build Faster.</h1>
                        <p className="text-lg text-[#B3B3B3] mb-8 leading-relaxed">
                            Production-grade real-time collaborative coding environment. Complete with native execution, WebRTC video calling, and instant synchronisation.
                        </p>
                    </div>
                    {/* Decorative subtle background circle */}
                    <div className="absolute top-1/2 -translate-y-1/2 -right-40 w-96 h-96 bg-[#00C8FF]/10 rounded-full blur-[100px] pointer-events-none"></div>
                </div>

                {/* Right Side - Auth Forms */}
                <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-12 bg-[#1E1E1E]/60 backdrop-blur-md">
                    <div className="w-full max-w-md">
                        
                        <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00C8FF] to-[#C586C0] flex items-center justify-center text-white shadow-xl">
                                <FiCode className="w-7 h-7" />
                            </div>
                            <span className="text-3xl font-extrabold tracking-tight text-white">CodePair</span>
                        </div>

                        <div className="mb-8">
                            <h2 className="text-3xl font-bold mb-2 text-white">
                                {isLogin ? 'Welcome back' : step === 1 ? 'Create an account' : 'Verify your email'}
                            </h2>
                            <p className="text-[#B3B3B3] text-base">
                                {isLogin 
                                    ? 'Enter your details to access your dashboard.' 
                                    : step === 1 
                                        ? 'Join thousands of developers coding together.'
                                        : `We sent a 6-digit code to ${email}`
                                }
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {step === 1 && !isLogin && (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Username</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                                            <FiUser size={18} />
                                        </div>
                                        <input
                                            type="text"
                                            className="w-full pl-12 pr-4 py-3 premium-input placeholder-gray-500"
                                            placeholder="johndoe"
                                            value={username}
                                            onChange={e => setUsername(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            {step === 1 && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email Address</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                                                <FiMail size={18} />
                                            </div>
                                            <input
                                                type="email"
                                                className="w-full pl-12 pr-4 py-3 premium-input placeholder-gray-500"
                                                placeholder="you@example.com"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Password</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                                                <FiLock size={18} />
                                            </div>
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                className="w-full pl-12 pr-12 py-3 premium-input placeholder-gray-500"
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
                                            >
                                                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {step === 2 && !isLogin && (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center block">6-Digit OTP</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            maxLength="6"
                                            className="w-full px-4 py-4 text-center tracking-[1em] font-bold text-2xl premium-input placeholder-gray-500"
                                            placeholder="------"
                                            value={otp}
                                            onChange={e => setOtp(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            <button 
                                type="submit"
                                disabled={isLoading}
                                className="w-full premium-btn-primary py-3.5 flex items-center justify-center gap-2 mt-6 cursor-pointer shadow-lg shadow-[#00C8FF]/10"
                            >
                                {isLoading ? <Spinner size="sm" /> : (isLogin ? 'Sign In' : step === 1 ? 'Continue' : 'Verify Account')} 
                                {!isLoading && <FiArrowRight />}
                            </button>
                        </form>

                        {step === 1 && (
                            <div className="mt-8 text-center text-sm text-[#B3B3B3]">
                                {isLogin ? "Don't have an account? " : "Already have an account? "}
                                <button 
                                    onClick={() => setIsLogin(!isLogin)}
                                    className="text-[#00C8FF] hover:text-[#C586C0] font-bold transition-colors cursor-pointer"
                                >
                                    {isLogin ? 'Sign up' : 'Log in'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


export default Home;
