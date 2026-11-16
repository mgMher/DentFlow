import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { PersonAdd as AddIcon } from '@mui/icons-material';
import api from '../../api/axios';
import { RootState } from '../../store';
import { ConfirmDialog, LoadingSpinner, PageHeader } from '../../components/ui';
import { PlatformAdmin } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import { formatDateTime, getFullName } from '../../utils/formatters';

const unwrap = (res: any) => res.data?.data ?? res.data;

/** F13: the people who run DentFlow. New ones choose their password from an emailed link. */
const PlatformAdminsPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const me = useSelector((state: RootState) => state.auth.user);
    const [admins, setAdmins] = useState<PlatformAdmin[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState({ email: '', firstName: '', lastName: '' });
    const [formError, setFormError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [removing, setRemoving] = useState<PlatformAdmin | null>(null);

    const load = useCallback(() => {
        api.get('/platform/admins')
            .then((res) => setAdmins(unwrap(res)))
            .catch((err) => setError(apiErrorMessage(err)));
    }, []);
    useEffect(load, [load]);

    const add = () => {
        setBusy(true);
        setFormError(null);
        api.post('/platform/admins', form)
            .then((res) => {
                const created = unwrap(res);
                toast[created.inviteSent ? 'success' : 'warning'](t(created.inviteSent ? 'platform.inviteSent' : 'platform.inviteNotSent', { email: created.email }));
                setAdding(false);
                setForm({ email: '', firstName: '', lastName: '' });
                load();
            })
            .catch((err) => setFormError(apiErrorMessage(err)))
            .finally(() => setBusy(false));
    };

    return (
        <Box>
            <PageHeader title={t('platform.platformAdmins')} subtitle={t('platform.platformAdminsSubtitle')}>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setFormError(null); setAdding(true); }}>{t('platform.addAdmin')}</Button>
            </PageHeader>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {!admins ? (
                !error && <LoadingSpinner />
            ) : (
                <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
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
                            {admins.map((a) => (
                                <TableRow key={a._id}>
                                    <TableCell sx={{ minWidth: 180 }}>
                                        <Typography variant="body2" fontWeight={600}>
                                            {getFullName(a.firstName ?? '', a.lastName ?? '') || '—'}
                                            {a._id === me?._id && <Chip size="small" label={t('platform.you')} sx={{ ml: 1 }} />}
                                            {!a.isActive && <Chip size="small" label={t('platform.removedAdmin')} sx={{ ml: 1 }} />}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{a.email}</Typography>
                                    </TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{a.lastLogin ? formatDateTime(a.lastLogin, i18n.language) : t('platform.neverSignedIn')}</TableCell>
                                    <TableCell>
                                        <Chip size="small" color={a.twoFactorEnabled ? 'success' : 'default'} label={t(a.twoFactorEnabled ? 'security.on' : 'security.off')} />
                                    </TableCell>
                                    <TableCell align="right">
                                        {a.isActive && a._id !== me?._id && (
                                            <Button size="small" color="error" onClick={() => setRemoving(a)}>{t('platform.removeAdmin')}</Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Dialog open={adding} onClose={() => setAdding(false)} fullWidth maxWidth="xs">
                <DialogTitle>{t('platform.addAdmin')}</DialogTitle>
                <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
                    {formError && <Alert severity="error">{formError}</Alert>}
                    <Typography variant="body2" color="text.secondary">{t('platform.addAdminHint')}</Typography>
                    <TextField size="small" type="email" label={t('patients.email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoFocus />
                    <TextField size="small" label={t('patients.firstName')} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                    <TextField size="small" label={t('patients.lastName')} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
                    <Button variant="contained" disabled={busy || !form.email.includes('@') || !form.firstName.trim() || !form.lastName.trim()} onClick={add}>
                        {t('platform.sendInvite')}
                    </Button>
                </DialogActions>
            </Dialog>

            <ConfirmDialog
                open={!!removing}
                title={t('platform.removeAdmin')}
                message={removing ? t('platform.removeAdminConfirm', { email: removing.email }) : ''}
                onCancel={() => setRemoving(null)}
                onConfirm={() => {
                    if (!removing) return;
                    const id = removing._id;
                    setRemoving(null);
                    api.delete(`/platform/admins/${id}`)
                        .then(() => {
                            toast.success(t('platform.adminRemoved'));
                            load();
                        })
                        .catch((err) => toast.error(apiErrorMessage(err)));
                }}
            />
        </Box>
    );
};

export default PlatformAdminsPage;
