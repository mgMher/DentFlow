import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Chip,
    Grid,
    IconButton,
    InputAdornment,
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
import {
    AccountBalanceWallet as CashIcon,
    ChevronLeft as PrevIcon,
    ChevronRight as NextIcon,
    Lock as CloseIcon,
    Payments as ReceivedIcon,
    Print as PrintIcon,
    Replay as RefundIcon,
    Savings as NetIcon,
    Today as TodayIcon,
} from '@mui/icons-material';
import { addDays, format, parseISO } from 'date-fns';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { LoadingSpinner, PageHeader, StatCard } from '../../components/ui';
import BillingNav from '../../components/billing/BillingNav';
import { usePermission } from '../../hooks';
import { CashReport, CashReportLine } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import { fitsCurrency, minorDigits, paymentMethodKey } from '../../utils/billing';
import { formatCurrency, formatDate, formatDateTime, formatTime } from '../../utils/formatters';
import { patientName, staffName } from '../../utils/references';
import { toLocalDateString } from '../../utils/dates';

const unwrap = (res: { data: any }) => res.data?.data ?? res.data;

/**
 * The day's money (F5 "Z-report"): received and refunded by method and by
 * cashier, the cash that should be in the drawer, and closing the day with
 * the cash actually counted.
 */
const CashReportPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const can = usePermission();
    const today = toLocalDateString();
    const [date, setDate] = useState(today);
    const [report, setReport] = useState<CashReport | null>(null);
    const [counted, setCounted] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            setReport(unwrap(await api.get('/billing/cash-report', { params: { date } })));
        } catch (err) {
            setError(apiErrorMessage(err));
        }
    }, [date]);

    useEffect(() => {
        setReport(null);
        setCounted('');
        setNote('');
        load();
    }, [load]);

    const shift = (days: number) => setDate(format(addDays(parseISO(date), days), 'yyyy-MM-dd'));
    const money = (n: number) => formatCurrency(n, report?.currency);
    const digits = minorDigits(report?.currency ?? 'AMD');
    const countedValue = counted.trim() === '' ? NaN : Number(counted);
    const countedOk = Number.isFinite(countedValue) && countedValue >= 0 && fitsCurrency(countedValue, digits);

    const close = async () => {
        if (!countedOk) return;
        setBusy(true);
        try {
            setReport(
                unwrap(
                    await api.post('/billing/cash-report/close', {
                        date,
                        countedCash: countedValue,
                        note: note.trim() || undefined,
                    }),
                ),
            );
            toast.success(t('cash.closed'));
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };
    const reopen = async () => {
        setBusy(true);
        try {
            setReport(unwrap(await api.delete(`/billing/cash-report/${date}/close`)));
            toast.success(t('cash.reopened'));
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const LineTable: React.FC<{ lines: CashReportLine[]; refunds?: boolean }> = ({ lines, refunds }) => (
        <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>{t('cash.time')}</TableCell>
                        <TableCell>{t('cash.patient')}</TableCell>
                        <TableCell>{t('billing.invoice')}</TableCell>
                        <TableCell>{t('billing.paymentMethod')}</TableCell>
                        <TableCell align="right">{t('billing.amount')}</TableCell>
                        <TableCell>{refunds ? t('cash.refundedBy') : t('cash.cashier')}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {lines.map((l) => (
                        <TableRow key={`${l._id}-${refunds ? 'r' : 'p'}`}>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatTime(l.at)}</TableCell>
                            <TableCell>{patientName(l.patient as any)}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                {l.invoiceId ? (
                                    <Button
                                        size="small"
                                        sx={{ p: 0, minWidth: 0 }}
                                        onClick={() => navigate(`/billing/${l.invoiceId}`)}
                                    >
                                        {l.invoiceNumber}
                                    </Button>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">
                                        {t('cash.onAccount')}
                                    </Typography>
                                )}
                            </TableCell>
                            <TableCell>{t(paymentMethodKey(l.method))}</TableCell>
                            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                {money(l.amount)}
                                {!refunds && l.refunded && <Chip size="small" label={t('cash.refundedLater')} sx={{ ml: 1 }} />}
                            </TableCell>
                            <TableCell>{l.by}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );

    return (
        <Box>
            <Box sx={{ displayPrint: 'none' }}>
                <PageHeader title={t('billing.title')} />
                <BillingNav />
            </Box>

            <Paper
                sx={{
                    p: 2,
                    mb: 2,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                    alignItems: 'center',
                    displayPrint: 'none',
                }}
            >
                <IconButton onClick={() => shift(-1)} aria-label={t('common.previous')}>
                    <PrevIcon />
                </IconButton>
                <TextField
                    type="date"
                    size="small"
                    value={date}
                    onChange={(e) => e.target.value && setDate(e.target.value)}
                    inputProps={{ max: today, 'aria-label': t('common.date') }}
                />
                <IconButton onClick={() => shift(1)} disabled={date >= today} aria-label={t('common.next')}>
                    <NextIcon />
                </IconButton>
                <Button startIcon={<TodayIcon />} onClick={() => setDate(today)} disabled={date === today}>
                    {t('appointments.today')}
                </Button>
                <Box sx={{ flex: 1 }} />
                <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()} disabled={!report}>
                    {t('cash.print')}
                </Button>
            </Paper>

            <Typography variant="h5" sx={{ display: 'none', displayPrint: 'block', mb: 2 }}>
                {t('cash.title')} — {formatDate(date, 'dd.MM.yyyy', i18n.language)}
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}
            {!report ? (
                <LoadingSpinner />
            ) : (
                <>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={12} sm={6} lg={3}>
                            <StatCard
                                title={t('cash.received')}
                                value={money(report.totals.received)}
                                icon={<ReceivedIcon />}
                                color="#38A169"
                                caption={{
                                    text: [
                                        t('reports.paymentsCount', { count: report.totals.count }),
                                        report.totals.onAccount
                                            ? t('reports.onAccount', {
                                                  amount: money(report.totals.onAccount),
                                              })
                                            : '',
                                    ]
                                        .filter(Boolean)
                                        .join(' · '),
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} lg={3}>
                            <StatCard
                                title={t('cash.refunded')}
                                value={money(report.totals.refunded)}
                                icon={<RefundIcon />}
                                color="#E53E3E"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} lg={3}>
                            <StatCard title={t('cash.net')} value={money(report.totals.net)} icon={<NetIcon />} color="#3182CE" />
                        </Grid>
                        <Grid item xs={12} sm={6} lg={3}>
                            <StatCard
                                title={t('cash.expectedCash')}
                                value={money(report.expectedCash)}
                                icon={<CashIcon />}
                                color="#0B5E6E"
                            />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={12} lg={6}>
                            <Paper sx={{ p: 2, height: '100%' }}>
                                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                    {t('cash.byMethod')}
                                </Typography>
                                <TableContainer sx={{ overflowX: 'auto' }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>{t('billing.paymentMethod')}</TableCell>
                                                <TableCell align="right">{t('cash.received')}</TableCell>
                                                <TableCell align="right">{t('cash.refunded')}</TableCell>
                                                <TableCell align="right">{t('cash.net')}</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {report.byMethod.map((m) => (
                                                <TableRow key={m.method}>
                                                    <TableCell>
                                                        {t(paymentMethodKey(m.method))} ({m.count})
                                                    </TableCell>
                                                    <TableCell align="right">{money(m.received)}</TableCell>
                                                    <TableCell align="right">{m.refunded ? money(m.refunded) : '—'}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                                                        {money(m.net)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Paper>
                        </Grid>
                        <Grid item xs={12} lg={6}>
                            <Paper sx={{ p: 2, height: '100%' }}>
                                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                    {t('cash.byCashier')}
                                </Typography>
                                {!report.byCashier.length ? (
                                    <Typography variant="body2" color="text.secondary">
                                        {t('cash.nothing')}
                                    </Typography>
                                ) : (
                                    <TableContainer sx={{ overflowX: 'auto' }}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>{t('cash.cashier')}</TableCell>
                                                    <TableCell align="right">{t('cash.received')}</TableCell>
                                                    <TableCell align="right">{t('cash.refunded')}</TableCell>
                                                    <TableCell align="right">{t('cash.cashNet')}</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {report.byCashier.map((c) => (
                                                    <TableRow key={c.name}>
                                                        <TableCell>{c.name || '—'}</TableCell>
                                                        <TableCell align="right">{money(c.received)}</TableCell>
                                                        <TableCell align="right">
                                                            {c.refunded ? money(c.refunded) : '—'}
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                                                            {money(c.cash)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </Paper>
                        </Grid>
                    </Grid>

                    <Paper sx={{ p: 2, mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                            {t('cash.closeTitle')}
                        </Typography>
                        {report.closure ? (
                            <Box>
                                {report.closure.changed && (
                                    <Alert severity="warning" sx={{ mb: 2 }}>
                                        {t('cash.changedSinceClosing')}
                                    </Alert>
                                )}
                                <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">
                                            {t('cash.counted')}
                                        </Typography>
                                        <Typography fontWeight={600}>{money(report.closure.countedCash)}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">
                                            {t('cash.expectedAtClosing')}
                                        </Typography>
                                        <Typography fontWeight={600}>{money(report.closure.expectedCash)}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">
                                            {t('cash.difference')}
                                        </Typography>
                                        <Typography
                                            fontWeight={700}
                                            color={
                                                report.closure.difference < 0
                                                    ? 'error.main'
                                                    : report.closure.difference > 0
                                                      ? 'warning.main'
                                                      : 'success.main'
                                            }
                                        >
                                            {money(report.closure.difference)}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    {t('cash.closedBy', {
                                        name: staffName(report.closure.closedBy),
                                        date: formatDateTime(report.closure.closedAt, i18n.language),
                                    })}
                                    {report.closure.note && ` — ${report.closure.note}`}
                                </Typography>
                                {can('billingAdmin') && (
                                    <Button size="small" sx={{ mt: 1, displayPrint: 'none' }} disabled={busy} onClick={reopen}>
                                        {t('cash.reopen')}
                                    </Button>
                                )}
                            </Box>
                        ) : (
                            <Box
                                sx={{
                                    display: 'flex',
                                    gap: 2,
                                    flexWrap: 'wrap',
                                    alignItems: 'flex-start',
                                    displayPrint: 'none',
                                }}
                            >
                                <TextField
                                    size="small"
                                    type="number"
                                    label={t('cash.counted')}
                                    value={counted}
                                    onChange={(e) => setCounted(e.target.value)}
                                    error={counted !== '' && !countedOk}
                                    helperText={
                                        countedOk
                                            ? `${t('cash.difference')}: ${money(Math.round((countedValue - report.expectedCash) * 10 ** digits) / 10 ** digits)}`
                                            : t('cash.countHint')
                                    }
                                    InputProps={{
                                        endAdornment: <InputAdornment position="end">{report.currency}</InputAdornment>,
                                    }}
                                    inputProps={{ min: 0 }}
                                />
                                <TextField
                                    size="small"
                                    label={t('cash.note')}
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    sx={{ minWidth: 240, flex: 1 }}
                                    inputProps={{ maxLength: 1000 }}
                                />
                                <Button
                                    variant="contained"
                                    startIcon={<CloseIcon />}
                                    disabled={!countedOk || busy}
                                    onClick={close}
                                >
                                    {t('cash.closeDay')}
                                </Button>
                            </Box>
                        )}
                    </Paper>

                    <Paper sx={{ p: 2, mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                            {t('cash.payments')}
                        </Typography>
                        {report.payments.length ? (
                            <LineTable lines={report.payments} />
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                {t('cash.nothing')}
                            </Typography>
                        )}
                    </Paper>
                    {report.refunds.length > 0 && (
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                {t('cash.refunds')}
                            </Typography>
                            <LineTable lines={report.refunds} refunds />
                        </Paper>
                    )}
                </>
            )}
        </Box>
    );
};

export default CashReportPage;
