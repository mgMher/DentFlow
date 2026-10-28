import { call, put, select, takeLatest } from 'redux-saga/effects';
import api from '../../api/axios';
import { httpActions } from '../http';
import { apiErrorCode, apiErrorMessage } from '../../utils/apiError';
import { Appointment, AppointmentStatus } from '../../types';

// ── Action Types ──────────────────────────────────────────────────────────────

const GET_APPOINTMENTS = 'GET_APPOINTMENTS';
const GET_APPOINTMENTS_SUCCESS = 'GET_APPOINTMENTS_SUCCESS';
const GET_CALENDAR = 'GET_CALENDAR';
const GET_CALENDAR_SUCCESS = 'GET_CALENDAR_SUCCESS';
const GET_PATIENT_APPOINTMENTS = 'GET_PATIENT_APPOINTMENTS';
const GET_PATIENT_APPOINTMENTS_SUCCESS = 'GET_PATIENT_APPOINTMENTS_SUCCESS';
const GET_APPOINTMENT = 'GET_APPOINTMENT';
const GET_APPOINTMENT_SUCCESS = 'GET_APPOINTMENT_SUCCESS';
const CREATE_APPOINTMENT = 'CREATE_APPOINTMENT';
const CREATE_RECURRING = 'CREATE_RECURRING';
const CREATE_RECURRING_SUCCESS = 'CREATE_RECURRING_SUCCESS';
const UPDATE_APPOINTMENT = 'UPDATE_APPOINTMENT';
const UPDATE_STATUS = 'UPDATE_STATUS';
const CANCEL_APPOINTMENT = 'CANCEL_APPOINTMENT';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppointmentFilters {
    startDate?: string;
    endDate?: string;
    dentistId?: string;
    patientId?: string;
    status?: AppointmentStatus;
}

export interface AppointmentListQuery extends AppointmentFilters {
    page?: number;
    limit?: number;
    sortOrder?: 'asc' | 'desc';
}

export interface AppointmentPayload {
    patientId?: string;
    dentistId: string;
    treatmentRoomId?: string;
    startTime: string;
    endTime: string;
    treatmentIds?: string[];
    title?: string;
    notes?: string;
    allowOutsideHours?: boolean;
}

export interface RecurringPayload extends AppointmentPayload {
    recurringPattern: { frequency: 'daily' | 'weekly' | 'monthly'; interval: number; endDate: string; daysOfWeek?: number[] };
}

export interface RecurringResult {
    created: Appointment[];
    skipped: { startTime: string; code: string }[];
}

// ── Actions ───────────────────────────────────────────────────────────────────

