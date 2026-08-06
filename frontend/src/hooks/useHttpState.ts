import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { httpActions } from '../store/http';

export const useHttpState = (actionType: string) => {
    const dispatch = useDispatch();
    const loading = useSelector((state: RootState) => state.http.loading.includes(actionType));
    const error = useSelector((state: RootState) =>
        state.http.errors.find((e) => e.type === actionType)?.error || null,
    );
    const success = useSelector((state: RootState) => state.http.successes.includes(actionType));

    return {
        loading,
        error,
        success,
        clearError: () => dispatch(httpActions.removeError(actionType)),
        clearSuccess: () => dispatch(httpActions.removeSuccess(actionType)),
    };
};
