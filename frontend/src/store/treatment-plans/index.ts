import { call, put, takeLatest } from 'redux-saga/effects';
import { AxiosResponse } from 'axios';
import api from '../../api/axios';
import { httpActions } from '../http';
import { apiErrorCode, apiErrorMessage } from '../../utils/apiError';
import { TreatmentPlan, TreatmentPlanItemInput } from '../../types';

// ── Action Types ──────────────────────────────────────────────────────────────

export const GET_PLANS = 'GET_PLANS';
const GET_PLANS_SUCCESS = 'GET_PLANS_SUCCESS';
export const GET_PLAN = 'GET_PLAN';
const PLAN_SUCCESS = 'PLAN_SUCCESS';
export const CREATE_PLAN = 'CREATE_PLAN';
export const UPDATE_PLAN = 'UPDATE_PLAN';
export const ADD_PLAN_ITEM = 'ADD_PLAN_ITEM';
export const UPDATE_PLAN_ITEM = 'UPDATE_PLAN_ITEM';
export const REMOVE_PLAN_ITEM = 'REMOVE_PLAN_ITEM';
export const PRESENT_PLAN = 'PRESENT_PLAN';
export const ACCEPT_PLAN = 'ACCEPT_PLAN';
export const DECLINE_PLAN = 'DECLINE_PLAN';
export const REVISE_PLAN = 'REVISE_PLAN';
export const CANCEL_PLAN = 'CANCEL_PLAN';
export const DUPLICATE_PLAN = 'DUPLICATE_PLAN';
export const COMPLETE_PLAN_ITEM = 'COMPLETE_PLAN_ITEM';

// ── Actions ───────────────────────────────────────────────────────────────────

type Id = { planId: string };

export const treatmentPlansActions = {
    getPlans: (patientId: string) => ({ type: GET_PLANS, payload: patientId }),
    getPlan: (planId: string) => ({ type: GET_PLAN, payload: planId }),
    createPlan: (payload: { patientId: string; title: string; dentistId?: string; notes?: string }) => ({
        type: CREATE_PLAN,
        payload,
    }),
    updatePlan: (payload: Id & { data: { title?: string; dentistId?: string; notes?: string } }) => ({
        type: UPDATE_PLAN,
        payload,
    }),
    addItem: (payload: Id & { data: TreatmentPlanItemInput }) => ({ type: ADD_PLAN_ITEM, payload }),
    updateItem: (payload: Id & { itemId: string; data: TreatmentPlanItemInput }) => ({ type: UPDATE_PLAN_ITEM, payload }),
    removeItem: (payload: Id & { itemId: string }) => ({ type: REMOVE_PLAN_ITEM, payload }),
    present: (payload: Id & { validUntil?: string }) => ({ type: PRESENT_PLAN, payload }),
    accept: (payload: Id & { revision: number; declinedItemIds: string[] }) => ({ type: ACCEPT_PLAN, payload }),
    decline: (payload: Id & { reason: string }) => ({ type: DECLINE_PLAN, payload }),
    revise: (payload: Id) => ({ type: REVISE_PLAN, payload }),
    cancel: (payload: Id & { reason: string }) => ({ type: CANCEL_PLAN, payload }),
    duplicate: (payload: Id & { title?: string }) => ({ type: DUPLICATE_PLAN, payload }),
    /** Mark one item done (the ordinary treatment-entry completion), then reload the plan. */
    completeItem: (payload: Id & { patientId: string; itemId: string }) => ({ type: COMPLETE_PLAN_ITEM, payload }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const base = (planId: string) => `/treatment-plans/${planId}`;

const service = {
    list: (patientId: string) => api.get('/treatment-plans', { params: { patientId } }),
    get: (planId: string) => api.get(base(planId)),
    create: (data: object) => api.post('/treatment-plans', data),
    update: (planId: string, data: object) => api.patch(base(planId), data),
    addItem: (planId: string, data: object) => api.post(`${base(planId)}/items`, data),
    updateItem: (planId: string, itemId: string, data: object) => api.patch(`${base(planId)}/items/${itemId}`, data),
    removeItem: (planId: string, itemId: string) => api.delete(`${base(planId)}/items/${itemId}`),
    transition: (planId: string, step: string, data?: object) => api.patch(`${base(planId)}/${step}`, data ?? {}),
    duplicate: (planId: string, data: object) => api.post(`${base(planId)}/duplicate`, data),
    complete: (patientId: string, itemId: string) =>
        api.patch(`/dental-records/${patientId}/treatment-entry/${itemId}/complete`, {}),
};

// ── Sagas ─────────────────────────────────────────────────────────────────────

const unwrap = (res: AxiosResponse) => res.data?.data ?? res.data;

function* run(action: any, fallbackKey: string, body: () => Generator<any, void, any>, success = false) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(body);
        yield put(httpActions.removeLoading(action.type));
        if (success) yield put(httpActions.appendSuccess(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, apiErrorMessage(err, fallbackKey), apiErrorCode(err)));
    }
}

