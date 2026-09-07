import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { RootState } from '../store';
import { httpActions } from '../store/http';

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

    // Action types that should show success toasts
    const SUCCESS_TOAST_MAP: Record<string, string> = {
        CREATE_APPOINTMENT: t('toast.saveSuccess'),
        UPDATE_APPOINTMENT: t('toast.updateSuccess'),
        CANCEL_APPOINTMENT: t('toast.updateSuccess'),
        UPDATE_STATUS: t('toast.updateSuccess'),
        CREATE_PATIENT: t('toast.saveSuccess'),
        UPDATE_PATIENT: t('toast.updateSuccess'),
        UPDATE_PATIENT_STATUS: t('toast.updateSuccess'),
        DELETE_PATIENT: t('toast.deleteSuccess'),
        CREATE_INVOICE: t('toast.saveSuccess'),
        CREATE_ROOM: t('toast.saveSuccess'),
        CREATE_BLOCKED: t('toast.saveSuccess'),
        DELETE_BLOCKED: t('toast.deleteSuccess'),
        UPDATE_TOOTH: t('toast.saveSuccess'),
        UPDATE_TEETH: t('toast.saveSuccess'),
        ADD_ENTRY: t('toast.saveSuccess'),
    };

    // Action types to skip (auth handles its own UI)
    const SKIP_ACTIONS = new Set(['LOGIN', 'REGISTER', 'REFRESH_TOKEN']);

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
            if (!shownSuccesses.current.has(type) && SUCCESS_TOAST_MAP[type]) {
                shownSuccesses.current.add(type);
                toast.success(SUCCESS_TOAST_MAP[type]);
                setTimeout(() => {
                    shownSuccesses.current.delete(type);
                }, 100);
            }
        });
    }, [successes]);

    return null;
};

export default HttpToastHandler;
