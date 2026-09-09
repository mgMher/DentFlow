import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { RootState } from '../store';
import { httpActions } from '../store/http';

/** Auth screens show their own feedback. */
const SKIP_ACTIONS = new Set(['LOGIN', 'REGISTER', 'REFRESH_TOKEN']);

/**
 * Actions that get a success toast, mapped to their translation *key* rather
 * than the translated string — so the map is a module constant and the toast
 * is rendered in whatever language is active when it fires.
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
    CREATE_ROOM: 'toast.saveSuccess',
    CREATE_BLOCKED: 'toast.saveSuccess',
    DELETE_BLOCKED: 'toast.deleteSuccess',
    UPDATE_TOOTH: 'toast.saveSuccess',
    SET_CHART_TYPE: 'toast.updateSuccess',
    UPDATE_TEETH: 'toast.saveSuccess',
    ADD_ENTRY: 'toast.saveSuccess',
};

/**
 * Global component that watches Redux http state and shows toast notifications
 * for API errors and successes. Mounted once in App.tsx.
 */
const HttpToastHandler: React.FC = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();

    const errors = useSelector((state: RootState) => state.http.errors);
    const successes = useSelector((state: RootState) => state.http.successes);

    // Track which errors/successes we've already shown toasts for
    const shownErrors = useRef<Set<string>>(new Set());
    const shownSuccesses = useRef<Set<string>>(new Set());

    // Show error toasts
    useEffect(() => {
        errors.forEach((err) => {
            if (SKIP_ACTIONS.has(err.type)) return;
            const key = `${err.type}:${err.error}`;
            if (!shownErrors.current.has(key)) {
                shownErrors.current.add(key);
                toast.error(err.error);
                // Auto-clear from Redux after showing
                setTimeout(() => {
                    dispatch(httpActions.removeError(err.type));
                    shownErrors.current.delete(key);
                }, 100);
            }
        });
    }, [errors, dispatch]);

    // Show success toasts
    useEffect(() => {
        successes.forEach((type) => {
            if (SKIP_ACTIONS.has(type)) return;
            const messageKey = SUCCESS_TOAST_KEYS[type];
            if (messageKey && !shownSuccesses.current.has(type)) {
                shownSuccesses.current.add(type);
                toast.success(t(messageKey));
                setTimeout(() => {
                    shownSuccesses.current.delete(type);
                }, 100);
            }
        });
    }, [successes, t]);

    return null;
};

export default HttpToastHandler;
