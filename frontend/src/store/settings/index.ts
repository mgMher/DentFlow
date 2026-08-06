import { call, put, takeLatest } from 'redux-saga/effects';
import api from '../../api/axios';
import { httpActions } from '../http';

// ── Action Types ──────────────────────────────────────────────────────────────

const GET_TEMPLATES = 'GET_TEMPLATES';
const GET_TEMPLATES_SUCCESS = 'GET_TEMPLATES_SUCCESS';
const CREATE_TEMPLATE = 'CREATE_TEMPLATE';
const UPDATE_TEMPLATE = 'UPDATE_TEMPLATE';
const DELETE_TEMPLATE = 'DELETE_TEMPLATE';

// ── Actions ───────────────────────────────────────────────────────────────────

export const settingsActions = {
    getTemplates: () => ({ type: GET_TEMPLATES }),
    getTemplatesSuccess: (payload: any[]) => ({ type: GET_TEMPLATES_SUCCESS, payload }),
    createTemplate: (payload: any) => ({ type: CREATE_TEMPLATE, payload }),
    updateTemplate: (payload: { id: string; data: any }) => ({ type: UPDATE_TEMPLATE, payload }),
    deleteTemplate: (payload: string) => ({ type: DELETE_TEMPLATE, payload }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    getTemplates: () => api.get('/settings/templates'),
    createTemplate: (data: any) => api.post('/settings/templates', data),
    updateTemplate: (id: string, data: any) => api.patch(`/settings/templates/${id}`, data),
    deleteTemplate: (id: string) => api.delete(`/settings/templates/${id}`),
};

// ── Sagas ─────────────────────────────────────────────────────────────────────

function* getTemplatesSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getTemplates);
        yield put({ type: GET_TEMPLATES_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load templates'));
    }
}

function* createTemplateSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.createTemplate, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_TEMPLATES });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to create template'));
    }
}

function* updateTemplateSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.updateTemplate, action.payload.id, action.payload.data);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_TEMPLATES });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to update template'));
    }
}

function* deleteTemplateSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.deleteTemplate, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_TEMPLATES });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to delete template'));
    }
}

export function* watchSettings() {
    yield takeLatest(GET_TEMPLATES, getTemplatesSaga);
    yield takeLatest(CREATE_TEMPLATE, createTemplateSaga);
    yield takeLatest(UPDATE_TEMPLATE, updateTemplateSaga);
    yield takeLatest(DELETE_TEMPLATE, deleteTemplateSaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface SettingsState {
    templates: any[];
}

const initialState: SettingsState = {
    templates: [],
};

export const settingsReducer = (state = initialState, action: any): SettingsState => {
    switch (action.type) {
        case GET_TEMPLATES_SUCCESS:
            return { ...state, templates: action.payload };
        default:
            return state;
    }
};
