import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Chip,
    FormControlLabel,
    Grid,
    MenuItem,
    Paper,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import api from '../../api/axios';
import { EmptyState, LoadingSpinner, PageHeader } from '../../components/ui';
import BillingNav from '../../components/billing/BillingNav';
import { DebtAgeBucket, DebtorsReport } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import { formatCurrency, formatDate, getFullName } from '../../utils/formatters';

const BUCKETS: DebtAgeBucket[] = ['0_30', '31_60', '61_90', '90_plus'];
const BUCKET_COLORS: Record<DebtAgeBucket, string> = { '0_30': '#3182CE', '31_60': '#ED8936', '61_90': '#DD6B20', '90_plus': '#E53E3E' };

/** Who owes money (F5): open invoices minus credit, by age of debt. */
const DebtorsPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [overdueOnly, setOverdueOnly] = useState(false);
    const [minAmount, setMinAmount] = useState('');
    const [sort, setSort] = useState<'amount' | 'age'>('amount');
    const [report, setReport] = useState<DebtorsReport | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const min = Number(minAmount);
        const timer = setTimeout(() => {
            api.get('/billing/debtors', {
                params: { sort, ...(overdueOnly ? { overdueOnly: true } : {}), ...(minAmount && min > 0 ? { minAmount: min } : {}) },
            })
                .then((res) => !cancelled && setReport(res.data?.data ?? res.data))
                .catch((err) => !cancelled && setError(apiErrorMessage(err)));
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [overdueOnly, minAmount, sort]);

    const money = (n: number) => formatCurrency(n, report?.currency);

    return (
        <Box>
            <PageHeader title={t('billing.title')} />
            <BillingNav />

            <Paper sx={{ p: 2, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                <FormControlLabel control={<Switch checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />} label={t('debtors.overdueOnly')} />
                <TextField size="small" type="number" label={t('debtors.minAmount')} value={minAmount} onChange={(e) => setMinAmount(e.target.value)} sx={{ width: 160 }} inputProps={{ min: 0 }} />
                <TextField select size="small" label={t('debtors.sort')} value={sort} onChange={(e) => setSort(e.target.value as 'amount' | 'age')} sx={{ minWidth: 180 }}>
                    <MenuItem value="amount">{t('debtors.sortAmount')}</MenuItem>
                    <MenuItem value="age">{t('debtors.sortAge')}</MenuItem>
                </TextField>
            </Paper>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {!report ? (
                <LoadingSpinner />
            ) : (
                <>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={12} md={4}>
                            <Paper sx={{ p: 2, height: '100%' }}>
                                <Typography variant="caption" color="text.secondary">{t('debtors.totalOwed')}</Typography>
                                <Typography variant="h5" fontWeight={700} color="error.main">{money(report.totals.net)}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t('debtors.patients', { count: report.totals.patients })}
                                    {report.totals.credit > 0 && ` · ${t('debtors.afterCredit', { amount: money(report.totals.credit) })}`}
                                </Typography>
                            </Paper>
                        </Grid>
                        <Grid item xs={12} md={8}>
                            <Paper sx={{ p: 2, height: '100%' }}>
                                <Typography variant="caption" color="text.secondary">{t('debtors.byAge')}</Typography>
                                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mt: 0.5 }}>
                                    {BUCKETS.map((b) => (
                                        <Box key={b}>
                                            <Typography variant="body2" color="text.secondary">{t(`debtors.age.${b}`)}</Typography>
                                            <Typography fontWeight={700} sx={{ color: BUCKET_COLORS[b] }}>{money(report.totals.byAge[b])}</Typography>
                                        </Box>
                                    ))}
                                </Box>
                                <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>{t('debtors.ageHint')}</Typography>
                            </Paper>
                        </Grid>
                    </Grid>

                    {!report.debtors.length ? (
                        <EmptyState title={t('debtors.none')} />
                    ) : (
                        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>{t('cash.patient')}</TableCell>
                                        <TableCell>{t('patients.phone')}</TableCell>
                                        <TableCell align="right">{t('debtors.owes')}</TableCell>
                                        <TableCell align="right">{t('billing.invoices')}</TableCell>
                                        <TableCell>{t('debtors.oldest')}</TableCell>
                                        <TableCell>{t('debtors.lastPayment')}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {report.debtors.map((d) => (
                                        <TableRow key={d.patient._id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/patients/${d.patient._id}?tab=billing`)}>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {getFullName(d.patient.firstName, d.patient.lastName, d.patient.patronymic)}
                                                </Typography>
                                                {d.patient.status !== 'active' && (
                                                    <Typography variant="caption" color="text.secondary">{t(`patients.${d.patient.status}`)}</Typography>
                                                )}
                                            </TableCell>
                                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{d.patient.phone}</TableCell>
                                            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                <Typography variant="body2" fontWeight={700}>{money(d.net)}</Typography>
                                                {d.credit > 0 && (
                                                    <Typography variant="caption" color="text.secondary">{t('debtors.ofWhichCredit', { owed: money(d.owed), credit: money(d.credit) })}</Typography>
                                                )}
                                            </TableCell>
                                            <TableCell align="right">{d.invoices}</TableCell>
                                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                {formatDate(d.oldestDate, 'dd.MM.yyyy', i18n.language)} · {t('debtors.days', { count: d.daysOld })}
                                                {d.overdue && <Chip size="small" color="error" variant="outlined" label={t('billing.overdue')} sx={{ ml: 1 }} />}
                                            </TableCell>
                                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                {d.lastPayment ? formatDate(d.lastPayment, 'dd.MM.yyyy', i18n.language) : '—'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </>
            )}
        </Box>
    );
};

export default DebtorsPage;
