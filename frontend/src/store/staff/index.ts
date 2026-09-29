import { call, put, select, takeLatest } from 'redux-saga/effects';
import api from '../../api/axios';
import { httpActions } from '../http';
import { apiErrorMessage } from '../../utils/apiError';
import { DayAvailability, StaffMember, StaffRole } from '../../types';

// ── Action Types ──────────────────────────────────────────────────────────────

const GET_STAFF = 'GET_STAFF';
const GET_STAFF_SUCCESS = 'GET_STAFF_SUCCESS';
const GET_STAFF_MEMBER = 'GET_STAFF_MEMBER';
const GET_STAFF_MEMBER_SUCCESS = 'GET_STAFF_MEMBER_SUCCESS';
const CLEAR_STAFF_MEMBER = 'CLEAR_STAFF_MEMBER';
const CREATE_STAFF = 'CREATE_STAFF';
const UPDATE_STAFF = 'UPDATE_STAFF';
const UPDATE_STAFF_STATUS = 'UPDATE_STAFF_STATUS';
const UPDATE_STAFF_AVAILABILITY = 'UPDATE_STAFF_AVAILABILITY';
const DELETE_STAFF = 'DELETE_STAFF';
const GET_DENTISTS = 'GET_DENTISTS';
const GET_DENTISTS_SUCCESS = 'GET_DENTISTS_SUCCESS';

export interface StaffQuery {
    search?: string;
    role?: StaffRole;
    status?: 'active' | 'inactive' | 'all';
    page?: number;
    limit?: number;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export const staffActions = {
    getStaff: (payload?: StaffQuery) => ({ type: GET_STAFF, payload }),
    getStaffMember: (payload: string) => ({ type: GET_STAFF_MEMBER, payload }),
    clearStaffMember: () => ({ type: CLEAR_STAFF_MEMBER }),
    createStaff: (payload: any) => ({ type: CREATE_STAFF, payload }),
    updateStaff: (payload: { id: string; data: any }) => ({ type: UPDATE_STAFF, payload }),
    updateStaffStatus: (payload: { id: string; isActive: boolean }) => ({
        type: UPDATE_STAFF_STATUS,
        payload,
    }),
    updateStaffAvailability: (payload: { id: string; defaultAvailability: DayAvailability[] }) => ({
        type: UPDATE_STAFF_AVAILABILITY,
        payload,
    }),
    deleteStaff: (payload: string) => ({ type: DELETE_STAFF, payload }),
    getDentists: () => ({ type: GET_DENTISTS }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    getAll: (params?: StaffQuery) => api.get('/users', { params }),
    getById: (id: string) => api.get(`/users/${id}`),
    create: (data: any) => api.post('/users', data),
    update: (id: string, data: any) => api.patch(`/users/${id}`, data),
    updateStatus: (id: string, isActive: boolean) =>
        api.patch(`/users/${id}/status`, { isActive }),
    updateAvailability: (id: string, defaultAvailability: DayAvailability[]) =>
        api.patch(`/users/${id}/availability`, { defaultAvailability }),
    remove: (id: string) => api.delete(`/users/${id}`),
    getDentists: () => api.get('/users/dentists'),
};

// ── Sagas ─────────────────────────────────────────────────────────────────────

const errorMessage = (err: any, fallbackKey: string) => apiErrorMessage(err, fallbackKey);

/** Re-runs the last list request so mutations don't reset filters or paging. */
function* refreshList() {
    const lastQuery: StaffQuery | undefined = yield select(
        (state: any) => state.staff.lastQuery,
    );
    yield put({ type: GET_STAFF, payload: lastQuery });
}

function* getStaffSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getAll, action.payload);
        const payload = res.data?.data || res.data;
        const list = payload?.data || payload || [];
        yield put({
            type: GET_STAFF_SUCCESS,
            payload: {
                list,
                total: payload?.total ?? list.length,
                query: action.payload,
            },
        });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, errorMessage(err, 'errors.loadStaff')));
    }
}

function* getStaffMemberSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getById, action.payload);
        yield put({ type: GET_STAFF_MEMBER_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, errorMessage(err, 'errors.loadStaffMember')));
    }
}

function* createStaffSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.create, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield call(refreshList);
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, errorMessage(err, 'errors.createStaff')));
    }
}

function* updateStaffSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.update, action.payload.id, action.payload.data);
        yield put({ type: GET_STAFF_MEMBER_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, errorMessage(err, 'errors.updateStaff')));
    }
}

function* updateStaffStatusSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(
            service.updateStatus,
            action.payload.id,
            action.payload.isActive,
        );
        yield put({ type: GET_STAFF_MEMBER_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield call(refreshList);
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(
            httpActions.appendError(action.type, errorMessage(err, 'errors.updateStaffStatus')),
        );
    }
}

function* updateStaffAvailabilitySaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(
            service.updateAvailability,
            action.payload.id,
            action.payload.defaultAvailability,
        );
        yield put({ type: GET_STAFF_MEMBER_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(
            httpActions.appendError(action.type, errorMessage(err, 'errors.updateAvailability')),
        );
    }
}

function* deleteStaffSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.remove, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield call(refreshList);
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(
            httpActions.appendError(action.type, errorMessage(err, 'errors.updateStaffStatus')),
        );
    }
}

function* getDentistsSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getDentists);
        yield put({ type: GET_DENTISTS_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, errorMessage(err, 'errors.loadDentists')));
    }
}

export function* watchStaff() {
    yield takeLatest(GET_STAFF, getStaffSaga);
    yield takeLatest(GET_STAFF_MEMBER, getStaffMemberSaga);
    yield takeLatest(CREATE_STAFF, createStaffSaga);
    yield takeLatest(UPDATE_STAFF, updateStaffSaga);
    yield takeLatest(UPDATE_STAFF_STATUS, updateStaffStatusSaga);
    yield takeLatest(UPDATE_STAFF_AVAILABILITY, updateStaffAvailabilitySaga);
    yield takeLatest(DELETE_STAFF, deleteStaffSaga);
    yield takeLatest(GET_DENTISTS, getDentistsSaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface StaffState {
    list: StaffMember[];
    current: StaffMember | null;
    dentists: StaffMember[];
    total: number;
    lastQuery?: StaffQuery;
}

const initialState: StaffState = {
    list: [],
    current: null,
    dentists: [],
    total: 0,
};

export const staffReducer = (state = initialState, action: any): StaffState => {
    switch (action.type) {
        case GET_STAFF_SUCCESS:
            return {
                ...state,
                list: action.payload.list,
                total: action.payload.total,
                lastQuery: action.payload.query,
            };
        case GET_STAFF_MEMBER_SUCCESS:
            return { ...state, current: action.payload };
        case CLEAR_STAFF_MEMBER:
            return { ...state, current: null };
        case GET_DENTISTS_SUCCESS:
            return { ...state, dentists: action.payload };
        default:
            return state;
    }
};
