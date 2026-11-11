import { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { httpActions } from '../store/http';

export const useHttpState = (actionType: string) => {
    const dispatch = useDispatch();
    const loading = useSelector((state: RootState) => state.http.loading.includes(actionType));
    const failure = useSelector((state: RootState) => state.http.errors.find((e) => e.type === actionType));
    const error = failure?.error || null;
    const errorCode = failure?.code || null;
    const success = useSelector((state: RootState) => state.http.successes.includes(actionType));

    // Stable identities, so callers can list them as effect dependencies
    // without re-running the effect (and restarting timers) on every render.
    const clearError = useCallback(() => dispatch(httpActions.removeError(actionType)), [dispatch, actionType]);
    const clearSuccess = useCallback(() => dispatch(httpActions.removeSuccess(actionType)), [dispatch, actionType]);

    return { loading, error, errorCode, success, clearError, clearSuccess };
};
