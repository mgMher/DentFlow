import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
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
    IconButton,
    InputAdornment,
    Link,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { ChevronLeft as PrevIcon, ChevronRight as NextIcon, LockOpen as ReopenIcon, Lock as LockIcon, Percent as RateIcon } from '@mui/icons-material';
import api from '../../api/axios';
import { ConfirmDialog, LoadingSpinner } from '../../components/ui';
import ExportMenu from '../../components/reports/ExportMenu';
import { usePermission } from '../../hooks';
import { CommissionRates, CommissionStatement } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import { minorDigits } from '../../utils/billing';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { ExportSheet } from '../../utils/exportTable';

const unwrap = <T,>(res: { data: any }) => (res.data?.data ?? res.data) as T;
const shiftMonth = (month: string, by: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + by, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const thisMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * F11: a month of dentist commission. Live until an admin approves it; then
 * frozen, with later changes (refunds) settled in the next approved month.
 * Dentists see their own figures.
 */
const CommissionPanel: React.FC = () => {
    const { t, i18n } = useTranslation();
    const can = usePermission();
    const admin = can('viewRevenue');
    const [month, setMonth] = useState(() => shiftMonth(thisMonth(), -1));
    const [data, setData] = useState<CommissionStatement | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<'approve' | 'reopen' | null>(null);
    const [ratesOpen, setRatesOpen] = useState(false);

    const load = useCallback(() => {
        setData(null);
        api.get(`/commission/${month}`)
            .then((res) => {
                setData(unwrap<CommissionStatement>(res));
                setError(null);
            })
            .catch((err) => setError(apiErrorMessage(err)));
    }, [month]);

    useEffect(load, [load]);

    const money = (v: number) => formatCurrency(v, data?.currency);
    // date-fns has the Armenian month names; the browser's Intl often does not.
    const monthLabel = formatDate(`${month}-15`, 'LLLL yyyy', i18n.language);

    const act = async () => {
        const kind = confirm;
        setConfirm(null);
        try {
            if (kind === 'approve') await api.post(`/commission/${month}/approve`);
            else await api.delete(`/commission/${month}/approve`);
            toast.success(t(kind === 'approve' ? 'commission.approvedToast' : 'commission.reopenedToast'));
            load();
        } catch (err) {
            toast.error(apiErrorMessage(err));
        }
    };

    const sheets = (): ExportSheet[] => {
        if (!data) return [];
        return [
            {
                name: `${t('commission.title')} ${month}`,
                columns: [
                    { header: t('appointments.dentist'), type: 'text' },
                    { header: t('commission.collected'), type: 'money' },
                    { header: t('commission.rate'), type: 'percent' },
                    { header: t('commission.commission'), type: 'money' },
                    { header: t('commission.adjustment'), type: 'money' },
                    { header: t('commission.total'), type: 'money' },
                ],
                rows: [
                    ...data.rows.map((r) => [r.name, r.collected, r.rate, r.commission, r.adjustment, r.total]),
                    ...(data.rows.length > 1 ? [[t('commission.totals'), data.totals.collected, null, data.totals.commission, data.totals.adjustment, data.totals.total]] : []),
                ],
            },
            {
                name: t('commission.lines'),
                columns: [
                    { header: t('appointments.dentist'), type: 'text' },
                    { header: t('billing.invoiceNumber'), type: 'text' },
                    { header: t('cash.patient'), type: 'text' },
                    { header: t('commission.work'), type: 'text' },
                    { header: t('commission.collected'), type: 'money' },
                    { header: t('commission.commission'), type: 'money' },
                ],
                rows: data.lines.map((l) => [
                    data.rows.find((r) => r.dentistId === l.dentistId)?.name ?? '',
                    l.invoiceNumber,
                    l.patient,
                    l.description,
                    l.collected,
                    l.commission,
                ]),
            },
        ];
    };

    return (
        <Box>
            <Paper sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <IconButton onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t('commission.previousMonth')}><PrevIcon /></IconButton>
                <Typography variant="h6" sx={{ minWidth: 170, textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel}</Typography>
                <IconButton onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= thisMonth()} aria-label={t('commission.nextMonth')}><NextIcon /></IconButton>
                {data && (
                    <Chip
                        size="small"
                        icon={data.status === 'approved' ? <LockIcon /> : undefined}
                        color={data.status === 'approved' ? 'success' : 'default'}
                        label={t(data.status === 'approved' ? 'commission.approved' : data.ended ? 'commission.notApproved' : 'commission.inProgress')}
                    />
                )}
                <Box sx={{ flexGrow: 1 }} />
                {admin && <Button startIcon={<RateIcon />} onClick={() => setRatesOpen(true)}>{t('commission.rates')}</Button>}
                {data?.canApprove && <Button variant="contained" startIcon={<LockIcon />} onClick={() => setConfirm('approve')}>{t('commission.approve')}</Button>}
                {data?.canReopen && <Button color="warning" startIcon={<ReopenIcon />} onClick={() => setConfirm('reopen')}>{t('commission.reopen')}</Button>}
                <ExportMenu filename={`commission-${month}`} sheets={sheets} moneyDecimals={minorDigits(data?.currency ?? 'AMD')} disabled={!data} />
            </Paper>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {!data ? (
                !error && <LoadingSpinner />
            ) : (
                <>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {data.status === 'approved'
                            ? t('commission.approvedHint', { name: data.approvedBy ?? '', date: data.approvedAt ? formatDateTime(data.approvedAt, i18n.language) : '' })
                            : data.ended
                              ? t('commission.liveHint')
                              : t('commission.inProgressHint')}
                    </Typography>
                    <TableContainer component={Paper} sx={{ mb: 2, overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('appointments.dentist')}</TableCell>
                                    <TableCell align="right">{t('commission.collected')}</TableCell>
                                    <TableCell align="right">{t('commission.rate')}</TableCell>
                                    <TableCell align="right">{t('commission.commission')}</TableCell>
                                    <TableCell align="right">
                                        <Tooltip title={t('commission.adjustmentHint')}><span>{t('commission.adjustment')}</span></Tooltip>
                                    </TableCell>
                                    <TableCell align="right">{t('commission.total')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {data.rows.map((r) => (
                                    <TableRow key={r.dentistId}>
                                        <TableCell>
                                            {r.name}
                                            {!!r.changedSince && (
                                                <Typography variant="caption" color="warning.main" component="div">
                                                    {t('commission.changedSince', { amount: money(r.changedSince) })}
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(r.collected)}</TableCell>
                                        <TableCell align="right">{r.rate}%</TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(r.commission)}</TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: r.adjustment < 0 ? 'error.main' : undefined }}>
                                            {r.adjustment ? money(r.adjustment) : '—'}
                                        </TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{money(r.total)}</TableCell>
                                    </TableRow>
                                ))}
                                {data.rows.length > 1 && (
                                    <TableRow sx={{ '& td': { fontWeight: 700 } }}>
                                        <TableCell>{t('commission.totals')}</TableCell>
                                        <TableCell align="right">{money(data.totals.collected)}</TableCell>
                                        <TableCell />
                                        <TableCell align="right">{money(data.totals.commission)}</TableCell>
                                        <TableCell align="right">{data.totals.adjustment ? money(data.totals.adjustment) : '—'}</TableCell>
                                        <TableCell align="right">{money(data.totals.total)}</TableCell>
                                    </TableRow>
                                )}
                                {!data.rows.length && (
                                    <TableRow><TableCell colSpan={6}><Typography variant="body2" color="text.secondary">{t('commission.none')}</Typography></TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    {!!data.unassigned && (
                        <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 2 }}>
                            {t('commission.unassigned', { amount: money(data.unassigned) })}
                        </Typography>
                    )}

                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>{t('commission.lines')}</Typography>
                    {!data.lines.length ? (
                        <Typography variant="body2" color="text.secondary">{t('commission.noLines')}</Typography>
                    ) : (
                        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        {!data.ownOnly && <TableCell>{t('appointments.dentist')}</TableCell>}
                                        <TableCell>{t('billing.invoiceNumber')}</TableCell>
                                        <TableCell>{t('cash.patient')}</TableCell>
                                        <TableCell>{t('commission.work')}</TableCell>
                                        <TableCell align="right">{t('commission.collected')}</TableCell>
                                        <TableCell align="right">{t('commission.commission')}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {data.lines.map((l, i) => (
                                        <TableRow key={`${l.dentistId}-${l.invoiceId}-${i}`}>
                                            {!data.ownOnly && <TableCell>{data.rows.find((r) => r.dentistId === l.dentistId)?.name}</TableCell>}
                                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                {l.invoiceId ? <Link component={RouterLink} to={`/billing/${l.invoiceId}`}>{l.invoiceNumber}</Link> : '—'}
                                            </TableCell>
                                            <TableCell>{l.patient ?? '—'}</TableCell>
                                            <TableCell sx={{ overflowWrap: 'anywhere' }}>{l.description || '—'}</TableCell>
                                            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(l.collected)}</TableCell>
                                            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(l.commission)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                    {data.status === 'approved' && (
                        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>{t('commission.linesLiveHint')}</Typography>
                    )}
                </>
            )}

            <ConfirmDialog
                open={!!confirm}
                title={t(confirm === 'reopen' ? 'commission.reopen' : 'commission.approve')}
                message={t(confirm === 'reopen' ? 'commission.reopenConfirm' : 'commission.approveConfirm', { month: monthLabel })}
                variant={confirm === 'reopen' ? 'danger' : 'default'}
                onCancel={() => setConfirm(null)}
                onConfirm={act}
            />
            {admin && <RatesDialog open={ratesOpen} onClose={() => setRatesOpen(false)} onSaved={() => { setRatesOpen(false); load(); }} />}
        </Box>
    );
};

/** The clinic default % and each dentist's own (empty = default). */
const RatesDialog: React.FC<{ open: boolean; onClose: () => void; onSaved: () => void }> = ({ open, onClose, onSaved }) => {
    const { t } = useTranslation();
    const [rates, setRates] = useState<CommissionRates | null>(null);
    const [defaultRate, setDefaultRate] = useState('');
    const [own, setOwn] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        setError(null);
        api.get('/commission/rates')
            .then((res) => {
                const r = unwrap<CommissionRates>(res);
                setRates(r);
                setDefaultRate(String(r.defaultRate));
                setOwn(Object.fromEntries(r.dentists.map((d) => [d.dentistId, d.rate === null ? '' : String(d.rate)])));
            })
            .catch((err) => setError(apiErrorMessage(err)));
    }, [open]);

    const valid = (v: string, allowEmpty: boolean) => (v.trim() === '' ? allowEmpty : Number(v) >= 0 && Number(v) <= 100);
    const ok = valid(defaultRate, false) && Object.values(own).every((v) => valid(v, true));

    const save = async () => {
        if (!rates) return;
        setBusy(true);
        setError(null);
        try {
            await api.put('/commission/rates', {
                defaultRate: Number(defaultRate),
                dentists: rates.dentists.map((d) => ({ dentistId: d.dentistId, rate: own[d.dentistId]?.trim() ? Number(own[d.dentistId]) : null })),
            });
            toast.success(t('toast.saveSuccess'));
            onSaved();
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const percent = { endAdornment: <InputAdornment position="end">%</InputAdornment> };
    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{t('commission.rates')}</DialogTitle>
            <DialogContent>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {!rates ? (
                    !error && <LoadingSpinner />
                ) : (
                    <>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('commission.ratesHint')}</Typography>
                        <TextField
                            fullWidth
                            type="number"
                            label={t('commission.defaultRate')}
                            value={defaultRate}
                            onChange={(e) => setDefaultRate(e.target.value)}
                            error={!valid(defaultRate, false)}
                            InputProps={percent}
                            inputProps={{ min: 0, max: 100, step: 0.5 }}
                            sx={{ mb: 2, mt: 1 }}
                        />
                        {rates.dentists.map((d) => (
                            <TextField
                                key={d.dentistId}
                                fullWidth
                                size="small"
                                type="number"
                                label={`${d.firstName} ${d.lastName}`}
                                placeholder={t('commission.useDefault', { rate: defaultRate || 0 })}
                                value={own[d.dentistId] ?? ''}
                                onChange={(e) => setOwn({ ...own, [d.dentistId]: e.target.value })}
                                error={!valid(own[d.dentistId] ?? '', true)}
                                InputProps={percent}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ min: 0, max: 100, step: 0.5 }}
                                sx={{ mb: 1.5 }}
                            />
                        ))}
                    </>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button color="inherit" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
                <Button variant="contained" onClick={save} disabled={busy || !ok || !rates}>{t('common.save')}</Button>
            </DialogActions>
        </Dialog>
    );
};

export default CommissionPanel;
