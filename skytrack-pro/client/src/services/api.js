import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 30000,
});

// Attach token from storage on each request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('skytrack_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 by redirecting to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('skytrack_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
