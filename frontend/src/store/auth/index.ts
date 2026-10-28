import { call, put, takeLatest } from 'redux-saga/effects';
import api, { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, clearSession } from '../../api/axios';
import { apiErrorMessage } from '../../utils/apiError';
import { clinicActions } from '../clinic';
import { httpActions } from '../http';
import { UserProfile, LoginRequest, RegisterRequest, AuthResponse } from '../../types';

// ── Action Types ──────────────────────────────────────────────────────────────

const LOGIN = 'LOGIN';
const LOGIN_SUCCESS = 'LOGIN_SUCCESS';
const LOGOUT = 'LOGOUT';
const GET_PROFILE = 'GET_PROFILE';
const GET_PROFILE_SUCCESS = 'GET_PROFILE_SUCCESS';
const REGISTER = 'REGISTER';
const CHANGE_PASSWORD = 'CHANGE_PASSWORD';
const LOGOUT_ALL = 'LOGOUT_ALL';

// ── Actions ───────────────────────────────────────────────────────────────────

export const authActions = {
    login: (payload: LoginRequest) => ({ type: LOGIN, payload }),
    loginSuccess: (payload: UserProfile) => ({ type: LOGIN_SUCCESS, payload }),
    logout: () => ({ type: LOGOUT }),
    getProfile: () => ({ type: GET_PROFILE }),
    getProfileSuccess: (payload: UserProfile) => ({ type: GET_PROFILE_SUCCESS, payload }),
    register: (payload: RegisterRequest) => ({ type: REGISTER, payload }),
    changePassword: (payload: { currentPassword: string; newPassword: string }) => ({ type: CHANGE_PASSWORD, payload }),
    /** Sign out every device, this one included. */
    logoutAll: () => ({ type: LOGOUT_ALL }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    login: (data: LoginRequest) => api.post<AuthResponse>('/auth/login', data),
    register: (data: RegisterRequest) => api.post<AuthResponse>('/auth/register', data),
    logout: () => api.post('/auth/logout'),
    logoutAll: () => api.post('/auth/logout-all'),
    changePassword: (data: { currentPassword: string; newPassword: string }) => api.post('/auth/change-password', data),
    getProfile: () => api.get<{ data: UserProfile }>('/auth/me'),
};

const saveSession = (data: AuthResponse) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
};

// ── Sagas ─────────────────────────────────────────────────────────────────────

function* loginSaga(action: ReturnType<typeof authActions.login>) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.login, action.payload);
        const data = res.data?.data || res.data;
        saveSession(data);
        yield put({ type: LOGIN_SUCCESS, payload: data.user });
        yield put(clinicActions.getClinic());
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, apiErrorMessage(err, 'auth.loginError')));
    }
}

function* registerSaga(action: ReturnType<typeof authActions.register>) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.register, action.payload);
        const data = res.data?.data || res.data;
        saveSession(data);
        yield put({ type: LOGIN_SUCCESS, payload: data.user });
        yield put(clinicActions.getClinic());
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, apiErrorMessage(err, 'auth.registerError')));
    }
}

/**
 * Revoke the refresh token on the server *before* dropping the local copy: the
 * request needs the access token, and the header used to clear storage first,
 * so the call went out unauthenticated and the session stayed valid for days.
 * A full reload then wipes every slice of in-memory patient data.
 */
function* logoutSaga() {
    try {
        yield call(service.logout);
    } catch {
        // Already expired or offline — the local session is dropped either way.
    }
    clearSession();
    window.location.replace('/login');
}

function* changePasswordSaga(action: ReturnType<typeof authActions.changePassword>) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.changePassword, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, apiErrorMessage(err, 'errors.changePassword')));
    }
}

function* logoutAllSaga() {
    try {
        yield call(service.logoutAll);
    } catch {
        // Fall through: this device is signed out regardless.
    }
    clearSession();
    window.location.replace('/login');
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
        yield put(httpActions.appendError(action.type, apiErrorMessage(err, 'auth.profileError')));
    }
}

export function* watchAuth() {
    yield takeLatest(LOGIN, loginSaga);
    yield takeLatest(REGISTER, registerSaga);
    yield takeLatest(LOGOUT, logoutSaga);
    yield takeLatest(GET_PROFILE, getProfileSaga);
    yield takeLatest(CHANGE_PASSWORD, changePasswordSaga);
    yield takeLatest(LOGOUT_ALL, logoutAllSaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface AuthState {
    user: UserProfile | null;
    isAuthenticated: boolean;
}

const initialState: AuthState = {
    user: null,
    isAuthenticated: !!localStorage.getItem(ACCESS_TOKEN_KEY),
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
