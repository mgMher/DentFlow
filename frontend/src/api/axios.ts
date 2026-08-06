import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
    baseURL: process.env.REACT_APP_API_BASE || 'http://localhost:8000/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('access-token');
        if (token && config.headers) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error),
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = localStorage.getItem('refresh-token');

            if (refreshToken) {
                try {
                    const { data } = await axios.post(
                        `${process.env.REACT_APP_API_BASE || 'http://localhost:8000/api'}/auth/refresh`,
                        { refreshToken },
                    );
                    const newToken = data.data?.accessToken || data.accessToken;
                    localStorage.setItem('access-token', newToken);
                    if (data.data?.refreshToken || data.refreshToken) {
                        localStorage.setItem('refresh-token', data.data?.refreshToken || data.refreshToken);
                    }
                    if (originalRequest.headers) {
                        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                    }
                    return api(originalRequest);
                } catch (refreshError) {
                    localStorage.removeItem('access-token');
                    localStorage.removeItem('refresh-token');
                    window.location.replace('/login');
                    return Promise.reject(refreshError);
                }
            } else {
                localStorage.removeItem('access-token');
                window.location.replace('/login');
            }
        }

        return Promise.reject(error.response || error);
    },
);

export default api;
