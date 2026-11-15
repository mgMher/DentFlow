import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, IconButton, InputAdornment, Link, TextField } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import api from '../../api/axios';
import AuthShell from '../../components/auth/AuthShell';
import { apiErrorMessage } from '../../utils/apiError';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../utils/password';

/** F9: the page the emailed link opens. A new password signs out every device. */
const ResetPasswordPage: React.FC = () => {
    const { t } = useTranslation();
    const [params] = useSearchParams();
    const token = params.get('token') ?? '';
    const [password, setPassword] = useState('');
    const [repeat, setRepeat] = useState('');
    const [show, setShow] = useState(false);
    const [done, setDone] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const tooShort = password.length > 0 && password.length < PASSWORD_MIN_LENGTH;
    const mismatch = repeat.length > 0 && repeat !== password;
    const valid = password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH && password === repeat;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!valid) return;
        setBusy(true);
        setError(null);
        try {
            await api.post('/auth/reset-password', { token, newPassword: password });
            setDone(true);
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const eye = (
        <InputAdornment position="end">
            <IconButton onClick={() => setShow((v) => !v)} edge="end" aria-label={t(show ? 'auth.hidePassword' : 'auth.showPassword')}>
                {show ? <VisibilityOff /> : <Visibility />}
            </IconButton>
        </InputAdornment>
    );

    return (
        <AuthShell title={t('security.resetTitle')} subtitle={done || !token ? undefined : t('security.resetSubtitle')}>
            {!token ? (
                <Alert severity="error">{t('errors.resetLinkInvalid')}</Alert>
            ) : done ? (
                <>
                    <Alert severity="success" sx={{ mb: 2 }}>{t('security.resetDone')}</Alert>
                    <Button component={RouterLink} to="/login" fullWidth variant="contained" size="large">{t('auth.login')}</Button>
                </>
            ) : (
                <Box component="form" onSubmit={submit} noValidate>
                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}{' '}
                            <Link component={RouterLink} to="/forgot-password">{t('security.requestNewLink')}</Link>
                        </Alert>
                    )}
                    <TextField
                        fullWidth
                        autoFocus
                        type={show ? 'text' : 'password'}
                        label={t('security.newPassword')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        error={tooShort}
                        helperText={tooShort ? t('validation.passwordMin') : ' '}
                        autoComplete="new-password"
                        InputProps={{ endAdornment: eye }}
                        inputProps={{ maxLength: PASSWORD_MAX_LENGTH }}
                    />
                    <TextField
                        fullWidth
                        type={show ? 'text' : 'password'}
                        label={t('security.repeatPassword')}
                        value={repeat}
                        onChange={(e) => setRepeat(e.target.value)}
                        error={mismatch}
                        helperText={mismatch ? t('validation.passwordMatch') : ' '}
                        autoComplete="new-password"
                        inputProps={{ maxLength: PASSWORD_MAX_LENGTH }}
                    />
                    <Button type="submit" fullWidth variant="contained" size="large" disabled={busy || !valid} sx={{ mt: 1 }}>
                        {busy ? <CircularProgress size={22} /> : t('security.setPassword')}
                    </Button>
                </Box>
            )}
            {!done && (
                <Box sx={{ textAlign: 'center', mt: 3 }}>
                    <Link component={RouterLink} to="/login" variant="body2">{t('security.backToLogin')}</Link>
                </Box>
            )}
        </AuthShell>
    );
};

export default ResetPasswordPage;
