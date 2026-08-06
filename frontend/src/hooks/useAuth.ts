import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { authActions } from '../store/auth';

export const useAuth = () => {
    const dispatch = useDispatch();
    const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
    const loading = useSelector((state: RootState) => state.http.loading);

    return {
        user,
        isAuthenticated,
        isLoading: loading.includes('LOGIN') || loading.includes('GET_PROFILE'),
        login: (data: { email: string; password: string }) => dispatch(authActions.login(data)),
        register: (data: any) => dispatch(authActions.register(data)),
        logout: () => dispatch(authActions.logout()),
        getProfile: () => dispatch(authActions.getProfile()),
    };
};
