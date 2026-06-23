import axios from 'axios';

const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${serverUrl}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('codepair_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
