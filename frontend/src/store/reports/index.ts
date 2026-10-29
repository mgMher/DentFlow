import { call, put, takeLatest } from 'redux-saga/effects';
import api from '../../api/axios';
import { httpActions } from '../http';
import { apiErrorCode, apiErrorMessage } from '../../utils/apiError';
import {
    AppointmentReport,
    DashboardSummary,
    DentistPerformanceReport,
    PatientReport,
    ReportGroupBy,
    RevenueReport,
    TreatmentReport,
} from '../../types';

// ── Action Types ──────────────────────────────────────────────────────────────

const GET_DASHBOARD = 'GET_DASHBOARD';
const GET_DASHBOARD_SUCCESS = 'GET_DASHBOARD_SUCCESS';
const GET_REVENUE_REPORT = 'GET_REVENUE_REPORT';
const GET_REVENUE_REPORT_SUCCESS = 'GET_REVENUE_REPORT_SUCCESS';
const GET_APPT_STATS = 'GET_APPT_STATS';
const GET_APPT_STATS_SUCCESS = 'GET_APPT_STATS_SUCCESS';
const GET_DENTIST_PERF = 'GET_DENTIST_PERF';
const GET_DENTIST_PERF_SUCCESS = 'GET_DENTIST_PERF_SUCCESS';
const GET_TREATMENT_STATS = 'GET_TREATMENT_STATS';
const GET_TREATMENT_STATS_SUCCESS = 'GET_TREATMENT_STATS_SUCCESS';
const GET_PATIENT_STATS = 'GET_REPORT_PATIENT_STATS';
const GET_PATIENT_STATS_SUCCESS = 'GET_REPORT_PATIENT_STATS_SUCCESS';

/** Clinic calendar days, both included. `groupBy` only matters for revenue. */
export interface ReportQuery {
    startDate: string;
    endDate: string;
    groupBy?: ReportGroupBy;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export const reportsActions = {
    getDashboard: () => ({ type: GET_DASHBOARD }),
    getRevenueReport: (payload: ReportQuery) => ({ type: GET_REVENUE_REPORT, payload }),
    getApptStats: (payload: ReportQuery) => ({ type: GET_APPT_STATS, payload }),
    getDentistPerf: (payload: ReportQuery) => ({ type: GET_DENTIST_PERF, payload }),
    getTreatmentStats: (payload: ReportQuery) => ({ type: GET_TREATMENT_STATS, payload }),
    getPatientStats: (payload: ReportQuery) => ({ type: GET_PATIENT_STATS, payload }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    getDashboard: () => api.get('/reports/dashboard'),
    getRevenue: (params: ReportQuery) => api.get('/reports/revenue', { params }),
    getAppointmentStats: (params: ReportQuery) => api.get('/reports/appointments', { params }),
    getDentistPerformance: (params: ReportQuery) => api.get('/reports/dentist-performance', { params }),
    getTreatmentStats: (params: ReportQuery) => api.get('/reports/treatments', { params }),
    getPatientStats: (params: ReportQuery) => api.get('/reports/patients', { params }),
};

// ── Sagas ─────────────────────────────────────────────────────────────────────

const unwrap = (res: any) => res.data?.data ?? res.data;

function* read(action: any, successType: string, fallbackKey: string, request: () => Promise<any>) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(request);
        yield put({ type: successType, payload: unwrap(res) });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, apiErrorMessage(err, fallbackKey), apiErrorCode(err)));
    }
}

function* getDashboardSaga(action: any) {
    yield call(read, action, GET_DASHBOARD_SUCCESS, 'errors.loadDashboard', service.getDashboard);
}

function* getRevenueReportSaga(action: any) {
    yield call(read, action, GET_REVENUE_REPORT_SUCCESS, 'errors.loadRevenueReport', () =>
        service.getRevenue(action.payload),
    );
}

function* getApptStatsSaga(action: any) {
    yield call(read, action, GET_APPT_STATS_SUCCESS, 'errors.loadAppointmentStats', () =>
        service.getAppointmentStats(action.payload),
    );
}

function* getDentistPerfSaga(action: any) {
    yield call(read, action, GET_DENTIST_PERF_SUCCESS, 'errors.loadDentistPerformance', () =>
        service.getDentistPerformance(action.payload),
    );
}

function* getTreatmentStatsSaga(action: any) {
    yield call(read, action, GET_TREATMENT_STATS_SUCCESS, 'errors.loadTreatmentStats', () =>
        service.getTreatmentStats(action.payload),
    );
}

function* getPatientStatsSaga(action: any) {
    yield call(read, action, GET_PATIENT_STATS_SUCCESS, 'errors.loadPatientStats', () =>
        service.getPatientStats(action.payload),
    );
}

export function* watchReports() {
    yield takeLatest(GET_DASHBOARD, getDashboardSaga);
    yield takeLatest(GET_REVENUE_REPORT, getRevenueReportSaga);
    yield takeLatest(GET_APPT_STATS, getApptStatsSaga);
    yield takeLatest(GET_DENTIST_PERF, getDentistPerfSaga);
    yield takeLatest(GET_TREATMENT_STATS, getTreatmentStatsSaga);
    yield takeLatest(GET_PATIENT_STATS, getPatientStatsSaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface ReportsState {
    dashboard: DashboardSummary | null;
    revenue: RevenueReport | null;
    appointmentStats: AppointmentReport | null;
    dentistPerformance: DentistPerformanceReport | null;
    treatmentStats: TreatmentReport | null;
    patientStats: PatientReport | null;
}

const initialState: ReportsState = {
    dashboard: null,
    revenue: null,
    appointmentStats: null,
    dentistPerformance: null,
    treatmentStats: null,
    patientStats: null,
};

export const reportsReducer = (state = initialState, action: any): ReportsState => {
    switch (action.type) {
        case GET_DASHBOARD_SUCCESS:
            return { ...state, dashboard: action.payload };
        case GET_REVENUE_REPORT_SUCCESS:
            return { ...state, revenue: action.payload };
        case GET_APPT_STATS_SUCCESS:
            return { ...state, appointmentStats: action.payload };
        case GET_DENTIST_PERF_SUCCESS:
            return { ...state, dentistPerformance: action.payload };
        case GET_TREATMENT_STATS_SUCCESS:
            return { ...state, treatmentStats: action.payload };
        case GET_PATIENT_STATS_SUCCESS:
            return { ...state, patientStats: action.payload };
        default:
            return state;
    }
};
