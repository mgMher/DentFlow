import { call, put, takeLatest } from 'redux-saga/effects';
import api from '../../api/axios';
import { httpActions } from '../http';
import { DentalChart, ToothHistory, TreatmentEntry } from '../../types';

// ── Action Types ──────────────────────────────────────────────────────────────

const GET_CHART = 'GET_CHART';
const GET_CHART_SUCCESS = 'GET_CHART_SUCCESS';
const UPDATE_TOOTH = 'UPDATE_TOOTH';
const UPDATE_TEETH = 'UPDATE_TEETH';
const ADD_ENTRY = 'ADD_ENTRY';
const GET_HISTORY = 'GET_HISTORY';
const GET_HISTORY_SUCCESS = 'GET_HISTORY_SUCCESS';
const GET_SUMMARY = 'GET_SUMMARY';
const GET_SUMMARY_SUCCESS = 'GET_SUMMARY_SUCCESS';
const GET_TOOTH_HISTORY = 'GET_TOOTH_HISTORY';
const GET_TOOTH_HISTORY_SUCCESS = 'GET_TOOTH_HISTORY_SUCCESS';
const SET_CHART_TYPE = 'SET_CHART_TYPE';

// ── Actions ───────────────────────────────────────────────────────────────────

export const dentalRecordsActions = {
    getChart: (payload: string | { patientId: string; chartType?: 'adult' | 'pediatric' }) => ({
        type: GET_CHART,
        payload,
    }),
    setChartType: (payload: { patientId: string; chartType: 'adult' | 'pediatric' }) => ({
        type: SET_CHART_TYPE,
        payload,
    }),
    getChartSuccess: (payload: DentalChart) => ({ type: GET_CHART_SUCCESS, payload }),
    updateTooth: (payload: { patientId: string; data: any }) => ({ type: UPDATE_TOOTH, payload }),
    updateTeeth: (payload: { patientId: string; teeth: any[] }) => ({ type: UPDATE_TEETH, payload }),
    addEntry: (payload: { patientId: string; data: Partial<TreatmentEntry> }) => ({
        type: ADD_ENTRY,
        payload,
    }),
    getHistory: (payload: { patientId: string; toothNumber?: number }) => ({
        type: GET_HISTORY,
        payload,
    }),
    getHistorySuccess: (payload: TreatmentEntry[]) => ({ type: GET_HISTORY_SUCCESS, payload }),
    getSummary: (payload: string) => ({ type: GET_SUMMARY, payload }),
    getSummarySuccess: (payload: any) => ({ type: GET_SUMMARY_SUCCESS, payload }),
    getToothHistory: (payload: { patientId: string; toothNumber: number }) => ({
        type: GET_TOOTH_HISTORY,
        payload,
    }),
    getToothHistorySuccess: (payload: ToothHistory) => ({
        type: GET_TOOTH_HISTORY_SUCCESS,
        payload,
    }),
    clearToothHistory: () => ({ type: GET_TOOTH_HISTORY_SUCCESS, payload: null }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    getChart: (patientId: string, chartType?: 'adult' | 'pediatric') =>
        api.get(`/dental-records/${patientId}/chart`, {
            params: chartType ? { chartType } : {},
        }),
    setChartType: (patientId: string, chartType: 'adult' | 'pediatric') =>
        api.patch(`/dental-records/${patientId}/chart-type`, { chartType }),
    updateTooth: (patientId: string, data: any) =>
        api.patch(`/dental-records/${patientId}/tooth`, data),
    updateTeeth: (patientId: string, teeth: any[]) =>
        api.patch(`/dental-records/${patientId}/teeth`, { teeth }),
    addEntry: (patientId: string, data: Partial<TreatmentEntry>) =>
        api.post(`/dental-records/${patientId}/treatment-entry`, data),
    getHistory: (patientId: string, toothNumber?: number) =>
        api.get(`/dental-records/${patientId}/treatment-history`, {
            params: toothNumber !== undefined ? { toothNumber } : {},
        }),
    getToothHistory: (patientId: string, toothNumber: number) =>
        api.get(`/dental-records/${patientId}/tooth/${toothNumber}/history`),
    getSummary: (patientId: string) => api.get(`/dental-records/${patientId}/summary`),
};

// ── Sagas ─────────────────────────────────────────────────────────────────────

function* getChartSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const patientId =
            typeof action.payload === 'string' ? action.payload : action.payload?.patientId;
        const chartType =
            typeof action.payload === 'string' ? undefined : action.payload?.chartType;
        const res: any = yield call(service.getChart, patientId, chartType);
        yield put({ type: GET_CHART_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load dental chart'));
    }
}

function* updateToothSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.updateTooth, action.payload.patientId, action.payload.data);
        yield put({ type: GET_CHART_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        if (action.payload.data?.toothNumber !== undefined) {
            yield put({
                type: GET_TOOTH_HISTORY,
                payload: {
                    patientId: action.payload.patientId,
                    toothNumber: action.payload.data.toothNumber,
                },
            });
        }
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to update tooth'));
    }
}

function* updateTeethSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.updateTeeth, action.payload.patientId, action.payload.teeth);
        yield put({ type: GET_CHART_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to update teeth'));
    }
}

function* addEntrySaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.addEntry, action.payload.patientId, action.payload.data);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_CHART, payload: action.payload.patientId });
        yield put({ type: GET_HISTORY, payload: { patientId: action.payload.patientId } });
        // Refresh the open tooth drawer so the new entry shows immediately.
        if (action.payload.data?.toothNumber !== undefined) {
            yield put({
                type: GET_TOOTH_HISTORY,
                payload: {
                    patientId: action.payload.patientId,
                    toothNumber: action.payload.data.toothNumber,
                },
            });
        }
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to add entry'));
    }
}

function* getHistorySaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(
            service.getHistory,
            action.payload.patientId,
            action.payload.toothNumber,
        );
        const payload = res.data?.data || res.data;
        yield put({
            type: GET_HISTORY_SUCCESS,
            payload: Array.isArray(payload) ? payload : payload?.data || [],
        });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load history'));
    }
}

function* setChartTypeSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(
            service.setChartType,
            action.payload.patientId,
            action.payload.chartType,
        );
        yield put({ type: GET_CHART_SUCCESS, payload: res.data?.data || res.data });
        // The old tooth's timeline no longer applies to the new numbering.
        yield put({ type: GET_TOOTH_HISTORY_SUCCESS, payload: null });
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(
            httpActions.appendError(action.type, err?.data?.message || 'Failed to change chart type'),
        );
    }
}

function* getToothHistorySaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(
            service.getToothHistory,
            action.payload.patientId,
            action.payload.toothNumber,
        );
        yield put({ type: GET_TOOTH_HISTORY_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(
            httpActions.appendError(action.type, err?.data?.message || 'Failed to load tooth history'),
        );
    }
}

function* getSummarySaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getSummary, action.payload);
        yield put({ type: GET_SUMMARY_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load summary'));
    }
}

export function* watchDentalRecords() {
    yield takeLatest(GET_CHART, getChartSaga);
    yield takeLatest(UPDATE_TOOTH, updateToothSaga);
    yield takeLatest(UPDATE_TEETH, updateTeethSaga);
    yield takeLatest(ADD_ENTRY, addEntrySaga);
    yield takeLatest(GET_HISTORY, getHistorySaga);
    yield takeLatest(GET_TOOTH_HISTORY, getToothHistorySaga);
    yield takeLatest(SET_CHART_TYPE, setChartTypeSaga);
    yield takeLatest(GET_SUMMARY, getSummarySaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface DentalRecordsState {
    chart: DentalChart | null;
    history: TreatmentEntry[];
    toothHistory: ToothHistory | null;
    summary: any;
}

const initialState: DentalRecordsState = {
    chart: null,
    history: [],
    toothHistory: null,
    summary: null,
};

export const dentalRecordsReducer = (state = initialState, action: any): DentalRecordsState => {
    switch (action.type) {
        case GET_CHART_SUCCESS:
            return { ...state, chart: action.payload };
        case GET_HISTORY_SUCCESS:
            return { ...state, history: action.payload || [] };
        case GET_TOOTH_HISTORY_SUCCESS:
            return { ...state, toothHistory: action.payload };
        case GET_SUMMARY_SUCCESS:
            return { ...state, summary: action.payload };
        default:
            return state;
    }
};