export const appointmentsActions = {
    /** The list view. The query is remembered so changes can refresh exactly this view. */
    getAppointments: (payload: AppointmentListQuery = {}) => ({ type: GET_APPOINTMENTS, payload }),
    getCalendar: (payload: AppointmentFilters & { startDate: string; endDate: string }) => ({ type: GET_CALENDAR, payload }),
    /** The patient page's appointments tab — kept apart so it never replaces the main list. */
    getPatientAppointments: (payload: { patientId: string; page?: number; limit?: number }) => ({
        type: GET_PATIENT_APPOINTMENTS,
        payload,
    }),
    getAppointment: (payload: string) => ({ type: GET_APPOINTMENT, payload }),
    createAppointment: (payload: AppointmentPayload & { patientId: string }) => ({ type: CREATE_APPOINTMENT, payload }),
    createRecurring: (payload: RecurringPayload & { patientId: string }) => ({ type: CREATE_RECURRING, payload }),
    updateAppointment: (payload: { id: string; data: Partial<AppointmentPayload> }) => ({ type: UPDATE_APPOINTMENT, payload }),
    updateStatus: (payload: { id: string; status: AppointmentStatus }) => ({ type: UPDATE_STATUS, payload }),
    cancelAppointment: (payload: { id: string; reason: string; note?: string; scope?: 'this' | 'following' }) => ({
        type: CANCEL_APPOINTMENT,
        payload,
    }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    getAll: (params: AppointmentListQuery) => api.get('/appointments', { params }),
    getCalendar: (params: AppointmentFilters) => api.get('/appointments/calendar', { params }),
    getById: (id: string) => api.get(`/appointments/${id}`),
    create: (data: AppointmentPayload) => api.post('/appointments', data),
    createRecurring: (data: RecurringPayload) => api.post('/appointments/recurring', data),
    update: (id: string, data: Partial<AppointmentPayload>) => api.patch(`/appointments/${id}`, data),
    updateStatus: (id: string, status: AppointmentStatus) => api.patch(`/appointments/${id}/status`, { status }),
    cancel: (id: string, body: { reason: string; note?: string; scope?: string }) => api.patch(`/appointments/${id}/cancel`, body),
};

const unwrap = (res: any) => res.data?.data ?? res.data;

// ── Sagas ─────────────────────────────────────────────────────────────────────

function* run(type: string, fallbackKey: string, work: () => Generator<any, void, any>) {
    yield put(httpActions.removeError(type));
    yield put(httpActions.appendLoading(type));
    try {
        yield call(work);
        yield put(httpActions.removeLoading(type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(type));
        yield put(httpActions.appendError(type, apiErrorMessage(err, fallbackKey), apiErrorCode(err)));
    }
}

/** After any change: refresh the views that are on screen, with the filters they were loaded with. */
function* refreshViews() {
    const state: AppointmentsState = yield select((s: any) => s.appointments);
    if (state.lastQuery) yield put(appointmentsActions.getAppointments(state.lastQuery));
    if (state.lastCalendarQuery) yield put(appointmentsActions.getCalendar(state.lastCalendarQuery));
    if (state.byPatient.patientId) {
        yield put(appointmentsActions.getPatientAppointments({ patientId: state.byPatient.patientId, page: state.byPatient.page }));
    }
}

function* getAppointmentsSaga(action: ReturnType<typeof appointmentsActions.getAppointments>) {
    yield call(run, action.type, 'errors.loadAppointments', function* () {
        const data = unwrap(yield call(service.getAll, action.payload));
        yield put({
            type: GET_APPOINTMENTS_SUCCESS,
            payload: { list: data.appointments ?? [], total: data.pagination?.total ?? 0 },
        });
    });
}

function* getCalendarSaga(action: ReturnType<typeof appointmentsActions.getCalendar>) {
    yield call(run, action.type, 'errors.loadCalendar', function* () {
        yield put({ type: GET_CALENDAR_SUCCESS, payload: unwrap(yield call(service.getCalendar, action.payload)) ?? [] });
    });
}

function* getPatientAppointmentsSaga(action: ReturnType<typeof appointmentsActions.getPatientAppointments>) {
    const { patientId, page = 1, limit = 20 } = action.payload;
    yield call(run, action.type, 'errors.loadAppointments', function* () {
        const data = unwrap(yield call(service.getAll, { patientId, page, limit, sortOrder: 'desc' }));
        yield put({
            type: GET_PATIENT_APPOINTMENTS_SUCCESS,
            payload: { patientId, page, list: data.appointments ?? [], total: data.pagination?.total ?? 0 },
        });
    });
}

function* getAppointmentSaga(action: ReturnType<typeof appointmentsActions.getAppointment>) {
    yield call(run, action.type, 'errors.loadAppointment', function* () {
        yield put({ type: GET_APPOINTMENT_SUCCESS, payload: unwrap(yield call(service.getById, action.payload)) });
    });
}

function* createAppointmentSaga(action: ReturnType<typeof appointmentsActions.createAppointment>) {
    yield call(run, action.type, 'errors.createAppointment', function* () {
        yield call(service.create, action.payload);
        yield put(httpActions.appendSuccess(action.type));
        yield call(refreshViews);
    });
}

function* createRecurringSaga(action: ReturnType<typeof appointmentsActions.createRecurring>) {
    yield call(run, action.type, 'errors.createAppointment', function* () {
        const result: RecurringResult = unwrap(yield call(service.createRecurring, action.payload));
        yield put({ type: CREATE_RECURRING_SUCCESS, payload: result });
        yield put(httpActions.appendSuccess(action.type));
        yield call(refreshViews);
    });
}

function* updateAppointmentSaga(action: ReturnType<typeof appointmentsActions.updateAppointment>) {
    yield call(run, action.type, 'errors.updateAppointment', function* () {
        const updated = unwrap(yield call(service.update, action.payload.id, action.payload.data));
        yield put({ type: GET_APPOINTMENT_SUCCESS, payload: updated });
        yield put(httpActions.appendSuccess(action.type));
        yield call(refreshViews);
    });
}

function* updateStatusSaga(action: ReturnType<typeof appointmentsActions.updateStatus>) {
    yield call(run, action.type, 'errors.updateStatus', function* () {
        const updated = unwrap(yield call(service.updateStatus, action.payload.id, action.payload.status));
        yield put({ type: GET_APPOINTMENT_SUCCESS, payload: updated });
        yield put(httpActions.appendSuccess(action.type));
        yield call(refreshViews);
    });
}

function* cancelAppointmentSaga(action: ReturnType<typeof appointmentsActions.cancelAppointment>) {
    const { id, ...body } = action.payload;
    yield call(run, action.type, 'errors.cancelAppointment', function* () {
        // The detail page shows the response; it used to keep the old status and buttons.
        const updated = unwrap(yield call(service.cancel, id, body));
        yield put({ type: GET_APPOINTMENT_SUCCESS, payload: updated });
        yield put(httpActions.appendSuccess(action.type));
        yield call(refreshViews);
    });
}

export function* watchAppointments() {
    yield takeLatest(GET_APPOINTMENTS, getAppointmentsSaga);
    yield takeLatest(GET_CALENDAR, getCalendarSaga);
    yield takeLatest(GET_PATIENT_APPOINTMENTS, getPatientAppointmentsSaga);
    yield takeLatest(GET_APPOINTMENT, getAppointmentSaga);
    yield takeLatest(CREATE_APPOINTMENT, createAppointmentSaga);
    yield takeLatest(CREATE_RECURRING, createRecurringSaga);
    yield takeLatest(UPDATE_APPOINTMENT, updateAppointmentSaga);
    yield takeLatest(UPDATE_STATUS, updateStatusSaga);
    yield takeLatest(CANCEL_APPOINTMENT, cancelAppointmentSaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface AppointmentsState {
    list: Appointment[];
    total: number;
    lastQuery: AppointmentListQuery | null;
    calendar: Appointment[];
    lastCalendarQuery: (AppointmentFilters & { startDate: string; endDate: string }) | null;
    byPatient: { patientId: string | null; page: number; list: Appointment[]; total: number };
    current: Appointment | null;
    lastRecurring: RecurringResult | null;
}

const initialState: AppointmentsState = {
    list: [],
    total: 0,
    lastQuery: null,
    calendar: [],
    lastCalendarQuery: null,
    byPatient: { patientId: null, page: 1, list: [], total: 0 },
    current: null,
    lastRecurring: null,
};

export const appointmentsReducer = (state = initialState, action: any): AppointmentsState => {
    switch (action.type) {
        case GET_APPOINTMENTS:
            return { ...state, lastQuery: action.payload };
        case GET_APPOINTMENTS_SUCCESS:
            return { ...state, list: action.payload.list, total: action.payload.total };
        case GET_CALENDAR:
            return { ...state, lastCalendarQuery: action.payload };
        case GET_CALENDAR_SUCCESS:
            return { ...state, calendar: action.payload };
        case GET_PATIENT_APPOINTMENTS:
            // A different patient: drop the previous one's rows instead of showing them under the new name.
            return action.payload.patientId === state.byPatient.patientId
                ? state
                : { ...state, byPatient: { patientId: action.payload.patientId, page: 1, list: [], total: 0 } };
        case GET_PATIENT_APPOINTMENTS_SUCCESS:
            return action.payload.patientId === state.byPatient.patientId ? { ...state, byPatient: action.payload } : state;
        case GET_APPOINTMENT:
            // Never show the previously opened appointment under a new URL.
            return state.current?._id === action.payload ? state : { ...state, current: null };
        case GET_APPOINTMENT_SUCCESS:
            return { ...state, current: action.payload };
        case CREATE_RECURRING:
            return { ...state, lastRecurring: null };
        case CREATE_RECURRING_SUCCESS:
            return { ...state, lastRecurring: action.payload };
        default:
            return state;
    }
};
