import { call, put, select, takeLatest } from 'redux-saga/effects';
import api from '../../api/axios';
import { httpActions } from '../http';
import { Patient, PatientStats, PatientStatus } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';

// ── Action Types ──────────────────────────────────────────────────────────────

const GET_PATIENTS = 'GET_PATIENTS';
const GET_PATIENTS_SUCCESS = 'GET_PATIENTS_SUCCESS';
const GET_PATIENT = 'GET_PATIENT';
const GET_PATIENT_SUCCESS = 'GET_PATIENT_SUCCESS';
const CREATE_PATIENT = 'CREATE_PATIENT';
const UPDATE_PATIENT = 'UPDATE_PATIENT';
const UPDATE_PATIENT_STATUS = 'UPDATE_PATIENT_STATUS';
const GET_PATIENT_STATS = 'GET_PATIENT_STATS';
const GET_PATIENT_STATS_SUCCESS = 'GET_PATIENT_STATS_SUCCESS';

export interface PatientsQuery {
    search?: string;
    page?: number;
    limit?: number;
    status?: PatientStatus;
    gender?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

// ── Actions ───────────────────────────────────────────────────────────────────

export const patientsActions = {
    getPatients: (payload?: PatientsQuery) => ({ type: GET_PATIENTS, payload }),
    getPatientsSuccess: (payload: {
        list: Patient[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }) => ({
        type: GET_PATIENTS_SUCCESS,
        payload,
    }),
    getPatient: (payload: string) => ({ type: GET_PATIENT, payload }),
    getPatientSuccess: (payload: Patient) => ({ type: GET_PATIENT_SUCCESS, payload }),
    createPatient: (payload: Partial<Patient>) => ({ type: CREATE_PATIENT, payload }),
    updatePatient: (payload: { id: string; data: Partial<Patient> }) => ({
        type: UPDATE_PATIENT,
        payload,
    }),
    updatePatientStatus: (payload: { id: string; status: PatientStatus; reason?: string }) => ({
        type: UPDATE_PATIENT_STATUS,
        payload,
    }),
    getPatientStats: () => ({ type: GET_PATIENT_STATS }),
    getPatientStatsSuccess: (payload: PatientStats) => ({
        type: GET_PATIENT_STATS_SUCCESS,
        payload,
    }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    getAll: (params?: PatientsQuery) => api.get('/patients', { params }),
    getById: (id: string) => api.get(`/patients/${id}`),
    create: (data: Partial<Patient>) => api.post('/patients', data),
    update: (id: string, data: Partial<Patient>) => api.patch(`/patients/${id}`, data),
    updateStatus: (id: string, status: PatientStatus, reason?: string) =>
        api.patch(`/patients/${id}/status`, reason ? { status, reason } : { status }),
    getStats: () => api.get('/patients/stats'),
};

// ── Sagas ─────────────────────────────────────────────────────────────────────

const errorMessage = (err: any, fallbackKey: string) => apiErrorMessage(err, fallbackKey);

/** Re-runs the last list request so mutations don't reset filters or paging. */
function* refreshList() {
    const lastQuery: PatientsQuery | undefined = yield select(
        (state: any) => state.patients.lastQuery,
    );
    yield put({ type: GET_PATIENTS, payload: lastQuery });
}

function* getPatientsSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getAll, action.payload);
        const payload = res.data?.data || res.data;
        const list = payload?.data || payload || [];
        yield put({
            type: GET_PATIENTS_SUCCESS,
            payload: {
                list,
                total: payload?.total ?? list.length,
                page: payload?.page ?? 1,
                limit: payload?.limit ?? list.length,
                totalPages: payload?.totalPages ?? 1,
                query: action.payload,
            },
        });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, errorMessage(err, 'errors.loadPatients')));
    }
}

function* getPatientSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getById, action.payload);
        yield put({ type: GET_PATIENT_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, errorMessage(err, 'errors.loadPatient')));
    }
}

function* createPatientSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.create, action.payload);
        yield put({ type: GET_PATIENT_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield call(refreshList);
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, errorMessage(err, 'errors.createPatient')));
    }
}

function* updatePatientSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.update, action.payload.id, action.payload.data);
        yield put({ type: GET_PATIENT_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, errorMessage(err, 'errors.updatePatient')));
    }
}

function* updatePatientStatusSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(
            service.updateStatus,
            action.payload.id,
            action.payload.status,
            action.payload.reason,
        );
        yield put({ type: GET_PATIENT_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield call(refreshList);
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(
            httpActions.appendError(action.type, errorMessage(err, 'errors.updatePatientStatus')),
        );
    }
}

function* getPatientStatsSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getStats);
        yield put({ type: GET_PATIENT_STATS_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(
            httpActions.appendError(action.type, errorMessage(err, 'errors.loadPatientStats')),
        );
    }
}

export function* watchPatients() {
    yield takeLatest(GET_PATIENTS, getPatientsSaga);
    yield takeLatest(GET_PATIENT, getPatientSaga);
    yield takeLatest(CREATE_PATIENT, createPatientSaga);
    yield takeLatest(UPDATE_PATIENT, updatePatientSaga);
    yield takeLatest(UPDATE_PATIENT_STATUS, updatePatientStatusSaga);
    yield takeLatest(GET_PATIENT_STATS, getPatientStatsSaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface PatientsState {
    list: Patient[];
    current: Patient | null;
    stats: PatientStats | null;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    lastQuery?: PatientsQuery;
}

const initialState: PatientsState = {
    list: [],
    current: null,
    stats: null,
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
};

export const patientsReducer = (state = initialState, action: any): PatientsState => {
    switch (action.type) {
        case GET_PATIENTS_SUCCESS:
            return {
                ...state,
                list: action.payload.list,
                total: action.payload.total,
                page: action.payload.page,
                limit: action.payload.limit,
                totalPages: action.payload.totalPages,
                lastQuery: action.payload.query ?? state.lastQuery,
            };
        case GET_PATIENT_SUCCESS:
            return {
                ...state,
                current: action.payload,
                // Keep the row in the list in sync with the detail view.
                list: state.list.map((p) =>
                    p._id === action.payload?._id ? { ...p, ...action.payload } : p,
                ),
            };
        case GET_PATIENT_STATS_SUCCESS:
            return { ...state, stats: action.payload };
        default:
            return state;
    }
};
