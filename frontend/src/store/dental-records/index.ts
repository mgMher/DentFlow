import { call, put, select, takeLatest } from 'redux-saga/effects';
import { AxiosResponse } from 'axios';
import api from '../../api/axios';
import { httpActions } from '../http';
import { apiErrorCode, apiErrorMessage } from '../../utils/apiError';
import {
    ChartType,
    DentalChart,
    SurfaceState,
    ToothHistory,
    ToothStatus,
    ToothSurface,
    TreatmentEntry,
    TreatmentEntryStatus,
} from '../../types';

// ── Action Types ──────────────────────────────────────────────────────────────

const GET_CHART = 'GET_CHART';
const GET_CHART_SUCCESS = 'GET_CHART_SUCCESS';
const SET_CHART_TYPE = 'SET_CHART_TYPE';
const UPDATE_TOOTH = 'UPDATE_TOOTH';
const GET_TOOTH_HISTORY = 'GET_TOOTH_HISTORY';
const GET_TOOTH_HISTORY_SUCCESS = 'GET_TOOTH_HISTORY_SUCCESS';
const ADD_ENTRY = 'ADD_ENTRY';
const COMPLETE_ENTRY = 'COMPLETE_ENTRY';
const VOID_ENTRY = 'VOID_ENTRY';
const GET_ENTRIES = 'GET_ENTRIES';
const GET_ENTRIES_SUCCESS = 'GET_ENTRIES_SUCCESS';

export interface EntriesQuery {
    patientId: string;
    page?: number;
    limit?: number;
    status?: TreatmentEntryStatus;
    includeVoided?: boolean;
}

export interface ToothUpdate {
    toothNumber: number;
    status?: ToothStatus;
    surfaces?: SurfaceState[];
    notes?: string;
}

export interface NewTreatmentEntry {
    teeth: number[];
    treatmentName: string;
    treatmentId?: string;
    status: TreatmentEntryStatus;
    resultStatus?: ToothStatus;
    dentistId?: string;
    date?: string;
    surfaces: ToothSurface[];
    notes?: string;
    cost?: number;
    currency?: string;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export const dentalRecordsActions = {
    /** `chartType` only applies when the chart is created on first open. */
    getChart: (payload: { patientId: string; chartType?: ChartType }) => ({ type: GET_CHART, payload }),
    setChartType: (payload: { patientId: string; chartType: ChartType }) => ({ type: SET_CHART_TYPE, payload }),
    updateTooth: (payload: { patientId: string; data: ToothUpdate }) => ({ type: UPDATE_TOOTH, payload }),
    getToothHistory: (payload: { patientId: string; toothNumber: number }) => ({ type: GET_TOOTH_HISTORY, payload }),
    clearToothHistory: () => ({ type: GET_TOOTH_HISTORY_SUCCESS, payload: null }),
    addEntry: (payload: { patientId: string; data: NewTreatmentEntry }) => ({ type: ADD_ENTRY, payload }),
    completeEntry: (payload: { patientId: string; entryId: string }) => ({ type: COMPLETE_ENTRY, payload }),
    voidEntry: (payload: { patientId: string; entryId: string; reason: string }) => ({ type: VOID_ENTRY, payload }),
    getEntries: (payload: EntriesQuery) => ({ type: GET_ENTRIES, payload }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const base = (patientId: string) => `/dental-records/${patientId}`;

const service = {
    getChart: (patientId: string, chartType?: ChartType) =>
        api.get(`${base(patientId)}/chart`, { params: chartType ? { chartType } : {} }),
    setChartType: (patientId: string, chartType: ChartType) =>
        api.patch(`${base(patientId)}/chart-type`, { chartType }),
    updateTooth: (patientId: string, data: ToothUpdate) => api.patch(`${base(patientId)}/tooth`, data),
    getToothHistory: (patientId: string, toothNumber: number) =>
        api.get(`${base(patientId)}/tooth/${toothNumber}/history`),
    addEntry: (patientId: string, data: NewTreatmentEntry) => api.post(`${base(patientId)}/treatment-entry`, data),
    completeEntry: (patientId: string, entryId: string) =>
        api.patch(`${base(patientId)}/treatment-entry/${entryId}/complete`, {}),
    voidEntry: (patientId: string, entryId: string, reason: string) =>
        api.patch(`${base(patientId)}/treatment-entry/${entryId}/void`, { reason }),
    getEntries: ({ patientId, ...params }: EntriesQuery) =>
        api.get(`${base(patientId)}/treatment-history`, { params }),
};

const unwrap = (res: any) => res.data?.data ?? res.data;

// ── Sagas ─────────────────────────────────────────────────────────────────────

/** After any change: the chart, the open tooth's timeline and the entries list all refresh. */
function* refreshAfterChange(patientId: string) {
    yield put({ type: GET_CHART, payload: { patientId } });
    const state: DentalRecordsState = yield select((s: any) => s.dentalRecords);
    if (state.toothHistory && state.toothHistory.patientId === patientId) {
        yield put({
            type: GET_TOOTH_HISTORY,
            payload: { patientId, toothNumber: state.toothHistory.toothNumber },
        });
    }
    if (state.entries.query?.patientId === patientId) {
        yield put({ type: GET_ENTRIES, payload: state.entries.query });
    }
}

/**
 * Wraps a write: loading/error/success bookkeeping, and on a concurrent-edit
 * conflict the chart is reloaded so the user sees the other person's change.
 */
function* write(action: any, fallbackKey: string, request: () => Promise<any>) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: AxiosResponse = yield call(request);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        return res;
    } catch (err: any) {
        const code = apiErrorCode(err);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, apiErrorMessage(err, fallbackKey), code));
        if (code === 'chartChanged' || code === 'recordChanged') {
            yield put({ type: GET_CHART, payload: { patientId: action.payload.patientId } });
        }
        return null;
    }
}

