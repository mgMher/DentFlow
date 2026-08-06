import { call, put, takeLatest } from 'redux-saga/effects';
import api from '../../api/axios';
import { httpActions } from '../http';
import { TreatmentRoom, BlockedTime } from '../../types';

// ── Action Types ──────────────────────────────────────────────────────────────

const GET_ROOMS = 'GET_ROOMS';
const GET_ROOMS_SUCCESS = 'GET_ROOMS_SUCCESS';
const CREATE_ROOM = 'CREATE_ROOM';
const GET_BLOCKED = 'GET_BLOCKED';
const GET_BLOCKED_SUCCESS = 'GET_BLOCKED_SUCCESS';
const CREATE_BLOCKED = 'CREATE_BLOCKED';
const DELETE_BLOCKED = 'DELETE_BLOCKED';
const GET_AVAILABILITY = 'GET_AVAILABILITY';
const GET_AVAILABILITY_SUCCESS = 'GET_AVAILABILITY_SUCCESS';

// ── Actions ───────────────────────────────────────────────────────────────────

export const scheduleActions = {
    getRooms: () => ({ type: GET_ROOMS }),
    getRoomsSuccess: (payload: TreatmentRoom[]) => ({ type: GET_ROOMS_SUCCESS, payload }),
    createRoom: (payload: Partial<TreatmentRoom>) => ({ type: CREATE_ROOM, payload }),
    getBlocked: (payload?: any) => ({ type: GET_BLOCKED, payload }),
    getBlockedSuccess: (payload: BlockedTime[]) => ({ type: GET_BLOCKED_SUCCESS, payload }),
    createBlocked: (payload: Partial<BlockedTime>) => ({ type: CREATE_BLOCKED, payload }),
    deleteBlocked: (payload: string) => ({ type: DELETE_BLOCKED, payload }),
    getAvailability: (payload: { dentistId: string; date: string }) => ({
        type: GET_AVAILABILITY,
        payload,
    }),
    getAvailabilitySuccess: (payload: any[]) => ({ type: GET_AVAILABILITY_SUCCESS, payload }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    getRooms: () => api.get('/schedule/rooms'),
    createRoom: (data: Partial<TreatmentRoom>) => api.post('/schedule/rooms', data),
    updateRoom: (id: string, data: Partial<TreatmentRoom>) => api.patch(`/schedule/rooms/${id}`, data),
    getBlocked: (params?: any) => api.get('/schedule/blocked', { params }),
    createBlocked: (data: Partial<BlockedTime>) => api.post('/schedule/blocked', data),
    deleteBlocked: (id: string) => api.delete(`/schedule/blocked/${id}`),
    getAvailability: (dentistId: string, date: string) =>
        api.get(`/schedule/availability/${dentistId}`, { params: { date } }),
};

// ── Sagas ─────────────────────────────────────────────────────────────────────

function* getRoomsSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getRooms);
        yield put({ type: GET_ROOMS_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load rooms'));
    }
}

function* createRoomSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.createRoom, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_ROOMS });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to create room'));
    }
}

function* getBlockedSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getBlocked, action.payload);
        yield put({ type: GET_BLOCKED_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load blocked times'));
    }
}

function* createBlockedSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.createBlocked, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_BLOCKED });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to create blocked time'));
    }
}

function* deleteBlockedSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.deleteBlocked, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_BLOCKED });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to delete blocked time'));
    }
}

function* getAvailabilitySaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(
            service.getAvailability,
            action.payload.dentistId,
            action.payload.date,
        );
        yield put({ type: GET_AVAILABILITY_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load availability'));
    }
}

export function* watchSchedule() {
    yield takeLatest(GET_ROOMS, getRoomsSaga);
    yield takeLatest(CREATE_ROOM, createRoomSaga);
    yield takeLatest(GET_BLOCKED, getBlockedSaga);
    yield takeLatest(CREATE_BLOCKED, createBlockedSaga);
    yield takeLatest(DELETE_BLOCKED, deleteBlockedSaga);
    yield takeLatest(GET_AVAILABILITY, getAvailabilitySaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface ScheduleState {
    rooms: TreatmentRoom[];
    blockedTimes: BlockedTime[];
    availability: any[];
}

const initialState: ScheduleState = {
    rooms: [],
    blockedTimes: [],
    availability: [],
};

export const scheduleReducer = (state = initialState, action: any): ScheduleState => {
    switch (action.type) {
        case GET_ROOMS_SUCCESS:
            return { ...state, rooms: action.payload };
        case GET_BLOCKED_SUCCESS:
            return { ...state, blockedTimes: action.payload };
        case GET_AVAILABILITY_SUCCESS:
            return { ...state, availability: action.payload };
        default:
            return state;
    }
};
