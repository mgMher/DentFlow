import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    Alert,
    Box,
    Button,
    Chip,
    Link,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import api from '../../api/axios';
import { EmptyState, LoadingSpinner, PageHeader } from '../../components/ui';
import BillingNav from '../../components/billing/BillingNav';
import FiscalNumberDialog from '../../components/billing/FiscalNumberDialog';
import { FiscalReceipt } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import { paymentMethodKey } from '../../utils/billing';
import { toLocalDateString } from '../../utils/dates';
import { formatCurrency, formatDateTime, getFullName } from '../../utils/formatters';

type Status = 'missing' | 'recorded' | 'all';

/**
 * F10: payments and the fiscal receipt numbers from the clinic's own cash
 * register (ՀԴՄ). By default the ones still without a number, to fill in.
 */
const FiscalReceiptsPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const [status, setStatus] = useState<Status>('missing');
    // The day report links here with ?from=&to= for its day.
    const [params] = useSearchParams();
    const [from, setFrom] = useState(params.get('from') ?? '');
    const [to, setTo] = useState(params.get('to') ?? '');
    const [data, setData] = useState<{ items: FiscalReceipt[]; counts: { missing: number; recorded: number } } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<FiscalReceipt | null>(null);

    const load = useCallback(() => {
        api.get('/billing/fiscal-receipts', { params: { status, ...(from ? { from } : {}), ...(to ? { to } : {}), limit: 200 } })
            .then((res) => {
                setData(res.data?.data ?? res.data);
                setError(null);
            })
            .catch((err) => setError(apiErrorMessage(err)));
    }, [status, from, to]);

    useEffect(load, [load]);

    const today = toLocalDateString();
    const summary = (r: FiscalReceipt) => `${formatCurrency(r.amount, r.currency)} · ${t(paymentMethodKey(r.method))} · ${formatDateTime(r.date, i18n.language)}`;

    return (
        <Box>
            <PageHeader title={t('billing.title')} />
            <BillingNav />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('fiscal.about')}</Typography>

            <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <ToggleButtonGroup exclusive size="small" value={status} onChange={(_, v) => v && setStatus(v)}>
                    <ToggleButton value="missing">
                        {t('fiscal.missing')}
                        {data && <Chip size="small" label={data.counts.missing} color={data.counts.missing ? 'warning' : 'default'} sx={{ ml: 1, height: 20 }} />}
                    </ToggleButton>
                    <ToggleButton value="recorded">{t('fiscal.recorded')}</ToggleButton>
                    <ToggleButton value="all">{t('common.all')}</ToggleButton>
                </ToggleButtonGroup>
                <TextField size="small" type="date" label={t('audit.from')} value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ max: to || today }} />
                <TextField size="small" type="date" label={t('audit.to')} value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ min: from, max: today }} />
                {(from || to) && <Button color="inherit" onClick={() => { setFrom(''); setTo(''); }}>{t('audit.clear')}</Button>}
            </Paper>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {!data ? (
                !error && <LoadingSpinner />
            ) : !data.items.length ? (
                <EmptyState title={t(status === 'missing' ? 'fiscal.noneMissing' : 'fiscal.none')} />
            ) : (
                <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('common.date')}</TableCell>
                                <TableCell>{t('cash.patient')}</TableCell>
                                <TableCell>{t('billing.invoices')}</TableCell>
                                <TableCell>{t('billing.paymentMethod')}</TableCell>
                                <TableCell align="right">{t('billing.amount')}</TableCell>
                                <TableCell>{t('fiscal.column')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.items.map((r) => (
                                <TableRow key={r.receiptKey} hover>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.date, i18n.language)}</TableCell>
                                    <TableCell>
                                        {r.patient ? (
                                            <Link component={RouterLink} to={`/patients/${r.patient._id}?tab=billing`}>
                                                {getFullName(r.patient.firstName, r.patient.lastName, r.patient.patronymic)}
                                            </Link>
                                        ) : (
                                            '—'
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {r.invoices.map((i) => (
                                            <Link key={i._id} component={RouterLink} to={`/billing/${i._id}`} sx={{ mr: 1, whiteSpace: 'nowrap' }}>{i.invoiceNumber}</Link>
                                        ))}
                                        {r.onAccount && <Chip size="small" variant="outlined" label={t('fiscal.onAccount')} />}
                                    </TableCell>
                                    <TableCell>{t(paymentMethodKey(r.method))}</TableCell>
                                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                        {formatCurrency(r.amount, r.currency)}
                                        {r.refunded && <Typography variant="caption" color="warning.main" component="div">{t('cash.refundedLater')}</Typography>}
                                    </TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                        {r.fiscalNumber ? (
                                            <Link component="button" variant="body2" onClick={() => setEditing(r)}>{r.fiscalNumber}</Link>
                                        ) : (
                                            <Button size="small" variant="outlined" onClick={() => setEditing(r)}>{t('fiscal.add')}</Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <FiscalNumberDialog
                paymentId={editing?.paymentIds[0] ?? null}
                current={editing?.fiscalNumber}
                summary={editing ? summary(editing) : undefined}
                onClose={() => setEditing(null)}
                onSaved={() => {
                    setEditing(null);
                    toast.success(t('toast.saveSuccess'));
                    load();
                }}
            />
        </Box>
    );
};

export default FiscalReceiptsPage;
