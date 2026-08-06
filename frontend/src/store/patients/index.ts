import { call, put, takeLatest } from 'redux-saga/effects';
import api from '../../api/axios';
import { httpActions } from '../http';
import { Patient } from '../../types';

// ── Action Types ──────────────────────────────────────────────────────────────

const GET_PATIENTS = 'GET_PATIENTS';
const GET_PATIENTS_SUCCESS = 'GET_PATIENTS_SUCCESS';
const GET_PATIENT = 'GET_PATIENT';
const GET_PATIENT_SUCCESS = 'GET_PATIENT_SUCCESS';
const CREATE_PATIENT = 'CREATE_PATIENT';
const UPDATE_PATIENT = 'UPDATE_PATIENT';
const DELETE_PATIENT = 'DELETE_PATIENT';
const GET_PATIENT_STATS = 'GET_PATIENT_STATS';
const GET_PATIENT_STATS_SUCCESS = 'GET_PATIENT_STATS_SUCCESS';

// ── Actions ───────────────────────────────────────────────────────────────────

export const patientsActions = {
    getPatients: (payload?: any) => ({ type: GET_PATIENTS, payload }),
    getPatientsSuccess: (payload: { list: Patient[]; total: number; page: number }) => ({
        type: GET_PATIENTS_SUCCESS,
        payload,
    }),
    getPatient: (payload: string) => ({ type: GET_PATIENT, payload }),
    getPatientSuccess: (payload: Patient) => ({ type: GET_PATIENT_SUCCESS, payload }),
    createPatient: (payload: Partial<Patient>) => ({ type: CREATE_PATIENT, payload }),
    updatePatient: (payload: { id: string; data: Partial<Patient> }) => ({ type: UPDATE_PATIENT, payload }),
    deletePatient: (payload: string) => ({ type: DELETE_PATIENT, payload }),
    getPatientStats: () => ({ type: GET_PATIENT_STATS }),
    getPatientStatsSuccess: (payload: any) => ({ type: GET_PATIENT_STATS_SUCCESS, payload }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    getAll: (params?: any) => api.get('/patients', { params }),
    getById: (id: string) => api.get(`/patients/${id}`),
    create: (data: Partial<Patient>) => api.post('/patients', data),
    update: (id: string, data: Partial<Patient>) => api.patch(`/patients/${id}`, data),
    remove: (id: string) => api.delete(`/patients/${id}`),
    getStats: () => api.get('/patients/stats'),
};

// ── Sagas ─────────────────────────────────────────────────────────────────────

function* getPatientsSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getAll, action.payload);
        const data = res.data?.data || res.data;
        yield put({
            type: GET_PATIENTS_SUCCESS,
            payload: {
                list: data.data || data,
                total: data.total || 0,
                page: data.page || 1,
            },
        });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load patients'));
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
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load patient'));
    }
}

function* createPatientSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.create, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_PATIENTS });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to create patient'));
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
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to update patient'));
    }
}

function* deletePatientSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.remove, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_PATIENTS });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to delete patient'));
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
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load patient stats'));
    }
}

export function* watchPatients() {
    yield takeLatest(GET_PATIENTS, getPatientsSaga);
    yield takeLatest(GET_PATIENT, getPatientSaga);
    yield takeLatest(CREATE_PATIENT, createPatientSaga);
    yield takeLatest(UPDATE_PATIENT, updatePatientSaga);
    yield takeLatest(DELETE_PATIENT, deletePatientSaga);
    yield takeLatest(GET_PATIENT_STATS, getPatientStatsSaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface PatientsState {
    list: Patient[];
    current: Patient | null;
    stats: any;
    total: number;
    page: number;
}

const initialState: PatientsState = {
    list: [],
    current: null,
    stats: null,
    total: 0,
    page: 1,
};

export const patientsReducer = (state = initialState, action: any): PatientsState => {
    switch (action.type) {
        case GET_PATIENTS_SUCCESS:
            return {
                ...state,
                list: action.payload.list,
                total: action.payload.total,
                page: action.payload.page,
            };
        case GET_PATIENT_SUCCESS:
            return { ...state, current: action.payload };
        case GET_PATIENT_STATS_SUCCESS:
            return { ...state, stats: action.payload };
        default:
            return state;
    }
};
