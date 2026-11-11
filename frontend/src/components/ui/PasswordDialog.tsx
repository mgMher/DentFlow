import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    Stack,
    TextField,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../utils/password';

export interface PasswordDialogValues {
    currentPassword?: string;
    newPassword: string;
}

interface PasswordDialogProps {
    open: boolean;
    title: string;
    /** Shown above the fields, e.g. "They will be signed out on every device." */
    description?: string;
    /** Changing your own password asks for the current one; an admin reset does not. */
    requireCurrent?: boolean;
    loading?: boolean;
    error?: string | null;
    onSubmit: (values: PasswordDialogValues) => void;
    onClose: () => void;
}

/**
 * New-password form shared by "Change password" (self) and "Reset password"
 * (admin). The parent closes it on success, so a server error keeps what was typed.
 */
const PasswordDialog: React.FC<PasswordDialogProps> = ({
    open,
    title,
    description,
    requireCurrent,
    loading,
    error,
    onSubmit,
    onClose,
}) => {
    const { t } = useTranslation();
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [show, setShow] = useState(false);
    const [touched, setTouched] = useState(false);

    useEffect(() => {
        if (open) {
            setCurrent('');
            setNext('');
            setConfirm('');
            setShow(false);
            setTouched(false);
        }
    }, [open]);

    const nextError =
        next.length < PASSWORD_MIN_LENGTH
            ? t('validation.passwordMin')
            : next.length > PASSWORD_MAX_LENGTH
              ? t('validation.passwordMax', { max: PASSWORD_MAX_LENGTH })
              : null;
    const confirmError = confirm !== next ? t('validation.passwordMatch') : null;
    const currentError = requireCurrent && !current ? t('validation.required') : null;
    const invalid = !!(nextError || confirmError || currentError);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setTouched(true);
        if (invalid) return;
        onSubmit(requireCurrent ? { currentPassword: current, newPassword: next } : { newPassword: next });
    };

    const visibility = (
        <InputAdornment position="end">
            <IconButton size="small" edge="end" onClick={() => setShow((v) => !v)} aria-label={t('auth.showPassword')}>
                {show ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
            </IconButton>
        </InputAdornment>
    );

    return (
        <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
            <form onSubmit={submit} noValidate>
                <DialogTitle>{title}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {description && <Alert severity="info">{description}</Alert>}
                        {error && <Alert severity="error">{error}</Alert>}
                        {requireCurrent && (
                            <TextField
                                label={t('auth.currentPassword')}
                                type={show ? 'text' : 'password'}
                                autoComplete="current-password"
                                value={current}
                                onChange={(e) => setCurrent(e.target.value)}
                                error={touched && !!currentError}
                                helperText={touched ? currentError : undefined}
                                InputProps={{ endAdornment: visibility }}
                                autoFocus
                                fullWidth
                            />
                        )}
                        <TextField
                            label={t('auth.newPassword')}
                            type={show ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={next}
                            onChange={(e) => setNext(e.target.value)}
                            error={touched && !!nextError}
                            helperText={touched && nextError ? nextError : t('validation.passwordMin')}
                            InputProps={requireCurrent ? undefined : { endAdornment: visibility }}
                            autoFocus={!requireCurrent}
                            fullWidth
                        />
                        <TextField
                            label={t('auth.confirmPassword')}
                            type={show ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            error={touched && !!confirmError}
                            helperText={touched ? confirmError : undefined}
                            fullWidth
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={onClose} color="inherit" disabled={loading}>
                        {t('common.cancel')}
                    </Button>
                    <Button type="submit" variant="contained" disabled={loading}>
                        {loading ? t('common.loading') : t('common.save')}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default PasswordDialog;
