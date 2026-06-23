import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('codepair_token') || null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            localStorage.setItem('codepair_token', token);
            // We could add a /me route to fetch user profile, but for now we decode from local storage if we stored user info,
            // or rely on login to set it.
            // Let's decode the JWT manually since it has the user info
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                setUser(JSON.parse(jsonPayload));
            } catch (e) {
                console.error("Invalid token", e);
                logout();
            }
        } else {
            localStorage.removeItem('codepair_token');
            setUser(null);
        }
        setLoading(false);
    }, [token]);

    const login = async (email, password) => {
        try {
            const res = await api.post('/auth/login', { email, password });
            setToken(res.data.token);
            setUser(res.data.user);
            toast.success(res.data.message);
            return true;
        } catch (err) {
            toast.error(err.response?.data?.message || 'Login failed');
            return false;
        }
    };

    const register = async (username, email, password) => {
        try {
            const res = await api.post('/auth/register', { username, email, password });
            toast.success(res.data.message);
            return true;
        } catch (err) {
            toast.error(err.response?.data?.message || 'Registration failed');
            return false;
        }
    };

    const verifyOtp = async (email, otp) => {
        try {
            const res = await api.post('/auth/verify-otp', { email, otp });
            setToken(res.data.token);
            setUser(res.data.user);
            toast.success(res.data.message);
            return true;
        } catch (err) {
            toast.error(err.response?.data?.message || 'Verification failed');
            return false;
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        toast.success('Logged out successfully');
    };

    const value = {
        user,
        token,
        loading,
        api,
        login,
        register,
        verifyOtp,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
