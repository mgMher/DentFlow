import { call, put, takeLatest } from 'redux-saga/effects';
import api from '../../api/axios';
import { httpActions } from '../http';
import { UserProfile, LoginRequest, RegisterRequest, AuthResponse } from '../../types';

// ── Action Types ──────────────────────────────────────────────────────────────

const LOGIN = 'LOGIN';
const LOGIN_SUCCESS = 'LOGIN_SUCCESS';
const LOGOUT = 'LOGOUT';
const GET_PROFILE = 'GET_PROFILE';
const GET_PROFILE_SUCCESS = 'GET_PROFILE_SUCCESS';
const REGISTER = 'REGISTER';

// ── Actions ───────────────────────────────────────────────────────────────────

export const authActions = {
    login: (payload: LoginRequest) => ({ type: LOGIN, payload }),
    loginSuccess: (payload: UserProfile) => ({ type: LOGIN_SUCCESS, payload }),
    logout: () => ({ type: LOGOUT }),
    getProfile: () => ({ type: GET_PROFILE }),
    getProfileSuccess: (payload: UserProfile) => ({ type: GET_PROFILE_SUCCESS, payload }),
    register: (payload: RegisterRequest) => ({ type: REGISTER, payload }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    login: (data: LoginRequest) => api.post<AuthResponse>('/auth/login', data),
    register: (data: RegisterRequest) => api.post<AuthResponse>('/auth/register', data),
    logout: () => api.post('/auth/logout'),
    getProfile: () => api.get<{ data: UserProfile }>('/auth/me'),
    refreshToken: (token: string) => api.post('/auth/refresh', { refreshToken: token }),
};

// ── Sagas ─────────────────────────────────────────────────────────────────────

function* loginSaga(action: ReturnType<typeof authActions.login>) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.login, action.payload);
        const data = res.data?.data || res.data;
        localStorage.setItem('access-token', data.accessToken);
        localStorage.setItem('refresh-token', data.refreshToken);
        yield put({ type: LOGIN_SUCCESS, payload: data.user });
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Login failed'));
    }
}

function* registerSaga(action: ReturnType<typeof authActions.register>) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.register, action.payload);
        const data = res.data?.data || res.data;
        localStorage.setItem('access-token', data.accessToken);
        localStorage.setItem('refresh-token', data.refreshToken);
        yield put({ type: LOGIN_SUCCESS, payload: data.user });
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Registration failed'));
    }
}

function* logoutSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.logout);
        localStorage.removeItem('access-token');
        localStorage.removeItem('refresh-token');
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        localStorage.removeItem('access-token');
        localStorage.removeItem('refresh-token');
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Logout failed'));
    }
}

function* getProfileSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getProfile);
        yield put({ type: GET_PROFILE_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load profile'));
    }
}

export function* watchAuth() {
    yield takeLatest(LOGIN, loginSaga);
    yield takeLatest(REGISTER, registerSaga);
    yield takeLatest(LOGOUT, logoutSaga);
    yield takeLatest(GET_PROFILE, getProfileSaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface AuthState {
    user: UserProfile | null;
    isAuthenticated: boolean;
}

const initialState: AuthState = {
    user: null,
    isAuthenticated: !!localStorage.getItem('access-token'),
};

export const authReducer = (state = initialState, action: any): AuthState => {
    switch (action.type) {
        case LOGIN_SUCCESS:
        case GET_PROFILE_SUCCESS:
            return { ...state, user: action.payload, isAuthenticated: true };
        case LOGOUT:
            return { ...state, user: null, isAuthenticated: false };
        default:
            return state;
    }
};
