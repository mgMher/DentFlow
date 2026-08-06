import { call, put, takeLatest } from 'redux-saga/effects';
import api from '../../api/axios';
import { httpActions } from '../http';

// ── Action Types ──────────────────────────────────────────────────────────────

const GET_DASHBOARD = 'GET_DASHBOARD';
const GET_DASHBOARD_SUCCESS = 'GET_DASHBOARD_SUCCESS';
const GET_PATIENT_STATS = 'GET_REPORT_PATIENT_STATS';
const GET_PATIENT_STATS_SUCCESS = 'GET_REPORT_PATIENT_STATS_SUCCESS';
const GET_REVENUE_REPORT = 'GET_REVENUE_REPORT';
const GET_REVENUE_REPORT_SUCCESS = 'GET_REVENUE_REPORT_SUCCESS';
const GET_APPT_STATS = 'GET_APPT_STATS';
const GET_APPT_STATS_SUCCESS = 'GET_APPT_STATS_SUCCESS';
const GET_DENTIST_PERF = 'GET_DENTIST_PERF';
const GET_DENTIST_PERF_SUCCESS = 'GET_DENTIST_PERF_SUCCESS';
const GET_TREATMENT_STATS = 'GET_TREATMENT_STATS';
const GET_TREATMENT_STATS_SUCCESS = 'GET_TREATMENT_STATS_SUCCESS';

// ── Actions ───────────────────────────────────────────────────────────────────

export const reportsActions = {
    getDashboard: () => ({ type: GET_DASHBOARD }),
    getDashboardSuccess: (payload: any) => ({ type: GET_DASHBOARD_SUCCESS, payload }),
    getPatientStats: (payload?: any) => ({ type: GET_PATIENT_STATS, payload }),
    getPatientStatsSuccess: (payload: any) => ({ type: GET_PATIENT_STATS_SUCCESS, payload }),
    getRevenueReport: (payload?: any) => ({ type: GET_REVENUE_REPORT, payload }),
    getRevenueReportSuccess: (payload: any) => ({ type: GET_REVENUE_REPORT_SUCCESS, payload }),
    getApptStats: (payload?: any) => ({ type: GET_APPT_STATS, payload }),
    getApptStatsSuccess: (payload: any) => ({ type: GET_APPT_STATS_SUCCESS, payload }),
    getDentistPerf: (payload?: any) => ({ type: GET_DENTIST_PERF, payload }),
    getDentistPerfSuccess: (payload: any) => ({ type: GET_DENTIST_PERF_SUCCESS, payload }),
    getTreatmentStats: (payload?: any) => ({ type: GET_TREATMENT_STATS, payload }),
    getTreatmentStatsSuccess: (payload: any) => ({ type: GET_TREATMENT_STATS_SUCCESS, payload }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    getDashboard: () => api.get('/reports/dashboard'),
    getPatientStats: (params?: any) => api.get('/reports/patients', { params }),
    getRevenue: (params?: any) => api.get('/reports/revenue', { params }),
    getAppointmentStats: (params?: any) => api.get('/reports/appointments', { params }),
    getDentistPerformance: (params?: any) => api.get('/reports/dentist-performance', { params }),
    getTreatmentStats: (params?: any) => api.get('/reports/treatments', { params }),
};

// ── Sagas ─────────────────────────────────────────────────────────────────────

function* getDashboardSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getDashboard);
        yield put({ type: GET_DASHBOARD_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load dashboard'));
    }
}

function* getPatientStatsSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getPatientStats, action.payload);
        yield put({ type: GET_PATIENT_STATS_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load patient stats'));
    }
}

function* getRevenueReportSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getRevenue, action.payload);
        yield put({ type: GET_REVENUE_REPORT_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load revenue report'));
    }
}

function* getApptStatsSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getAppointmentStats, action.payload);
        yield put({ type: GET_APPT_STATS_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load appointment stats'));
    }
}

function* getDentistPerfSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getDentistPerformance, action.payload);
        yield put({ type: GET_DENTIST_PERF_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load dentist performance'));
    }
}

function* getTreatmentStatsSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getTreatmentStats, action.payload);
        yield put({ type: GET_TREATMENT_STATS_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load treatment stats'));
    }
}

export function* watchReports() {
    yield takeLatest(GET_DASHBOARD, getDashboardSaga);
    yield takeLatest(GET_PATIENT_STATS, getPatientStatsSaga);
    yield takeLatest(GET_REVENUE_REPORT, getRevenueReportSaga);
    yield takeLatest(GET_APPT_STATS, getApptStatsSaga);
    yield takeLatest(GET_DENTIST_PERF, getDentistPerfSaga);
    yield takeLatest(GET_TREATMENT_STATS, getTreatmentStatsSaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface ReportsState {
    dashboard: any;
    patientStats: any;
    revenue: any;
    appointmentStats: any;
    dentistPerformance: any;
    treatmentStats: any;
}

const initialState: ReportsState = {
    dashboard: null,
    patientStats: null,
    revenue: null,
    appointmentStats: null,
    dentistPerformance: null,
    treatmentStats: null,
};

export const reportsReducer = (state = initialState, action: any): ReportsState => {
    switch (action.type) {
        case GET_DASHBOARD_SUCCESS:
            return { ...state, dashboard: action.payload };
        case GET_PATIENT_STATS_SUCCESS:
            return { ...state, patientStats: action.payload };
        case GET_REVENUE_REPORT_SUCCESS:
            return { ...state, revenue: action.payload };
        case GET_APPT_STATS_SUCCESS:
            return { ...state, appointmentStats: action.payload };
        case GET_DENTIST_PERF_SUCCESS:
            return { ...state, dentistPerformance: action.payload };
        case GET_TREATMENT_STATS_SUCCESS:
            return { ...state, treatmentStats: action.payload };
        default:
            return state;
    }
};