/** Every write answers with the whole plan; store it as the open plan. */
function writes(request: (payload: any) => Promise<AxiosResponse>) {
    return function* (action: any) {
        yield call(
            run,
            action,
            'errors.savePlan',
            function* () {
                const res: AxiosResponse = yield call(request, action.payload);
                yield put({ type: PLAN_SUCCESS, payload: unwrap(res) });
            },
            true,
        );
    };
}

function* getPlansSaga(action: any) {
    yield call(run, action, 'errors.loadPlans', function* () {
        const res: AxiosResponse = yield call(service.list, action.payload);
        yield put({ type: GET_PLANS_SUCCESS, payload: { patientId: action.payload, list: unwrap(res) ?? [] } });
    });
}

function* getPlanSaga(action: any) {
    yield call(run, action, 'errors.loadPlans', function* () {
        const res: AxiosResponse = yield call(service.get, action.payload);
        yield put({ type: PLAN_SUCCESS, payload: unwrap(res) });
    });
}

function* completeItemSaga(action: any) {
    const { planId, patientId, itemId } = action.payload;
    yield call(
        run,
        action,
        'errors.completeEntry',
        function* () {
            yield call(service.complete, patientId, itemId);
            const res: AxiosResponse = yield call(service.get, planId);
            yield put({ type: PLAN_SUCCESS, payload: unwrap(res) });
        },
        true,
    );
}

export function* watchTreatmentPlans() {
    yield takeLatest(GET_PLANS, getPlansSaga);
    yield takeLatest(GET_PLAN, getPlanSaga);
    yield takeLatest(CREATE_PLAN, writes((p) => service.create(p)));
    yield takeLatest(UPDATE_PLAN, writes((p) => service.update(p.planId, p.data)));
    yield takeLatest(ADD_PLAN_ITEM, writes((p) => service.addItem(p.planId, p.data)));
    yield takeLatest(UPDATE_PLAN_ITEM, writes((p) => service.updateItem(p.planId, p.itemId, p.data)));
    yield takeLatest(REMOVE_PLAN_ITEM, writes((p) => service.removeItem(p.planId, p.itemId)));
    yield takeLatest(PRESENT_PLAN, writes((p) => service.transition(p.planId, 'present', { validUntil: p.validUntil })));
    yield takeLatest(
        ACCEPT_PLAN,
        writes((p) => service.transition(p.planId, 'accept', { revision: p.revision, declinedItemIds: p.declinedItemIds })),
    );
    yield takeLatest(DECLINE_PLAN, writes((p) => service.transition(p.planId, 'decline', { reason: p.reason })));
    yield takeLatest(REVISE_PLAN, writes((p) => service.transition(p.planId, 'revise')));
    yield takeLatest(CANCEL_PLAN, writes((p) => service.transition(p.planId, 'cancel', { reason: p.reason })));
    yield takeLatest(DUPLICATE_PLAN, writes((p) => service.duplicate(p.planId, { title: p.title })));
    yield takeLatest(COMPLETE_PLAN_ITEM, completeItemSaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface TreatmentPlansState {
    /** Plans of `patientId`, newest first. */
    patientId: string | null;
    list: TreatmentPlan[];
    /** The plan open on the plan page (with items). */
    current: TreatmentPlan | null;
}

const initialState: TreatmentPlansState = { patientId: null, list: [], current: null };

export const treatmentPlansReducer = (state = initialState, action: any): TreatmentPlansState => {
    switch (action.type) {
        case GET_PLANS_SUCCESS:
            return { ...state, patientId: action.payload.patientId, list: action.payload.list };
        case PLAN_SUCCESS:
            return {
                ...state,
                current: action.payload,
                // Keep the list in step when it shows this plan's patient.
                list:
                    state.patientId === action.payload.patientId
                        ? [action.payload, ...state.list.filter((p) => p._id !== action.payload._id)].sort(
                              (a, b) => b.createdAt.localeCompare(a.createdAt),
                          )
                        : state.list,
            };
        default:
            return state;
    }
};
