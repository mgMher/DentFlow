import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000/api';

export const ACCESS_TOKEN_KEY = 'access-token';
export const REFRESH_TOKEN_KEY = 'refresh-token';

const api = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * A 401 from these means "wrong credentials" or "refresh token rejected", not
 * "access token expired". Refreshing would be wrong, and redirecting used to
 * reload the login page and wipe the error the user needed to read.
 */
const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];

export const clearSession = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
};

const redirectToLogin = () => {
    clearSession();
    if (window.location.pathname !== '/login') {
        window.location.replace('/login');
    }
};

/**
 * The refresh in flight, shared by every request that got a 401 meanwhile.
 *
 * The server rotates the refresh token and treats a second use of the old one
 * as theft (it revokes the session). Without this, a page firing three calls
 * with an expired token sent three refreshes, and the second one logged the
 * user out.
 */
let refreshInFlight: Promise<string> | null = null;

const refreshAccessToken = (): Promise<string> => {
    if (!refreshInFlight) {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        refreshInFlight = (
            refreshToken
                ? axios
                      .post(`${API_BASE}/auth/refresh`, { refreshToken })
                      .then(({ data }) => {
                          const tokens = data?.data ?? data;
                          localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
                          localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
                          return tokens.accessToken as string;
                      })
                : Promise.reject(new Error('No refresh token'))
        ).finally(() => {
            refreshInFlight = null;
        });
    }
    return refreshInFlight;
};

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token && config.headers) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
        const isAuthCall = NO_REFRESH_PATHS.some((path) => originalRequest?.url?.includes(path));

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthCall) {
            originalRequest._retry = true;
            try {
                const newToken = await refreshAccessToken();
                originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                redirectToLogin();
                return Promise.reject(refreshError);
            }
        }

        // Callers read `err.data` (the API's `{ statusCode, message, code }` body).
        return Promise.reject(error.response || error);
    },
);

export default api;
