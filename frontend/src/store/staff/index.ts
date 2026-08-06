import { call, put, takeLatest } from 'redux-saga/effects';
import api from '../../api/axios';
import { httpActions } from '../http';

// ── Action Types ──────────────────────────────────────────────────────────────

const GET_STAFF = 'GET_STAFF';
const GET_STAFF_SUCCESS = 'GET_STAFF_SUCCESS';
const GET_STAFF_MEMBER = 'GET_STAFF_MEMBER';
const GET_STAFF_MEMBER_SUCCESS = 'GET_STAFF_MEMBER_SUCCESS';
const CREATE_STAFF = 'CREATE_STAFF';
const UPDATE_STAFF = 'UPDATE_STAFF';
const DELETE_STAFF = 'DELETE_STAFF';
const GET_DENTISTS = 'GET_DENTISTS';
const GET_DENTISTS_SUCCESS = 'GET_DENTISTS_SUCCESS';

// ── Actions ───────────────────────────────────────────────────────────────────

export const staffActions = {
    getStaff: (payload?: any) => ({ type: GET_STAFF, payload }),
    getStaffSuccess: (payload: { list: any[]; total: number }) => ({ type: GET_STAFF_SUCCESS, payload }),
    getStaffMember: (payload: string) => ({ type: GET_STAFF_MEMBER, payload }),
    getStaffMemberSuccess: (payload: any) => ({ type: GET_STAFF_MEMBER_SUCCESS, payload }),
    createStaff: (payload: any) => ({ type: CREATE_STAFF, payload }),
    updateStaff: (payload: { id: string; data: any }) => ({ type: UPDATE_STAFF, payload }),
    deleteStaff: (payload: string) => ({ type: DELETE_STAFF, payload }),
    getDentists: () => ({ type: GET_DENTISTS }),
    getDentistsSuccess: (payload: any[]) => ({ type: GET_DENTISTS_SUCCESS, payload }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    getAll: (params?: any) => api.get('/users', { params }),
    getById: (id: string) => api.get(`/users/${id}`),
    create: (data: any) => api.post('/users', data),
    update: (id: string, data: any) => api.patch(`/users/${id}`, data),
    remove: (id: string) => api.delete(`/users/${id}`),
    getDentists: () => api.get('/users/dentists'),
};

// ── Sagas ─────────────────────────────────────────────────────────────────────

function* getStaffSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getAll, action.payload);
        const data = res.data?.data || res.data;
        yield put({
            type: GET_STAFF_SUCCESS,
            payload: {
                list: data.data || data,
                total: data.total || 0,
            },
        });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load staff'));
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
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load staff member'));
    }
}

function* createStaffSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.create, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_STAFF });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to create staff'));
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
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to update staff'));
    }
}

function* deleteStaffSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.remove, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_STAFF });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to delete staff'));
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
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load dentists'));
    }
}

export function* watchStaff() {
    yield takeLatest(GET_STAFF, getStaffSaga);
    yield takeLatest(GET_STAFF_MEMBER, getStaffMemberSaga);
    yield takeLatest(CREATE_STAFF, createStaffSaga);
    yield takeLatest(UPDATE_STAFF, updateStaffSaga);
    yield takeLatest(DELETE_STAFF, deleteStaffSaga);
    yield takeLatest(GET_DENTISTS, getDentistsSaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface StaffState {
    list: any[];
    current: any;
    dentists: any[];
    total: number;
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
            return { ...state, list: action.payload.list, total: action.payload.total };
        case GET_STAFF_MEMBER_SUCCESS:
            return { ...state, current: action.payload };
        case GET_DENTISTS_SUCCESS:
            return { ...state, dentists: action.payload };
        default:
            return state;
    }
};
