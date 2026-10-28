import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { RootState } from '../store';
import { authActions } from '../store/auth';
import { clinicActions } from '../store/clinic';
import { ACCESS_TOKEN_KEY } from '../api/axios';

/**
 * Gate for every signed-in page. After a reload Redux is empty but the token
 * is still stored, so load the user and clinic once here — before this, the
 * profile was never fetched after a reload: the avatar showed "?", admins lost
 * their admin controls, and role checks had nothing to check.
 */
const ProtectedRoute: React.FC = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    const user = useSelector((state: RootState) => state.auth.user);
    const clinic = useSelector((state: RootState) => state.clinic.clinic);
    const profileError = useSelector((state: RootState) => state.http.errors.find((e) => e.type === 'GET_PROFILE'));

    useEffect(() => {
        if (!token) return;
        if (!user) dispatch(authActions.getProfile());
        if (!clinic) dispatch(clinicActions.getClinic());
        // Only on first mount of the signed-in area.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    if (!user) {
        // A 401 is handled by the API client (refresh or redirect). Anything
        // else — server down, network — gets a retry instead of an endless spinner.
        return (
            <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                {profileError ? (
                    <>
                        <Typography color="text.secondary">{profileError.error}</Typography>
                        <Button variant="contained" onClick={() => dispatch(authActions.getProfile())}>
                            {t('common.retry')}
                        </Button>
                    </>
                ) : (
                    <CircularProgress />
                )}
            </Box>
        );
    }

    return <Outlet />;
};

export default ProtectedRoute;
