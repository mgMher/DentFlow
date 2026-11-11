import { call, put, select, takeLatest } from 'redux-saga/effects';
import api from '../../api/axios';
import { httpActions } from '../http';
import { apiErrorCode, apiErrorMessage } from '../../utils/apiError';
import { Notification } from '../../types';

// ── Action Types ──────────────────────────────────────────────────────────────

const GET_NOTIFICATIONS = 'GET_NOTIFICATIONS';
const GET_NOTIFICATIONS_SUCCESS = 'GET_NOTIFICATIONS_SUCCESS';
const MARK_READ = 'MARK_READ';
const MARK_READ_SUCCESS = 'MARK_READ_SUCCESS';
const MARK_ALL_READ = 'MARK_ALL_READ';
const GET_UNREAD_COUNT = 'GET_UNREAD_COUNT';
const GET_UNREAD_COUNT_SUCCESS = 'GET_UNREAD_COUNT_SUCCESS';
const DELETE_NOTIFICATION = 'DELETE_NOTIFICATION';
const DELETE_READ_NOTIFICATIONS = 'DELETE_READ_NOTIFICATIONS';

export interface NotificationsQuery {
    page: number;
    limit: number;
    /** `false`: unread only. */
    isRead?: boolean;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export const notificationsActions = {
    getNotifications: (payload: NotificationsQuery) => ({ type: GET_NOTIFICATIONS, payload }),
    markRead: (payload: string) => ({ type: MARK_READ, payload }),
    markAllRead: () => ({ type: MARK_ALL_READ }),
    /** Polled by the header bell. */
    getUnreadCount: () => ({ type: GET_UNREAD_COUNT }),
    deleteNotification: (payload: string) => ({ type: DELETE_NOTIFICATION, payload }),
    deleteRead: () => ({ type: DELETE_READ_NOTIFICATIONS }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    getAll: (params: NotificationsQuery) => api.get('/notifications', { params }),
    markRead: (id: string) => api.patch(`/notifications/${id}/read`),
    markAllRead: () => api.patch('/notifications/read-all'),
    getUnreadCount: () => api.get('/notifications/unread-count'),
    remove: (id: string) => api.delete(`/notifications/${id}`),
    removeRead: () => api.delete('/notifications/read'),
};

// ── Sagas ─────────────────────────────────────────────────────────────────────

const unwrap = (res: any) => res.data?.data ?? res.data;

/** Reload the open page (and the bell) after a change, with the query it was loaded with. */
function* reload() {
    const query: NotificationsQuery | null = yield select((s: any) => s.notifications.query);
    if (query) yield put({ type: GET_NOTIFICATIONS, payload: query });
    yield put({ type: GET_UNREAD_COUNT });
}

function* run(action: any, fallbackKey: string, body: () => Generator<any, void, any>) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(body);
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, apiErrorMessage(err, fallbackKey), apiErrorCode(err)));
    }
}

function* getNotificationsSaga(action: any) {
    yield call(run, action, 'errors.loadNotifications', function* () {
        const data = unwrap(yield call(service.getAll, action.payload));
        yield put({
            type: GET_NOTIFICATIONS_SUCCESS,
            payload: { list: data?.data ?? [], total: data?.total ?? 0, unread: data?.unread ?? 0 },
        });
    });
}

function* markReadSaga(action: any) {
    yield call(run, action, 'errors.markNotification', function* () {
        const notification: Notification = unwrap(yield call(service.markRead, action.payload));
        yield put({ type: MARK_READ_SUCCESS, payload: notification });
        yield put({ type: GET_UNREAD_COUNT });
    });
}

function* markAllReadSaga(action: any) {
    yield call(run, action, 'errors.markAllAsRead', function* () {
        yield call(service.markAllRead);
        yield call(reload);
    });
}

function* getUnreadCountSaga(action: any) {
    yield call(run, action, 'errors.loadUnreadCount', function* () {
        const data = unwrap(yield call(service.getUnreadCount));
        yield put({ type: GET_UNREAD_COUNT_SUCCESS, payload: data?.count ?? 0 });
    });
}

function* deleteNotificationSaga(action: any) {
    yield call(run, action, 'errors.deleteNotification', function* () {
        yield call(service.remove, action.payload);
        yield put(httpActions.appendSuccess(action.type));
        yield call(reload);
    });
}

function* deleteReadSaga(action: any) {
    yield call(run, action, 'errors.deleteNotification', function* () {
        yield call(service.removeRead);
        yield put(httpActions.appendSuccess(action.type));
        yield call(reload);
    });
}

export function* watchNotifications() {
    yield takeLatest(GET_NOTIFICATIONS, getNotificationsSaga);
    yield takeLatest(MARK_READ, markReadSaga);
    yield takeLatest(MARK_ALL_READ, markAllReadSaga);
    yield takeLatest(GET_UNREAD_COUNT, getUnreadCountSaga);
    yield takeLatest(DELETE_NOTIFICATION, deleteNotificationSaga);
    yield takeLatest(DELETE_READ_NOTIFICATIONS, deleteReadSaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface NotificationsState {
    /** The Notifications page, with the query it was loaded with. */
    query: NotificationsQuery | null;
    list: Notification[];
    total: number;
    unreadCount: number;
}

const initialState: NotificationsState = {
    query: null,
    list: [],
    total: 0,
    unreadCount: 0,
};

export const notificationsReducer = (state = initialState, action: any): NotificationsState => {
    switch (action.type) {
        case GET_NOTIFICATIONS:
            return { ...state, query: action.payload };
        case GET_NOTIFICATIONS_SUCCESS:
            return {
                ...state,
                list: action.payload.list,
                total: action.payload.total,
                unreadCount: action.payload.unread,
            };
        case MARK_READ_SUCCESS:
            return {
                ...state,
                list: state.list.map((n) => (n._id === action.payload._id ? action.payload : n)),
            };
        case GET_UNREAD_COUNT_SUCCESS:
            return { ...state, unreadCount: action.payload };
        default:
            return state;
    }
};