function* read(action: any, fallbackKey: string, request: () => Promise<any>, success: (data: any) => any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: AxiosResponse = yield call(request);
        yield put(success(unwrap(res)));
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, apiErrorMessage(err, fallbackKey), apiErrorCode(err)));
    }
}

function* getChartSaga(action: any) {
    const { patientId, chartType } = action.payload;
    yield call(read, action, 'errors.loadDentalChart', () => service.getChart(patientId, chartType), (chart) => ({
        type: GET_CHART_SUCCESS,
        payload: chart,
    }));
}

function* setChartTypeSaga(action: any) {
    const { patientId, chartType } = action.payload;
    const res: AxiosResponse | null = yield call(write, action, 'errors.changeChartType', () => service.setChartType(patientId, chartType));
    if (res) {
        yield put({ type: GET_CHART_SUCCESS, payload: unwrap(res) });
        yield put({ type: GET_TOOTH_HISTORY_SUCCESS, payload: null });
    }
}

function* updateToothSaga(action: any) {
    const { patientId, data } = action.payload;
    const res: AxiosResponse | null = yield call(write, action, 'errors.updateTooth', () => service.updateTooth(patientId, data));
    if (res) {
        yield put({ type: GET_CHART_SUCCESS, payload: unwrap(res) });
        yield put({ type: GET_TOOTH_HISTORY, payload: { patientId, toothNumber: data.toothNumber } });
    }
}

function* getToothHistorySaga(action: any) {
    const { patientId, toothNumber } = action.payload;
    yield call(
        read,
        action,
        'errors.loadToothHistory',
        () => service.getToothHistory(patientId, toothNumber),
        (history) => ({ type: GET_TOOTH_HISTORY_SUCCESS, payload: { ...history, patientId } }),
    );
}

function* entryWriteSaga(action: any) {
    const { patientId } = action.payload;
    const request =
        action.type === ADD_ENTRY
            ? () => service.addEntry(patientId, action.payload.data)
            : action.type === COMPLETE_ENTRY
              ? () => service.completeEntry(patientId, action.payload.entryId)
              : () => service.voidEntry(patientId, action.payload.entryId, action.payload.reason);
    const fallback = { [ADD_ENTRY]: 'errors.addEntry', [COMPLETE_ENTRY]: 'errors.completeEntry', [VOID_ENTRY]: 'errors.voidEntry' }[
        action.type as string
    ] as string;
    const res: AxiosResponse | null = yield call(write, action, fallback, request);
    if (res) yield call(refreshAfterChange, patientId);
}

function* getEntriesSaga(action: any) {
    const query: EntriesQuery = action.payload;
    yield call(read, action, 'errors.loadHistory', () => service.getEntries(query), (data) => ({
        type: GET_ENTRIES_SUCCESS,
        payload: { query, list: data?.data ?? [], total: data?.pagination?.total ?? 0 },
    }));
}

export function* watchDentalRecords() {
    yield takeLatest(GET_CHART, getChartSaga);
    yield takeLatest(SET_CHART_TYPE, setChartTypeSaga);
    yield takeLatest(UPDATE_TOOTH, updateToothSaga);
    yield takeLatest(GET_TOOTH_HISTORY, getToothHistorySaga);
    yield takeLatest(ADD_ENTRY, entryWriteSaga);
    yield takeLatest(COMPLETE_ENTRY, entryWriteSaga);
    yield takeLatest(VOID_ENTRY, entryWriteSaga);
    yield takeLatest(GET_ENTRIES, getEntriesSaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface DentalRecordsState {
    /** Whichever patient was opened last — screens must check `chart.patientId`. */
    chart: DentalChart | null;
    toothHistory: (ToothHistory & { patientId: string }) | null;
    /** One patient's entries; `query` is remembered so writes can refresh it. */
    entries: { query: EntriesQuery | null; list: TreatmentEntry[]; total: number };
}

const initialState: DentalRecordsState = {
    chart: null,
    toothHistory: null,
    entries: { query: null, list: [], total: 0 },
};

export const dentalRecordsReducer = (state = initialState, action: any): DentalRecordsState => {
    switch (action.type) {
        case GET_CHART_SUCCESS:
            return { ...state, chart: action.payload };
        case GET_TOOTH_HISTORY_SUCCESS:
            return { ...state, toothHistory: action.payload };
        case GET_ENTRIES:
            // Remember the query right away; a different patient starts empty.
            return {
                ...state,
                entries:
                    state.entries.query?.patientId === action.payload.patientId
                        ? { ...state.entries, query: action.payload }
                        : { query: action.payload, list: [], total: 0 },
            };
        case GET_ENTRIES_SUCCESS:
            return { ...state, entries: action.payload };
        default:
            return state;
    }
};
