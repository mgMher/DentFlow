import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { Alert, Button } from '@mui/material';
import api from '../../api/axios';
import { RootState } from '../../store';
import { authActions } from '../../store/auth';
import { clinicActions } from '../../store/clinic';
import { usePermission } from '../../hooks';
import { accountKind } from '../../utils/account';
import { apiErrorMessage } from '../../utils/apiError';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { daysLeft, hasEnded, isEnding, lastDayOf } from '../../utils/platform';

/**
 * F13, above every clinic page:
 * - a support view: whose clinic, read-only, until when, and the way out;
 * - the subscription ended (everyone: read-only) or ends within a week (admins);
 * - support access is on (admins: until when, turn it off).
 */
const AccountBanners: React.FC = () => {
    const { t, i18n } = useTranslation();
    const dispatch = useDispatch();
    const can = usePermission();
    const user = useSelector((state: RootState) => state.auth.user);
    const clinic = useSelector((state: RootState) => state.clinic.clinic);
    const [busy, setBusy] = useState(false);
    const kind = accountKind(user);
    const sx = { mb: 2, displayPrint: 'none' };

    if (kind === 'support' && user?.support) {
        return (
            <Alert
                severity="info"
                variant="filled"
                sx={sx}
                action={
                    <Button color="inherit" size="small" sx={{ whiteSpace: 'nowrap' }} onClick={() => dispatch(authActions.logout())}>
                        {t('support.exit')}
                    </Button>
                }
            >
                {t('support.viewing', { clinic: user.support.clinicName })}
            </Alert>
        );
    }
    if (kind !== 'clinic' || !clinic) return null;

    const admin = can('manageClinic');
    const ends = clinic.subscription?.expiresAt;
    const supportUntil = clinic.supportAccessUntil && new Date(clinic.supportAccessUntil) > new Date() ? clinic.supportAccessUntil : null;

    const turnOff = () => {
        setBusy(true);
        api.delete('/clinics/current/support-access')
            .then(() => {
                toast.success(t('support.turnedOff'));
                dispatch(clinicActions.getClinic());
            })
            .catch((err) => toast.error(apiErrorMessage(err)))
            .finally(() => setBusy(false));
    };

    return (
        <>
            {hasEnded(ends) && (
                <Alert severity="error" sx={sx}>
                    {t('subscription.ended', { date: formatDate(lastDayOf(ends!), 'dd.MM.yyyy', i18n.language) })}
                </Alert>
            )}
            {admin && isEnding(ends) && (
                <Alert severity="warning" sx={sx}>
                    {t('subscription.ending', { date: formatDate(lastDayOf(ends!), 'dd.MM.yyyy', i18n.language), count: daysLeft(ends!) })}
                </Alert>
            )}
            {admin && supportUntil && (
                <Alert
                    severity="info"
                    sx={sx}
                    action={
                        <Button color="inherit" size="small" sx={{ whiteSpace: 'nowrap' }} disabled={busy} onClick={turnOff}>
                            {t('support.turnOff')}
                        </Button>
                    }
                >
                    {t('support.allowedUntil', { time: formatDateTime(supportUntil, i18n.language) })}
                </Alert>
            )}
        </>
    );
};

export default AccountBanners;
