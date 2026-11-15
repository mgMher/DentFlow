import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    Typography,
} from '@mui/material';
import { Computer as DeviceIcon, Key as KeyIcon, Logout as LogoutIcon, Security as ShieldIcon } from '@mui/icons-material';
import api from '../../api/axios';
import { ConfirmDialog, PageHeader, PasswordDialog } from '../../components/ui';
import BackupCodes from '../../components/auth/BackupCodes';
import CodeField from '../../components/auth/CodeField';
import TwoFactorSetupPanel from '../../components/auth/TwoFactorSetupPanel';
import { useHttpState } from '../../hooks';
import { authActions } from '../../store/auth';
import { SignedInDevice, TwoFactorStatus } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { deviceName } from '../../utils/devices';

const unwrap = (res: { data: any }) => res.data?.data ?? res.data;

type CodeAction = 'disable' | 'backupCodes';

/** F9: my password, two-factor sign-in and signed-in devices. */
const AccountSecurityPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const dispatch = useDispatch();
    const changePassword = useHttpState('CHANGE_PASSWORD');
    const [status, setStatus] = useState<TwoFactorStatus | null>(null);
    const [devices, setDevices] = useState<SignedInDevice[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [passwordOpen, setPasswordOpen] = useState(false);
    const [settingUp, setSettingUp] = useState(false);
    const [codes, setCodes] = useState<string[] | null>(null);
    const [codeAction, setCodeAction] = useState<CodeAction | null>(null);
    const [code, setCode] = useState('');
    const [codeError, setCodeError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [everywhere, setEverywhere] = useState(false);

    const load = useCallback(() => {
        Promise.all([api.get('/auth/2fa'), api.get('/auth/sessions')])
            .then(([s, d]) => {
                setStatus(unwrap(s));
                setDevices(unwrap(d));
            })
            .catch((err) => setError(apiErrorMessage(err)));
    }, []);

    useEffect(load, [load]);

    useEffect(() => {
        if (!changePassword.success) return;
        // The success toast is global (store/http/toasts); other devices were signed out.
        changePassword.clearSuccess();
        setPasswordOpen(false);
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [changePassword.success]);

    const runCodeAction = async () => {
        setBusy(true);
        setCodeError(null);
        try {
            if (codeAction === 'disable') {
                await api.post('/auth/2fa/disable', { code: code.trim() });
                toast.success(t('security.turnedOff'));
            } else {
                setCodes(unwrap(await api.post('/auth/2fa/backup-codes', { code: code.trim() })).backupCodes);
            }
            setCodeAction(null);
            setCode('');
            load();
        } catch (err) {
            setCodeError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const signOut = async (device: SignedInDevice) => {
        try {
            await api.delete(`/auth/sessions/${device._id}`);
            toast.success(t('security.deviceSignedOut'));
        } catch (err) {
            toast.error(apiErrorMessage(err));
        }
        load();
    };

    return (
        <Box>
            <PageHeader title={t('security.title')} />
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                                <ShieldIcon color="action" />
                                <Typography variant="h6" fontWeight={600} sx={{ flexGrow: 1 }}>{t('security.twoFactor')}</Typography>
                                {status && (
                                    <Chip
                                        size="small"
                                        color={status.enabled ? 'success' : status.required ? 'warning' : 'default'}
                                        label={t(status.enabled ? 'security.on' : 'security.off')}
                                    />
                                )}
                            </Box>
                            <Divider sx={{ mb: 2 }} />
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('security.twoFactorAbout')}</Typography>
                            {status?.required && (
                                <Alert severity={status.enabled ? 'info' : 'warning'} sx={{ mb: 2 }}>
                                    {t(status.enabled ? 'security.requiredOn' : 'security.requiredOff')}
                                </Alert>
                            )}
                            {status?.enabled ? (
                                <>
                                    <Typography variant="body2">
                                        {t('security.enabledOn', { date: status.enabledAt ? formatDate(status.enabledAt, 'dd.MM.yyyy', i18n.language) : '' })}
                                    </Typography>
                                    <Typography variant="body2" color={status.backupCodesLeft <= 2 ? 'warning.main' : 'text.secondary'} sx={{ mb: 2 }}>
                                        {t('security.backupLeft', { count: status.backupCodesLeft })}
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        <Button variant="outlined" startIcon={<KeyIcon />} onClick={() => setCodeAction('backupCodes')}>
                                            {t('security.newBackupCodes')}
                                        </Button>
                                        {!status.required && (
                                            <Button color="error" onClick={() => setCodeAction('disable')}>{t('security.turnOff')}</Button>
                                        )}
                                    </Box>
                                </>
                            ) : (
                                status && <Button variant="contained" onClick={() => setSettingUp(true)}>{t('security.setUp')}</Button>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <KeyIcon color="action" />
                                <Typography variant="h6" fontWeight={600}>{t('auth.changePassword')}</Typography>
                            </Box>
                            <Divider sx={{ mb: 2 }} />
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('auth.changePasswordHint')}</Typography>
                            <Button variant="outlined" onClick={() => { changePassword.clearError(); setPasswordOpen(true); }}>
                                {t('auth.changePassword')}
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                                <DeviceIcon color="action" />
                                <Typography variant="h6" fontWeight={600} sx={{ flexGrow: 1 }}>{t('security.devices')}</Typography>
                                <Button color="error" startIcon={<LogoutIcon />} onClick={() => setEverywhere(true)}>{t('auth.logoutAll')}</Button>
                            </Box>
                            <Divider />
                            {devices?.map((d) => (
                                <Box key={d._id} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
                                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                            <Typography variant="body2" fontWeight={600}>{deviceName(d.userAgent) || t('security.unknownDevice')}</Typography>
                                            {d.current && <Chip size="small" color="primary" label={t('security.thisDevice')} />}
                                        </Box>
                                        <Typography variant="caption" color="text.secondary">
                                            {[d.ip, t('security.lastUsed', { date: formatDateTime(d.lastUsedAt, i18n.language) }), t('security.signedInOn', { date: formatDate(d.createdAt, 'dd.MM.yyyy', i18n.language) })]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </Typography>
                                    </Box>
                                    {!d.current && <Button size="small" onClick={() => signOut(d)}>{t('security.signOutDevice')}</Button>}
                                </Box>
                            ))}
                            {status && status.trustedDevices > 0 && (
                                <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
                                    {t('security.trustedCount', { count: status.trustedDevices })}
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Dialog open={settingUp} onClose={() => setSettingUp(false)} maxWidth="xs" fullWidth>
                <DialogTitle>{t('security.setupTitle')}</DialogTitle>
                <DialogContent>
                    {settingUp && (
                        <TwoFactorSetupPanel
                            start={async () => unwrap(await api.post('/auth/2fa/setup'))}
                            confirm={async (c) => {
                                const res = unwrap(await api.post('/auth/2fa/enable', { code: c }));
                                setSettingUp(false);
                                setCodes(res.backupCodes);
                                load();
                            }}
                        />
                    )}
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={() => setSettingUp(false)}>{t('common.cancel')}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={!!codes} maxWidth="xs" fullWidth>
                <DialogTitle>{t('security.backupCodes')}</DialogTitle>
                <DialogContent>{codes && <BackupCodes codes={codes} onDone={() => setCodes(null)} />}</DialogContent>
            </Dialog>

            <Dialog open={!!codeAction} onClose={() => setCodeAction(null)} maxWidth="xs" fullWidth>
                <DialogTitle>{t(codeAction === 'disable' ? 'security.turnOff' : 'security.newBackupCodes')}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t(codeAction === 'disable' ? 'security.turnOffHint' : 'security.newBackupCodesHint')}
                    </Typography>
                    {codeError && <Alert severity="error" sx={{ mb: 2 }}>{codeError}</Alert>}
                    <CodeField value={code} onChange={setCode} onEnter={runCodeAction} autoFocus />
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={() => { setCodeAction(null); setCode(''); setCodeError(null); }}>{t('common.cancel')}</Button>
                    <Button variant="contained" color={codeAction === 'disable' ? 'error' : 'primary'} disabled={busy || code.length !== 6} onClick={runCodeAction}>
                        {t('common.confirm')}
                    </Button>
                </DialogActions>
            </Dialog>

            <ConfirmDialog
                open={everywhere}
                title={t('auth.logoutAll')}
                message={t('security.logoutAllHint')}
                confirmLabel={t('auth.logoutAll')}
                variant="danger"
                onCancel={() => setEverywhere(false)}
                onConfirm={() => dispatch(authActions.logoutAll())}
            />

            <PasswordDialog
                open={passwordOpen}
                title={t('auth.changePassword')}
                description={t('auth.changePasswordHint')}
                requireCurrent
                loading={changePassword.loading}
                error={changePassword.error}
                onSubmit={(values) => dispatch(authActions.changePassword({ currentPassword: values.currentPassword || '', newPassword: values.newPassword }))}
                onClose={() => setPasswordOpen(false)}
            />
        </Box>
    );
};

export default AccountSecurityPage;
