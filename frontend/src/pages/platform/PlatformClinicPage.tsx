import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
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
    Grid,
    Link,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { ArrowBack as BackIcon, Visibility as ViewIcon } from '@mui/icons-material';
import api, { startSupportSession, SupportSession } from '../../api/axios';
import { ConfirmDialog, LoadingSpinner, PageHeader } from '../../components/ui';
import { PlatformClinicAdmin, PlatformClinicDetail, StaffRole, STAFF_ROLES, SubscriptionStatus } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import { formatDate, formatDateTime, getFullName } from '../../utils/formatters';
import { CLINIC_STATE_COLORS, clinicStateKey, formatBytes, lastDayInput, shiftLastDay } from '../../utils/platform';
import { roleTranslationKey } from '../staff/staffForm';

const unwrap = (res: any) => res.data?.data ?? res.data;
const STATUSES: SubscriptionStatus[] = ['trial', 'active', 'expired', 'cancelled'];

const Figure: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <Box>
        <Typography variant="caption" color="text.secondary" component="div">{label}</Typography>
        <Typography variant="body1" fontWeight={600}>{value}</Typography>
    </Box>
);

/**
 * F13: one clinic in the platform console — its plan and last day, suspension,
 * support view (when the clinic allows it), use, and its admins' sign-in help.
 */
const PlatformClinicPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [clinic, setClinic] = useState<PlatformClinicDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [plan, setPlan] = useState('');
    const [status, setStatus] = useState<SubscriptionStatus | ''>('');
    const [endsOn, setEndsOn] = useState('');
    const [suspending, setSuspending] = useState(false);
    const [reason, setReason] = useState('');
    const [confirm, setConfirm] = useState<{ admin: PlatformClinicAdmin; action: 'reset' | 'twoFactor' } | null>(null);

    const show = useCallback((data: PlatformClinicDetail) => {
        setClinic(data);
        setPlan(data.subscription?.plan ?? '');
        setStatus(data.subscription?.status ?? '');
        setEndsOn(lastDayInput(data.subscription?.expiresAt));
    }, []);

    useEffect(() => {
        api.get(`/platform/clinics/${id}`)
            .then((res) => show(unwrap(res)))
            .catch((err) => setError(apiErrorMessage(err)));
    }, [id, show]);

    const act = (request: Promise<any>, message: string, after?: (data: any) => void) => {
        setBusy(true);
        return request
            .then((res) => {
                toast.success(message);
                after?.(unwrap(res));
            })
            .catch((err) => toast.error(apiErrorMessage(err)))
            .finally(() => setBusy(false));
    };

    if (!clinic) return error ? <Alert severity="error">{error}</Alert> : <LoadingSpinner />;

    const saveSubscription = (end: string | null = endsOn || null) =>
        act(
            api.patch(`/platform/clinics/${clinic._id}/subscription`, { plan, ...(status ? { status } : {}), endsOn: end }),
            t('toast.saveSuccess'),
            show,
        );

    const openSupport = () =>
        act(api.post(`/platform/clinics/${clinic._id}/support-session`), t('support.opening'), (session: SupportSession) => {
            startSupportSession(session);
            // A fresh start, so nothing of the console is kept in the clinic's pages.
            window.location.href = '/dashboard';
        });

    const supportUntil = clinic.supportAccessUntil && new Date(clinic.supportAccessUntil) > new Date() ? clinic.supportAccessUntil : null;
    const suspended = clinic.state === 'suspended';

    return (
        <Box>
            <PageHeader title={clinic.name}>
                <Button variant="outlined" startIcon={<BackIcon />} onClick={() => navigate('/platform')}>{t('common.back')}</Button>
            </PageHeader>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 3, mt: -1 }}>
                <Chip color={CLINIC_STATE_COLORS[clinic.state]} label={t(clinicStateKey(clinic.state))} />
                <Typography variant="body2" color="text.secondary">
                    {t('platform.registered', { date: formatDate(clinic.createdAt, 'dd.MM.yyyy', i18n.language) })}
                </Typography>
                <Link component={RouterLink} to={`/platform/audit?clinicId=${clinic._id}`} variant="body2">{t('platform.clinicLog')}</Link>
            </Box>

            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ display: 'grid', gap: 2 }}>
                            <Typography variant="h6" fontWeight={600}>{t('subscription.title')}</Typography>
                            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                                <TextField size="small" label={t('subscription.plan')} value={plan} onChange={(e) => setPlan(e.target.value)} inputProps={{ maxLength: 50 }} />
                                <TextField select size="small" label={t('subscription.statusLabel')} value={status} onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}>
                                    {STATUSES.map((s) => (
                                        <MenuItem key={s} value={s}>{t(`subscription.status.${s}`)}</MenuItem>
                                    ))}
                                </TextField>
                            </Box>
                            <TextField
                                type="date"
                                size="small"
                                label={t('platform.lastDay')}
                                value={endsOn}
                                onChange={(e) => setEndsOn(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                helperText={endsOn ? t('platform.lastDayHint') : t('platform.noEnd')}
                            />
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                <Button size="small" onClick={() => setEndsOn(shiftLastDay(clinic.subscription?.expiresAt, 30))}>{t('platform.plus30')}</Button>
                                <Button size="small" onClick={() => setEndsOn(shiftLastDay(clinic.subscription?.expiresAt, 365))}>{t('platform.plusYear')}</Button>
                                <Button size="small" onClick={() => setEndsOn('')}>{t('platform.noEnd')}</Button>
                                <Box sx={{ flexGrow: 1 }} />
                                <Button variant="contained" disabled={busy} onClick={() => saveSubscription()}>{t('common.save')}</Button>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ display: 'grid', gap: 2 }}>
                            <Typography variant="h6" fontWeight={600}>{t('support.title')}</Typography>
                            {suspended ? (
                                <Alert severity="warning">{t('support.notWhileSuspended')}</Alert>
                            ) : supportUntil ? (
                                <>
                                    <Typography variant="body2">{t('support.clinicAllows', { time: formatDateTime(supportUntil, i18n.language) })}</Typography>
                                    <Box>
                                        <Button variant="contained" startIcon={<ViewIcon />} disabled={busy} onClick={openSupport}>{t('support.open')}</Button>
                                    </Box>
                                    <Typography variant="caption" color="text.secondary">{t('support.openHint')}</Typography>
                                </>
                            ) : (
                                <Typography variant="body2" color="text.secondary">{t('support.notAllowed')}</Typography>
                            )}

                            <Typography variant="h6" fontWeight={600} sx={{ mt: 1 }}>{t('platform.access')}</Typography>
                            {suspended ? (
                                <>
                                    <Alert severity="error">
                                        {t('platform.suspendedSince', {
                                            date: clinic.suspendedAt ? formatDateTime(clinic.suspendedAt, i18n.language) : '—',
                                            reason: clinic.suspendReason ?? '—',
                                        })}
                                    </Alert>
                                    <Box>
                                        <Button variant="contained" disabled={busy} onClick={() => act(api.post(`/platform/clinics/${clinic._id}/reactivate`), t('platform.reactivated'), show)}>
                                            {t('platform.reactivate')}
                                        </Button>
                                    </Box>
                                </>
                            ) : (
                                <>
                                    <Typography variant="body2" color="text.secondary">{t('platform.suspendHint')}</Typography>
                                    <Box>
                                        <Button color="error" variant="outlined" onClick={() => { setReason(''); setSuspending(true); }}>{t('platform.suspend')}</Button>
                                    </Box>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>{t('platform.usageTitle')}</Typography>
                            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)', md: 'repeat(7, 1fr)' } }}>
                                <Figure label={t('platform.usage.staff')} value={clinic.usage.staff} />
                                <Figure label={t('platform.usage.patients')} value={clinic.usage.patients} />
                                <Figure label={t('platform.usage.appointments30')} value={clinic.usage.appointments30} />
                                <Figure label={t('platform.usage.invoices30')} value={clinic.usage.invoices30} />
                                <Figure label={t('platform.usage.documents')} value={clinic.usage.documents} />
                                <Figure label={t('platform.usage.storage')} value={formatBytes(clinic.usage.documentBytes)} />
                                <Figure label={t('platform.usage.lastSignIn')} value={clinic.usage.lastSignIn ? formatDateTime(clinic.usage.lastSignIn, i18n.language) : '—'} />
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                                {STAFF_ROLES.filter((r: StaffRole) => clinic.staffByRole[r]).map((r: StaffRole) => (
                                    <Chip key={r} size="small" variant="outlined" label={`${t(`staff.${roleTranslationKey(r)}`)}: ${clinic.staffByRole[r]}`} />
                                ))}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>{t('platform.admins')}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('platform.adminsHint')}</Typography>
                            <TableContainer sx={{ overflowX: 'auto' }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>{t('platform.person')}</TableCell>
                                            <TableCell>{t('platform.usage.lastSignIn')}</TableCell>
                                            <TableCell>{t('security.twoFactor')}</TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {clinic.admins.map((a) => (
                                            <TableRow key={a._id}>
                                                <TableCell sx={{ minWidth: 180 }}>
                                                    <Typography variant="body2" fontWeight={600}>{getFullName(a.firstName ?? '', a.lastName ?? '') || '—'}</Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{a.email}</Typography>
                                                    {!a.isActive && <Chip size="small" label={t('platform.deactivated')} sx={{ ml: 1 }} />}
                                                    {a.locked && <Chip size="small" color="warning" label={t('platform.locked')} sx={{ ml: 1 }} />}
                                                </TableCell>
                                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{a.lastLogin ? formatDateTime(a.lastLogin, i18n.language) : '—'}</TableCell>
                                                <TableCell>
                                                    <Chip size="small" color={a.twoFactorEnabled ? 'success' : 'default'} label={t(a.twoFactorEnabled ? 'security.on' : 'security.off')} />
                                                </TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                    <Button size="small" disabled={busy || !a.isActive} onClick={() => setConfirm({ admin: a, action: 'reset' })}>{t('platform.sendReset')}</Button>
                                                    {a.twoFactorEnabled && (
                                                        <Button size="small" color="warning" disabled={busy} onClick={() => setConfirm({ admin: a, action: 'twoFactor' })}>
                                                            {t('platform.resetTwoFactor')}
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>{t('platform.details')}</Typography>
                            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' } }}>
                                <Figure label={t('patients.email')} value={clinic.email || '—'} />
                                <Figure label={t('patients.phone')} value={clinic.phone || '—'} />
                                <Figure label={t('platform.address')} value={[clinic.address?.street, clinic.address?.city, clinic.address?.country].filter(Boolean).join(', ') || '—'} />
                                <Figure label={t('platform.language')} value={clinic.language ? t(`reminders.languages.${clinic.language}`) : '—'} />
                                <Figure label={t('platform.currency')} value={clinic.currency ?? '—'} />
                                <Figure label={t('platform.timezone')} value={clinic.timezone ?? '—'} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Dialog open={suspending} onClose={() => setSuspending(false)} fullWidth maxWidth="xs">
                <DialogTitle>{t('platform.suspend')}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2 }}>{t('platform.suspendExplain', { clinic: clinic.name })}</Typography>
                    <TextField autoFocus fullWidth size="small" label={t('platform.suspendReason')} value={reason} onChange={(e) => setReason(e.target.value)} inputProps={{ maxLength: 500 }} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSuspending(false)}>{t('common.cancel')}</Button>
                    <Button
                        color="error"
                        variant="contained"
                        disabled={busy || reason.trim().length < 3}
                        onClick={() => act(api.post(`/platform/clinics/${clinic._id}/suspend`, { reason }), t('platform.suspended'), (data) => { setSuspending(false); show(data); })}
                    >
                        {t('platform.suspend')}
                    </Button>
                </DialogActions>
            </Dialog>

            <ConfirmDialog
                open={!!confirm}
                title={confirm?.action === 'twoFactor' ? t('platform.resetTwoFactor') : t('platform.sendReset')}
                message={
                    confirm
                        ? t(confirm.action === 'twoFactor' ? 'platform.resetTwoFactorConfirm' : 'platform.sendResetConfirm', { email: confirm.admin.email })
                        : ''
                }
                onCancel={() => setConfirm(null)}
                onConfirm={() => {
                    if (!confirm) return;
                    const { admin, action } = confirm;
                    setConfirm(null);
                    const base = `/platform/clinics/${clinic._id}/users/${admin._id}`;
                    if (action === 'reset') {
                        act(api.post(`${base}/password-reset`), t('platform.resetSent', { email: admin.email }));
                    } else {
                        act(api.post(`${base}/reset-two-factor`), t('platform.twoFactorReset'), () =>
                            api.get(`/platform/clinics/${clinic._id}`).then((res) => show(unwrap(res))),
                        );
                    }
                }}
            />
        </Box>
    );
};

export default PlatformClinicPage;
