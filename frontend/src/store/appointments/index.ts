import { call, put, takeLatest } from 'redux-saga/effects';
import api from '../../api/axios';
import { httpActions } from '../http';
import { Appointment } from '../../types';

// ── Action Types ──────────────────────────────────────────────────────────────

const GET_APPOINTMENTS = 'GET_APPOINTMENTS';
const GET_APPOINTMENTS_SUCCESS = 'GET_APPOINTMENTS_SUCCESS';
const GET_APPOINTMENT = 'GET_APPOINTMENT';
const GET_APPOINTMENT_SUCCESS = 'GET_APPOINTMENT_SUCCESS';
const CREATE_APPOINTMENT = 'CREATE_APPOINTMENT';
const UPDATE_APPOINTMENT = 'UPDATE_APPOINTMENT';
const CANCEL_APPOINTMENT = 'CANCEL_APPOINTMENT';
const GET_TODAY = 'GET_TODAY';
const GET_TODAY_SUCCESS = 'GET_TODAY_SUCCESS';
const GET_CALENDAR = 'GET_CALENDAR';
const GET_CALENDAR_SUCCESS = 'GET_CALENDAR_SUCCESS';
const UPDATE_STATUS = 'UPDATE_STATUS';

// ── Actions ───────────────────────────────────────────────────────────────────

export const appointmentsActions = {
    getAppointments: (payload?: any) => ({ type: GET_APPOINTMENTS, payload }),
    getAppointmentsSuccess: (payload: { list: Appointment[]; total: number }) => ({
        type: GET_APPOINTMENTS_SUCCESS,
        payload,
    }),
    getAppointment: (payload: string) => ({ type: GET_APPOINTMENT, payload }),
    getAppointmentSuccess: (payload: Appointment) => ({ type: GET_APPOINTMENT_SUCCESS, payload }),
    createAppointment: (payload: Partial<Appointment>) => ({ type: CREATE_APPOINTMENT, payload }),
    updateAppointment: (payload: { id: string; data: Partial<Appointment> }) => ({
        type: UPDATE_APPOINTMENT,
        payload,
    }),
    cancelAppointment: (payload: { id: string; reason: string }) => ({ type: CANCEL_APPOINTMENT, payload }),
    getToday: () => ({ type: GET_TODAY }),
    getTodaySuccess: (payload: Appointment[]) => ({ type: GET_TODAY_SUCCESS, payload }),
    getCalendar: (payload?: any) => ({ type: GET_CALENDAR, payload }),
    getCalendarSuccess: (payload: Appointment[]) => ({ type: GET_CALENDAR_SUCCESS, payload }),
    updateStatus: (payload: { id: string; status: string }) => ({ type: UPDATE_STATUS, payload }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    getAll: (params?: any) => api.get('/appointments', { params }),
    getById: (id: string) => api.get(`/appointments/${id}`),
    create: (data: Partial<Appointment>) => api.post('/appointments', data),
    update: (id: string, data: Partial<Appointment>) => api.patch(`/appointments/${id}`, data),
    cancel: (id: string, reason: string) => api.patch(`/appointments/${id}/cancel`, { reason }),
    getToday: () => api.get('/appointments/today'),
    getCalendar: (params?: any) => api.get('/appointments/calendar', { params }),
    updateStatus: (id: string, status: string) => api.patch(`/appointments/${id}/status`, { status }),
};

// ── Sagas ─────────────────────────────────────────────────────────────────────

function* getAppointmentsSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getAll, action.payload);
        const data = res.data?.data || res.data;
        yield put({
            type: GET_APPOINTMENTS_SUCCESS,
            payload: {
                list: data.appointments || data.data || data,
                total: data.pagination?.total || data.total || 0,
            },
        });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load appointments'));
    }
}

function* getAppointmentSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getById, action.payload);
        yield put({ type: GET_APPOINTMENT_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load appointment'));
    }
}

function* createAppointmentSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.create, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_APPOINTMENTS });
        yield put({ type: GET_TODAY });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to create appointment'));
    }
}

function* updateAppointmentSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.update, action.payload.id, action.payload.data);
        yield put({ type: GET_APPOINTMENT_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to update appointment'));
    }
}

function* cancelAppointmentSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.cancel, action.payload.id, action.payload.reason);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_APPOINTMENTS });
        yield put({ type: GET_TODAY });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to cancel appointment'));
    }
}

function* getTodaySaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getToday);
        yield put({ type: GET_TODAY_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load today appointments'));
    }
}

function* getCalendarSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getCalendar, action.payload);
        yield put({ type: GET_CALENDAR_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load calendar'));
    }
}

function* updateStatusSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.updateStatus, action.payload.id, action.payload.status);
        yield put({ type: GET_APPOINTMENT_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to update status'));
    }
}

export function* watchAppointments() {
    yield takeLatest(GET_APPOINTMENTS, getAppointmentsSaga);
    yield takeLatest(GET_APPOINTMENT, getAppointmentSaga);
    yield takeLatest(CREATE_APPOINTMENT, createAppointmentSaga);
    yield takeLatest(UPDATE_APPOINTMENT, updateAppointmentSaga);
    yield takeLatest(CANCEL_APPOINTMENT, cancelAppointmentSaga);
    yield takeLatest(GET_TODAY, getTodaySaga);
    yield takeLatest(GET_CALENDAR, getCalendarSaga);
    yield takeLatest(UPDATE_STATUS, updateStatusSaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface AppointmentsState {
    list: Appointment[];
    current: Appointment | null;
    today: Appointment[];
    calendar: Appointment[];
    total: number;
}

const initialState: AppointmentsState = {
    list: [],
    current: null,
    today: [],
    calendar: [],
    total: 0,
};

export const appointmentsReducer = (state = initialState, action: any): AppointmentsState => {
    switch (action.type) {
        case GET_APPOINTMENTS_SUCCESS:
            return { ...state, list: action.payload.list, total: action.payload.total };
        case GET_APPOINTMENT_SUCCESS:
            return { ...state, current: action.payload };
        case GET_TODAY_SUCCESS:
            return { ...state, today: action.payload };
        case GET_CALENDAR_SUCCESS:
            return { ...state, calendar: action.payload };
        default:
            return state;
    }
};
