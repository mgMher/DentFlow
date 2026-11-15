import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Link, TextField } from '@mui/material';
import api from '../../api/axios';
import AuthShell from '../../components/auth/AuthShell';
import { apiErrorMessage } from '../../utils/apiError';
import { EMAIL_PATTERN } from '../../utils/validators';

/** F9: ask for a reset link by email. The answer never says whether the address has an account. */
const ForgotPasswordPage: React.FC = () => {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const valid = EMAIL_PATTERN.test(email.trim());

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!valid) return;
        setBusy(true);
        setError(null);
        try {
            await api.post('/auth/forgot-password', { email: email.trim() });
            setSent(true);
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <AuthShell title={t('security.forgotTitle')} subtitle={sent ? undefined : t('security.forgotSubtitle')}>
            {sent ? (
                <Alert severity="success" sx={{ mb: 2 }}>{t('security.forgotSent', { email: email.trim() })}</Alert>
            ) : (
                <Box component="form" onSubmit={submit} noValidate>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    <TextField
                        fullWidth
                        autoFocus
                        type="email"
                        label={t('auth.email')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        error={!!email && !valid}
                        helperText={email && !valid ? t('validation.invalidEmail') : ' '}
                        autoComplete="email"
                    />
                    <Button type="submit" fullWidth variant="contained" size="large" disabled={busy || !valid} sx={{ mt: 1 }}>
                        {busy ? <CircularProgress size={22} /> : t('security.sendLink')}
                    </Button>
                </Box>
            )}
            <Box sx={{ textAlign: 'center', mt: 3 }}>
                <Link component={RouterLink} to="/login" variant="body2">{t('security.backToLogin')}</Link>
            </Box>
            {!sent && (
                <Alert severity="info" sx={{ mt: 3 }} icon={false}>
                    {t('security.forgotNoEmail')}
                </Alert>
            )}
        </AuthShell>
    );
};

export default ForgotPasswordPage;
