import { call, put, takeLatest } from 'redux-saga/effects';
import api from '../../api/axios';
import { httpActions } from '../http';
import { Treatment } from '../../types';

// ── Action Types ──────────────────────────────────────────────────────────────

const GET_TREATMENTS = 'GET_TREATMENTS';
const GET_TREATMENTS_SUCCESS = 'GET_TREATMENTS_SUCCESS';
const CREATE_TREATMENT = 'CREATE_TREATMENT';
const UPDATE_TREATMENT = 'UPDATE_TREATMENT';
const DELETE_TREATMENT = 'DELETE_TREATMENT';

// ── Actions ───────────────────────────────────────────────────────────────────

export const treatmentsActions = {
    getTreatments: (payload?: any) => ({ type: GET_TREATMENTS, payload }),
    getTreatmentsSuccess: (payload: { list: Treatment[]; total: number }) => ({
        type: GET_TREATMENTS_SUCCESS,
        payload,
    }),
    createTreatment: (payload: Partial<Treatment>) => ({ type: CREATE_TREATMENT, payload }),
    updateTreatment: (payload: { id: string; data: Partial<Treatment> }) => ({
        type: UPDATE_TREATMENT,
        payload,
    }),
    deleteTreatment: (payload: string) => ({ type: DELETE_TREATMENT, payload }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    getAll: (params?: any) => api.get('/treatments', { params }),
    create: (data: Partial<Treatment>) => api.post('/treatments', data),
    update: (id: string, data: Partial<Treatment>) => api.patch(`/treatments/${id}`, data),
    remove: (id: string) => api.delete(`/treatments/${id}`),
    seedDefaults: () => api.post('/treatments/seed'),
};

// ── Sagas ─────────────────────────────────────────────────────────────────────

function* getTreatmentsSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getAll, action.payload);
        const data = res.data?.data || res.data;
        yield put({
            type: GET_TREATMENTS_SUCCESS,
            payload: {
                list: data.data || data,
                total: data.total || 0,
            },
        });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load treatments'));
    }
}

function* createTreatmentSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.create, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_TREATMENTS });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to create treatment'));
    }
}

function* updateTreatmentSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.update, action.payload.id, action.payload.data);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_TREATMENTS });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to update treatment'));
    }
}

function* deleteTreatmentSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.remove, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_TREATMENTS });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to delete treatment'));
    }
}

export function* watchTreatments() {
    yield takeLatest(GET_TREATMENTS, getTreatmentsSaga);
    yield takeLatest(CREATE_TREATMENT, createTreatmentSaga);
    yield takeLatest(UPDATE_TREATMENT, updateTreatmentSaga);
    yield takeLatest(DELETE_TREATMENT, deleteTreatmentSaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface TreatmentsState {
    list: Treatment[];
    total: number;
}

const initialState: TreatmentsState = {
    list: [],
    total: 0,
};

export const treatmentsReducer = (state = initialState, action: any): TreatmentsState => {
    switch (action.type) {
        case GET_TREATMENTS_SUCCESS:
            return { ...state, list: action.payload.list, total: action.payload.total };
        default:
            return state;
    }
};
