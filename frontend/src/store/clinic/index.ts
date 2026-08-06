import { call, put, takeLatest } from 'redux-saga/effects';
import api from '../../api/axios';
import { httpActions } from '../http';
import { Clinic } from '../../types';

// ── Action Types ──────────────────────────────────────────────────────────────

const GET_CLINIC = 'GET_CLINIC';
const GET_CLINIC_SUCCESS = 'GET_CLINIC_SUCCESS';
const UPDATE_CLINIC = 'UPDATE_CLINIC';
const UPDATE_WORKING_HOURS = 'UPDATE_WORKING_HOURS';
const UPDATE_SETTINGS = 'UPDATE_SETTINGS';

// ── Actions ───────────────────────────────────────────────────────────────────

export const clinicActions = {
    getClinic: () => ({ type: GET_CLINIC }),
    getClinicSuccess: (payload: Clinic) => ({ type: GET_CLINIC_SUCCESS, payload }),
    updateClinic: (payload: Partial<Clinic>) => ({ type: UPDATE_CLINIC, payload }),
    updateWorkingHours: (payload: any) => ({ type: UPDATE_WORKING_HOURS, payload }),
    updateSettings: (payload: any) => ({ type: UPDATE_SETTINGS, payload }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    getClinic: () => api.get('/clinics/current'),
    updateClinic: (data: Partial<Clinic>) => api.patch('/clinics/current', data),
    updateWorkingHours: (data: any) => api.patch('/clinics/current/working-hours', data),
    updateSettings: (data: any) => api.patch('/clinics/current/settings', data),
};

// ── Sagas ─────────────────────────────────────────────────────────────────────

function* getClinicSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getClinic);
        yield put({ type: GET_CLINIC_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load clinic'));
    }
}

function* updateClinicSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.updateClinic, action.payload);
        yield put({ type: GET_CLINIC_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to update clinic'));
    }
}

function* updateWorkingHoursSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.updateWorkingHours, action.payload);
        yield put({ type: GET_CLINIC_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to update working hours'));
    }
}

function* updateSettingsSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.updateSettings, action.payload);
        yield put({ type: GET_CLINIC_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to update settings'));
    }
}

export function* watchClinic() {
    yield takeLatest(GET_CLINIC, getClinicSaga);
    yield takeLatest(UPDATE_CLINIC, updateClinicSaga);
    yield takeLatest(UPDATE_WORKING_HOURS, updateWorkingHoursSaga);
    yield takeLatest(UPDATE_SETTINGS, updateSettingsSaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface ClinicState {
    clinic: Clinic | null;
}

const initialState: ClinicState = {
    clinic: null,
};

export const clinicReducer = (state = initialState, action: any): ClinicState => {
    switch (action.type) {
        case GET_CLINIC_SUCCESS:
            return { ...state, clinic: action.payload };
        default:
            return state;
    }
};
