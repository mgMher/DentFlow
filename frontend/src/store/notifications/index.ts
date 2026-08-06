import { call, put, takeLatest } from 'redux-saga/effects';
import api from '../../api/axios';
import { httpActions } from '../http';
import { Notification } from '../../types';

// ── Action Types ──────────────────────────────────────────────────────────────

const GET_NOTIFICATIONS = 'GET_NOTIFICATIONS';
const GET_NOTIFICATIONS_SUCCESS = 'GET_NOTIFICATIONS_SUCCESS';
const MARK_READ = 'MARK_READ';
const MARK_ALL_READ = 'MARK_ALL_READ';
const GET_UNREAD_COUNT = 'GET_UNREAD_COUNT';
const GET_UNREAD_COUNT_SUCCESS = 'GET_UNREAD_COUNT_SUCCESS';
const DELETE_NOTIFICATION = 'DELETE_NOTIFICATION';

// ── Actions ───────────────────────────────────────────────────────────────────

export const notificationsActions = {
    getNotifications: (payload?: any) => ({ type: GET_NOTIFICATIONS, payload }),
    getNotificationsSuccess: (payload: { list: Notification[]; total: number }) => ({
        type: GET_NOTIFICATIONS_SUCCESS,
        payload,
    }),
    markRead: (payload: string) => ({ type: MARK_READ, payload }),
    markAllRead: () => ({ type: MARK_ALL_READ }),
    getUnreadCount: () => ({ type: GET_UNREAD_COUNT }),
    getUnreadCountSuccess: (payload: number) => ({ type: GET_UNREAD_COUNT_SUCCESS, payload }),
    deleteNotification: (payload: string) => ({ type: DELETE_NOTIFICATION, payload }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    getAll: (params?: any) => api.get('/notifications', { params }),
    markRead: (id: string) => api.patch(`/notifications/${id}/read`),
    markAllRead: () => api.patch('/notifications/read-all'),
    getUnreadCount: () => api.get('/notifications/unread-count'),
    remove: (id: string) => api.delete(`/notifications/${id}`),
};

// ── Sagas ─────────────────────────────────────────────────────────────────────

function* getNotificationsSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getAll, action.payload);
        const data = res.data?.data || res.data;
        yield put({
            type: GET_NOTIFICATIONS_SUCCESS,
            payload: {
                list: data.data || data,
                total: data.total || 0,
            },
        });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load notifications'));
    }
}

function* markReadSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.markRead, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put({ type: GET_UNREAD_COUNT });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to mark notification'));
    }
}

function* markAllReadSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.markAllRead);
        yield put(httpActions.removeLoading(action.type));
        yield put({ type: GET_UNREAD_COUNT });
        yield put({ type: GET_NOTIFICATIONS });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to mark all as read'));
    }
}

function* getUnreadCountSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getUnreadCount);
        const count = res.data?.data?.count ?? res.data?.count ?? res.data?.data ?? 0;
        yield put({ type: GET_UNREAD_COUNT_SUCCESS, payload: count });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load unread count'));
    }
}

function* deleteNotificationSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.remove, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_NOTIFICATIONS });
        yield put({ type: GET_UNREAD_COUNT });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to delete notification'));
    }
}

export function* watchNotifications() {
    yield takeLatest(GET_NOTIFICATIONS, getNotificationsSaga);
    yield takeLatest(MARK_READ, markReadSaga);
    yield takeLatest(MARK_ALL_READ, markAllReadSaga);
    yield takeLatest(GET_UNREAD_COUNT, getUnreadCountSaga);
    yield takeLatest(DELETE_NOTIFICATION, deleteNotificationSaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface NotificationsState {
    list: Notification[];
    unreadCount: number;
    total: number;
}

const initialState: NotificationsState = {
    list: [],
    unreadCount: 0,
    total: 0,
};

export const notificationsReducer = (state = initialState, action: any): NotificationsState => {
    switch (action.type) {
        case GET_NOTIFICATIONS_SUCCESS:
            return { ...state, list: action.payload.list, total: action.payload.total };
        case GET_UNREAD_COUNT_SUCCESS:
            return { ...state, unreadCount: action.payload };
        default:
            return state;
    }
};
