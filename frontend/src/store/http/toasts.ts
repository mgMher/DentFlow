import { takeEvery } from 'redux-saga/effects';
import { toast } from 'react-toastify';
import i18n from '../../locales/i18n';
import { APPEND_ERROR, APPEND_SUCCESS } from './index';

/** No error toast: these screens and dialogs show the error inline already. */
const SILENT = new Set(['LOGIN', 'REGISTER', 'GET_PROFILE', 'CHANGE_PASSWORD', 'RESET_STAFF_PASSWORD']);

/**
 * Actions that get a success toast, mapped to a translation key so the toast
 * is in whatever language is active when it fires.
 *
 * Staff actions are absent on purpose: those pages confirm inline.
 */
const SUCCESS_TOAST_KEYS: Record<string, string> = {
    CREATE_APPOINTMENT: 'toast.saveSuccess',
    UPDATE_APPOINTMENT: 'toast.updateSuccess',
    CANCEL_APPOINTMENT: 'toast.updateSuccess',
    UPDATE_STATUS: 'toast.updateSuccess',
    CREATE_PATIENT: 'toast.saveSuccess',
    UPDATE_PATIENT: 'toast.updateSuccess',
    UPDATE_PATIENT_STATUS: 'toast.updateSuccess',
    CREATE_INVOICE: 'toast.saveSuccess',
    CANCEL_INVOICE: 'toast.updateSuccess',
    ADD_PAYMENT: 'toast.saveSuccess',
    CREATE_ROOM: 'toast.saveSuccess',
    UPDATE_ROOM: 'toast.updateSuccess',
    DEACTIVATE_ROOM: 'toast.updateSuccess',
    CHANGE_PASSWORD: 'toast.passwordChanged',
    RESET_STAFF_PASSWORD: 'toast.passwordReset',
    LOGOUT_ALL: 'toast.loggedOutEverywhere',
    CREATE_BLOCKED: 'toast.saveSuccess',
    DELETE_BLOCKED: 'toast.deleteSuccess',
    UPDATE_TOOTH: 'toast.saveSuccess',
    SET_CHART_TYPE: 'toast.updateSuccess',
    UPDATE_TEETH: 'toast.saveSuccess',
    ADD_ENTRY: 'toast.saveSuccess',
    CREATE_TREATMENT: 'toast.saveSuccess',
    UPDATE_TREATMENT: 'toast.updateSuccess',
    DELETE_TREATMENT: 'toast.deleteSuccess',
    UPDATE_CLINIC: 'toast.saveSuccess',
    UPDATE_WORKING_HOURS: 'toast.saveSuccess',
    UPDATE_SETTINGS: 'toast.saveSuccess',
    CREATE_TEMPLATE: 'toast.saveSuccess',
    UPDATE_TEMPLATE: 'toast.updateSuccess',
    DELETE_TEMPLATE: 'toast.deleteSuccess',
    DELETE_NOTIFICATION: 'toast.deleteSuccess',
};

/**
 * Toasts react to the *event* of a request finishing, not to Redux state.
 *
 * The old component diffed the state arrays and forgot what it had shown
 * after 100 ms, so an old success re-toasted on the next save, a second save
 * of the same kind showed nothing, and load errors were deleted from state
 * before the page could render its error screen. State is now left alone:
 * the error stays until the next attempt, which is what pages read.
 */
function showErrorToast(action: { payload: { type: string; error: string } }) {
    if (!SILENT.has(action.payload.type)) {
        // Same text twice in a row (e.g. three parallel loads failing) shows once.
        toast.error(action.payload.error, { toastId: action.payload.error });
    }
}

function showSuccessToast(action: { payload: string }) {
    const key = SUCCESS_TOAST_KEYS[action.payload];
    if (key) toast.success(i18n.t(key));
}

export function* watchHttpToasts() {
    yield takeEvery(APPEND_ERROR as any, showErrorToast);
    yield takeEvery(APPEND_SUCCESS as any, showSuccessToast);
}
