import { call, put, select, takeLatest } from 'redux-saga/effects';
import api from '../../api/axios';
import { httpActions } from '../http';
import { apiErrorCode, apiErrorMessage } from '../../utils/apiError';
import { Treatment, TreatmentCategory } from '../../types';

// ── Action Types ──────────────────────────────────────────────────────────────

const GET_TREATMENTS = 'GET_TREATMENTS';
const GET_TREATMENTS_SUCCESS = 'GET_TREATMENTS_SUCCESS';
const GET_ACTIVE_TREATMENTS = 'GET_ACTIVE_TREATMENTS';
const GET_ACTIVE_TREATMENTS_SUCCESS = 'GET_ACTIVE_TREATMENTS_SUCCESS';
const CREATE_TREATMENT = 'CREATE_TREATMENT';
const UPDATE_TREATMENT = 'UPDATE_TREATMENT';
const DELETE_TREATMENT = 'DELETE_TREATMENT';
const REACTIVATE_TREATMENT = 'REACTIVATE_TREATMENT';
const SEED_TREATMENTS = 'SEED_TREATMENTS';

export interface TreatmentsQuery {
    page?: number;
    limit?: number;
    search?: string;
    category?: TreatmentCategory;
    isActive?: boolean;
}

/** Strings may be '' to clear an optional field on update. */
export type TreatmentInput = Partial<Omit<Treatment, 'toothStatus'>> & { toothStatus?: Treatment['toothStatus'] | '' };

// ── Actions ───────────────────────────────────────────────────────────────────

export const treatmentsActions = {
    /** The catalogue page: one page of the server-side search. */
    getTreatments: (payload: TreatmentsQuery) => ({ type: GET_TREATMENTS, payload }),
    /** Active items for pickers (chart entries, appointments). */
    getActiveTreatments: () => ({ type: GET_ACTIVE_TREATMENTS }),
    createTreatment: (payload: TreatmentInput) => ({ type: CREATE_TREATMENT, payload }),
    updateTreatment: (payload: { id: string; data: TreatmentInput }) => ({ type: UPDATE_TREATMENT, payload }),
    deleteTreatment: (payload: string) => ({ type: DELETE_TREATMENT, payload }),
    reactivateTreatment: (payload: string) => ({ type: REACTIVATE_TREATMENT, payload }),
    seedDefaults: () => ({ type: SEED_TREATMENTS }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    getAll: (params?: TreatmentsQuery) => api.get('/treatments', { params }),
    create: (data: TreatmentInput) => api.post('/treatments', data),
    update: (id: string, data: TreatmentInput) => api.patch(`/treatments/${id}`, data),
    remove: (id: string) => api.delete(`/treatments/${id}`),
    reactivate: (id: string) => api.patch(`/treatments/${id}/reactivate`),
    seedDefaults: () => api.post('/treatments/seed-defaults'),
};

// ── Sagas ─────────────────────────────────────────────────────────────────────

function* getTreatmentsSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getAll, action.payload);
        const data = res.data?.data ?? res.data;
        yield put({
            type: GET_TREATMENTS_SUCCESS,
            payload: { list: data?.data ?? [], total: data?.pagination?.total ?? 0 },
        });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, apiErrorMessage(err, 'errors.loadTreatments')));
    }
}

function* getActiveTreatmentsSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getAll, { isActive: true, limit: 100 });
        const data = res.data?.data ?? res.data;
        yield put({ type: GET_ACTIVE_TREATMENTS_SUCCESS, payload: data?.data ?? [] });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, apiErrorMessage(err, 'errors.loadTreatments')));
    }
}

const WRITES: Record<string, { request: (payload: any) => Promise<any>; fallback: string }> = {
    [CREATE_TREATMENT]: { request: (p) => service.create(p), fallback: 'errors.createTreatment' },
    [UPDATE_TREATMENT]: { request: (p) => service.update(p.id, p.data), fallback: 'errors.updateTreatment' },
    [DELETE_TREATMENT]: { request: (p) => service.remove(p), fallback: 'errors.deleteTreatment' },
    [REACTIVATE_TREATMENT]: { request: (p) => service.reactivate(p), fallback: 'errors.updateTreatment' },
    [SEED_TREATMENTS]: { request: () => service.seedDefaults(), fallback: 'errors.createTreatment' },
};

/** Every catalogue change reloads the page the user is on and the pickers' list. */
function* writeSaga(action: any) {
    const { request, fallback } = WRITES[action.type];
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(request, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        const query: TreatmentsQuery | null = yield select((s: any) => s.treatments.query);
        if (query) yield put({ type: GET_TREATMENTS, payload: query });
        yield put({ type: GET_ACTIVE_TREATMENTS });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, apiErrorMessage(err, fallback), apiErrorCode(err)));
    }
}

export function* watchTreatments() {
    yield takeLatest(GET_TREATMENTS, getTreatmentsSaga);
    yield takeLatest(GET_ACTIVE_TREATMENTS, getActiveTreatmentsSaga);
    for (const type of Object.keys(WRITES)) {
        yield takeLatest(type, writeSaga);
    }
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface TreatmentsState {
    query: TreatmentsQuery | null;
    list: Treatment[];
    total: number;
    active: Treatment[];
    activeLoaded: boolean;
}

const initialState: TreatmentsState = {
    query: null,
    list: [],
    total: 0,
    active: [],
    activeLoaded: false,
};

export const treatmentsReducer = (state = initialState, action: any): TreatmentsState => {
    switch (action.type) {
        case GET_TREATMENTS:
            return { ...state, query: action.payload };
        case GET_TREATMENTS_SUCCESS:
            return { ...state, list: action.payload.list, total: action.payload.total };
        case GET_ACTIVE_TREATMENTS_SUCCESS:
            return { ...state, active: action.payload, activeLoaded: true };
        default:
            return state;
    }
};
