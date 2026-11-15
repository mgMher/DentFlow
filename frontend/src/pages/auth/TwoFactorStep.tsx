import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, Link, Typography } from '@mui/material';
import api from '../../api/axios';
import { authActions, TwoFactorPending } from '../../store/auth';
import { AuthResponse } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import BackupCodes from '../../components/auth/BackupCodes';
import CodeField from '../../components/auth/CodeField';
import TwoFactorSetupPanel from '../../components/auth/TwoFactorSetupPanel';

type Signed = AuthResponse & { trustedDevice?: string; backupCodes?: string[] };
const unwrap = (res: { data: any }) => (res.data?.data ?? res.data) as Signed;

/**
 * Second sign-in step (F9), in place of the login form: the authenticator
 * code (or a backup code), or — for an admin who must have it — setting the
 * app up first, then the backup codes once.
 */
const TwoFactorStep: React.FC<{ pending: TwoFactorPending }> = ({ pending }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [code, setCode] = useState('');
    const [useBackup, setUseBackup] = useState(false);
    const [trust, setTrust] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // After setup: the session waits until the backup codes have been seen.
    const [afterSetup, setAfterSetup] = useState<Signed | null>(null);

    const finish = (data: Signed) => dispatch(authActions.completeLogin({ ...data, email: pending.email }));

    const submit = async () => {
        setBusy(true);
        setError(null);
        try {
            finish(unwrap(await api.post('/auth/login/2fa', { challenge: pending.challenge, code: code.trim(), trustDevice: trust })));
        } catch (err) {
            setError(apiErrorMessage(err));
            setCode('');
        } finally {
            setBusy(false);
        }
    };

    const trustBox = (
        <FormControlLabel
            sx={{ mt: 1 }}
            control={<Checkbox checked={trust} onChange={(e) => setTrust(e.target.checked)} />}
            label={<Typography variant="body2">{t('security.trustDevice')}</Typography>}
        />
    );
    const back = (
        <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Link component="button" type="button" variant="body2" onClick={() => dispatch(authActions.cancelTwoFactor())}>
                {t('security.backToLogin')}
            </Link>
        </Box>
    );

    if (afterSetup) {
        return (
            <>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>{t('security.backupCodes')}</Typography>
                <BackupCodes codes={afterSetup.backupCodes ?? []} onDone={() => finish(afterSetup)} doneLabel={t('security.continueToApp')} />
            </>
        );
    }

    if (pending.setup) {
        return (
            <>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5 }}>{t('security.setupTitle')}</Typography>
                <Alert severity="info" sx={{ mb: 2 }}>{t('security.requiredForRole')}</Alert>
                <TwoFactorSetupPanel
                    start={async () => (await api.post('/auth/login/2fa/setup', { challenge: pending.challenge })).data?.data}
                    confirm={async (c) => {
                        const res = unwrap(await api.post('/auth/login/2fa/enable', { challenge: pending.challenge, code: c, trustDevice: trust }));
                        setAfterSetup(res);
                    }}
                    extra={trustBox}
                />
                {back}
            </>
        );
    }

    return (
        <>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5 }}>{t('security.codeTitle')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t(useBackup ? 'security.backupHint' : 'security.codeHint')}
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <CodeField value={code} onChange={setCode} onEnter={submit} autoFocus backup={useBackup} />
            {trustBox}
            <Button
                fullWidth
                variant="contained"
                size="large"
                sx={{ mt: 1 }}
                disabled={busy || (useBackup ? code.trim().length < 10 : code.length !== 6)}
                onClick={submit}
            >
                {busy ? <CircularProgress size={22} /> : t('security.verify')}
            </Button>
            <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Link
                    component="button"
                    type="button"
                    variant="body2"
                    onClick={() => {
                        setUseBackup((v) => !v);
                        setCode('');
                        setError(null);
                    }}
                >
                    {t(useBackup ? 'security.useApp' : 'security.useBackup')}
                </Link>
            </Box>
            {back}
        </>
    );
};

export default TwoFactorStep;
