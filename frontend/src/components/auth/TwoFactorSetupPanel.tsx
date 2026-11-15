import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { TwoFactorSetup } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import CodeField from './CodeField';

interface TwoFactorSetupPanelProps {
    /** Starts setup on the server: a new secret and its QR code. */
    start: () => Promise<TwoFactorSetup>;
    /** Confirms the first code from the app. */
    confirm: (code: string) => Promise<void>;
    /** E.g. "trust this device" on the sign-in page. */
    extra?: React.ReactNode;
}

/** Scan the QR code (or type the key), then enter the first code (F9). */
const TwoFactorSetupPanel: React.FC<TwoFactorSetupPanelProps> = ({ start, confirm, extra }) => {
    const { t } = useTranslation();
    const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let live = true;
        start()
            .then((s) => live && setSetup(s))
            .catch((err) => live && setError(apiErrorMessage(err)));
        return () => {
            live = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const submit = async () => {
        setBusy(true);
        setError(null);
        try {
            await confirm(code);
        } catch (err) {
            setError(apiErrorMessage(err));
            setCode('');
        } finally {
            setBusy(false);
        }
    };

    if (!setup) return error ? <Alert severity="error">{error}</Alert> : <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress /></Box>;

    return (
        <Box>
            <Typography variant="body2" sx={{ mb: 1.5 }}>{t('security.scanStep')}</Typography>
            <Box sx={{ textAlign: 'center', mb: 1.5 }}>
                <Box component="img" src={setup.qr} alt={t('security.qrAlt')} sx={{ width: 200, height: 200, borderRadius: 1, border: 1, borderColor: 'divider' }} />
            </Box>
            <Typography variant="caption" color="text.secondary" component="div">{t('security.manualKey')}</Typography>
            <Typography
                data-testid="totp-secret"
                sx={{ fontFamily: 'monospace', wordBreak: 'break-all', mb: 2, userSelect: 'all' }}
            >
                {setup.secret.match(/.{1,4}/g)?.join(' ')}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>{t('security.enterFirstCode')}</Typography>
            {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
            <CodeField value={code} onChange={setCode} onEnter={submit} autoFocus />
            {extra}
            <Button fullWidth variant="contained" sx={{ mt: 2 }} disabled={busy || code.length !== 6} onClick={submit}>
                {busy ? <CircularProgress size={22} /> : t('security.turnOn')}
            </Button>
        </Box>
    );
};

export default TwoFactorSetupPanel;
