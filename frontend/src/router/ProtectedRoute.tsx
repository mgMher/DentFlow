import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { RootState } from '../store';
import { authActions } from '../store/auth';
import { clinicActions } from '../store/clinic';
import { activeToken } from '../api/axios';

/**
 * Gate for every signed-in page. After a reload Redux is empty but the token
 * is still stored, so load the user and clinic once here — before this, the
 * profile was never fetched after a reload: the avatar showed "?", admins lost
 * their admin controls, and role checks had nothing to check.
 */
const ProtectedRoute: React.FC = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const token = activeToken();
    const user = useSelector((state: RootState) => state.auth.user);
    const clinic = useSelector((state: RootState) => state.clinic.clinic);
    const profileError = useSelector((state: RootState) => state.http.errors.find((e) => e.type === 'GET_PROFILE'));

    useEffect(() => {
        if (token && !user) dispatch(authActions.getProfile());
        // Only on first mount of the signed-in area.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // A platform admin (F13) has no clinic to load.
    const hasClinic = !!user?.clinicId;
    useEffect(() => {
        if (token && hasClinic && !clinic) dispatch(clinicActions.getClinic());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasClinic]);

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
