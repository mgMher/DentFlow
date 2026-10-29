import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Grid,
    MenuItem,
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
import {
    AttachMoney as RevenueIcon,
    CalendarToday as AppointmentIcon,
    CheckCircle as CompletionIcon,
    MedicalServices as TreatmentIcon,
    PersonAdd as NewPatientIcon,
    ReceiptLong as InvoicedIcon,
    AccountBalanceWallet as OutstandingIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ReportQuery, reportsActions } from '../../store/reports';
import { PageHeader, StatCard, LoadingSpinner } from '../../components/ui';
import RevenueChart, { periodLabel } from '../../components/reports/RevenueChart';
import { useHttpState, usePermission } from '../../hooks';
import { formatCurrency } from '../../utils/formatters';
import { toLocalDateString } from '../../utils/dates';
import { localizedTreatmentName } from '../../utils/appointments';
import { paymentMethodKey } from '../../utils/billing';
import { ReportGroupBy } from '../../types';

type Preset = 'thisMonth' | 'lastMonth' | 'last30' | 'thisYear' | 'custom';

const presetRange = (preset: Exclude<Preset, 'custom'>): { startDate: string; endDate: string } => {
    const now = new Date();
    const today = toLocalDateString(now);
    switch (preset) {
        case 'lastMonth':
            return {
                startDate: toLocalDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
                endDate: toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 0)),
            };
        case 'last30':
            return { startDate: toLocalDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)), endDate: today };
        case 'thisYear':
            return { startDate: `${now.getFullYear()}-01-01`, endDate: today };
        default:
            return { startDate: toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: today };
    }
};

/** A sensible chart grain for the range: days up to two months, weeks up to half a year, then months. */
const defaultGroupBy = (startDate: string, endDate: string): ReportGroupBy => {
    const days = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000;
    return days <= 62 ? 'day' : days <= 190 ? 'week' : 'month';
};

const Section: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
    <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Typography variant="h6">{title}</Typography>
            {action}
        </Box>
        {children}
    </Paper>
);

const NoData: React.FC = () => {
    const { t } = useTranslation();
    return (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            {t('common.noData')}
        </Typography>
    );
};

const ReportsPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const dispatch = useDispatch();
    const can = usePermission();
    const withMoney = can('viewRevenue');

    const { revenue, appointmentStats: appts, dentistPerformance: dentists, treatmentStats: treatments, patientStats: patients } =
        useSelector((state: RootState) => state.reports);
    const revenueState = useHttpState('GET_REVENUE_REPORT');
    const apptState = useHttpState('GET_APPT_STATS');
    const loadingAny = useSelector((state: RootState) =>
        ['GET_REVENUE_REPORT', 'GET_APPT_STATS', 'GET_DENTIST_PERF', 'GET_TREATMENT_STATS', 'GET_REPORT_PATIENT_STATS'].some((a) =>
            state.http.loading.includes(a),
        ),
    );

    const [preset, setPreset] = useState<Preset>('thisMonth');
    const [range, setRange] = useState(() => presetRange('thisMonth'));
    const [groupBy, setGroupBy] = useState<ReportGroupBy>('day');
    const [chartView, setChartView] = useState<'chart' | 'table'>('chart');
    const rangeError = range.startDate && range.endDate && range.startDate > range.endDate;

    const query: ReportQuery | null = useMemo(
        () => (range.startDate && range.endDate && !rangeError ? range : null),
        [range, rangeError],
    );

    useEffect(() => {
        if (!query) return;
        dispatch(reportsActions.getApptStats(query));
        dispatch(reportsActions.getDentistPerf(query));
        dispatch(reportsActions.getTreatmentStats(query));
        dispatch(reportsActions.getPatientStats(query));
    }, [dispatch, query]);

    // Only revenue has chart periods, so a new grouping reloads only revenue.
    useEffect(() => {
        if (query && withMoney) dispatch(reportsActions.getRevenueReport({ ...query, groupBy }));
    }, [dispatch, query, groupBy, withMoney]);

    const choosePreset = (value: Preset) => {
        setPreset(value);
        if (value === 'custom') return;
        const next = presetRange(value);
        setRange(next);
        setGroupBy(defaultGroupBy(next.startDate, next.endDate));
    };

    const changeDate = (field: 'startDate' | 'endDate', value: string) => {
        setPreset('custom');
        const next = { ...range, [field]: value };
        setRange(next);
        if (next.startDate && next.endDate && next.startDate <= next.endDate) {
            setGroupBy(defaultGroupBy(next.startDate, next.endDate));
        }
    };

    // Responses for another range are not shown as if they were this one's.
    const current = <T extends { startDate: string; endDate: string } | null>(report: T): T | null =>
        report && query && report.startDate === query.startDate && report.endDate === query.endDate ? report : null;
    const rev = withMoney && revenue?.groupBy === groupBy ? current(revenue) : null;
    const ap = current(appts);
    const dp = current(dentists);
    const tr = current(treatments);
    const pt = current(patients);
    const money = (v: number | undefined) => formatCurrency(v ?? 0, rev?.currency ?? dp?.currency ?? tr?.currency);

    if (loadingAny && !ap && !rev) {
        return <LoadingSpinner fullPage />;
    }

    type Card = { key: string; title: string; value: string | number; icon: React.ReactNode; color: string; caption?: string; captionColor?: string };
    const cards: Card[] = withMoney
        ? [
              { key: 'collected', title: t('reports.collected'), value: rev ? money(rev.collected) : '—', icon: <RevenueIcon />, color: '#38A169', caption: rev ? t('reports.paymentsCount', { count: rev.paymentCount }) : undefined },
              { key: 'invoiced', title: t('reports.invoiced'), value: rev ? money(rev.invoiced) : '—', icon: <InvoicedIcon />, color: '#3182CE', caption: rev ? t('reports.invoicesCount', { count: rev.invoiceCount }) : undefined },
              {
                  key: 'outstanding',
                  title: t('reports.outstandingNow'),
                  value: rev ? money(rev.outstanding.balance) : '—',
                  icon: <OutstandingIcon />,
                  color: '#ED8936',
                  caption: rev?.outstanding.overdue ? t('reports.overdueAmount', { amount: money(rev.outstanding.overdue) }) : undefined,
                  captionColor: 'error.main',
              },
              { key: 'patients', title: t('reports.newPatients'), value: pt?.newInRange ?? '—', icon: <NewPatientIcon />, color: '#805AD5', caption: pt ? t('reports.activePatients', { count: pt.active }) : undefined },
          ]
        : [
              { key: 'appointments', title: t(ap?.ownOnly ? 'reports.myAppointments' : 'reports.appointments'), value: ap?.total ?? '—', icon: <AppointmentIcon />, color: '#3182CE' },
              { key: 'completion', title: t('reports.completionRate'), value: ap ? `${ap.completionRate}%` : '—', icon: <CompletionIcon />, color: '#38A169' },
              { key: 'treatments', title: t('reports.treatmentsDone'), value: tr ? tr.rows.reduce((sum, r) => sum + r.done, 0) : '—', icon: <TreatmentIcon />, color: '#805AD5' },
              { key: 'patients', title: t('reports.newPatients'), value: pt?.newInRange ?? '—', icon: <NewPatientIcon />, color: '#0B5E6E' },
          ];

    return (
        <Box>
            <PageHeader title={t('reports.title')} />

            {/* Range */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6} md={3} lg={2}>
                        <TextField select label={t('reports.range')} fullWidth size="small" value={preset} onChange={(e) => choosePreset(e.target.value as Preset)}>
                            {(['thisMonth', 'lastMonth', 'last30', 'thisYear', 'custom'] as Preset[]).map((p) => (
                                <MenuItem key={p} value={p}>
                                    {t(`reports.presets.${p}`)}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid item xs={6} sm={3} md={3} lg={2}>
                        <TextField
                            label={t('reports.from')}
                            type="date"
                            fullWidth
                            size="small"
                            value={range.startDate}
                            onChange={(e) => changeDate('startDate', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            error={!!rangeError}
                        />
                    </Grid>
                    <Grid item xs={6} sm={3} md={3} lg={2}>
                        <TextField
                            label={t('reports.to')}
                            type="date"
                            fullWidth
                            size="small"
                            value={range.endDate}
                            onChange={(e) => changeDate('endDate', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            error={!!rangeError}
                            helperText={rangeError ? t('reports.rangeInvalid') : undefined}
                        />
                    </Grid>
                    {withMoney && (
                        <Grid item xs={12} md="auto">
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={groupBy}
                                onChange={(_, v) => v && setGroupBy(v)}
                                aria-label={t('reports.period')}
                            >
                                <ToggleButton value="day">{t('reports.daily')}</ToggleButton>
                                <ToggleButton value="week">{t('reports.weekly')}</ToggleButton>
                                <ToggleButton value="month">{t('reports.monthly')}</ToggleButton>
                            </ToggleButtonGroup>
                        </Grid>
                    )}
                </Grid>
                {(ap?.ownOnly || dp?.ownOnly) && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                        {t('reports.ownOnlyHint')}
                    </Typography>
                )}
            </Paper>

            {(revenueState.error || apptState.error) && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {revenueState.error || apptState.error}
                </Alert>
            )}

            <Grid container spacing={3} sx={{ mb: 3 }}>
                {cards.map((c) => (
                    <Grid item xs={12} sm={6} lg={3} key={c.key}>
                        <StatCard
                            title={c.title}
                            value={c.value}
                            icon={c.icon}
                            color={c.color}
                            caption={c.caption ? { text: c.caption, color: c.captionColor } : undefined}
                        />
                    </Grid>
                ))}
            </Grid>

            {/* Revenue (admins) */}
            {withMoney && (
                <Section
                    title={t('reports.collectedOverTime')}
                    action={
                        <ToggleButtonGroup size="small" exclusive value={chartView} onChange={(_, v) => v && setChartView(v)}>
                            <ToggleButton value="chart">{t('reports.chart')}</ToggleButton>
                            <ToggleButton value="table">{t('reports.table')}</ToggleButton>
                        </ToggleButtonGroup>
                    }
                >
                    {!rev ? (
                        <NoData />
                    ) : (
                        <>
                            {rev.otherCurrencies.length > 0 && (
                                <Alert severity="info" sx={{ mb: 2 }}>
                                    {t('reports.otherCurrencies', {
                                        list: rev.otherCurrencies.map((c) => formatCurrency(c.total, c.currency)).join(', '),
                                    })}
                                </Alert>
                            )}
                            {rev.collected === 0 ? (
                                <NoData />
                            ) : chartView === 'chart' ? (
                                <RevenueChart data={rev.byPeriod} groupBy={rev.groupBy} currency={rev.currency} />
                            ) : (
                                <TableContainer sx={{ maxHeight: 360 }}>
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>{t('reports.period')}</TableCell>
                                                <TableCell align="right">{t('reports.payments')}</TableCell>
                                                <TableCell align="right">{t('reports.collected')}</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {rev.byPeriod.map((p) => (
                                                <TableRow key={p.period}>
                                                    <TableCell>{periodLabel(p.period, rev.groupBy, i18n.language, true)}</TableCell>
                                                    <TableCell align="right">{p.count}</TableCell>
                                                    <TableCell align="right">{money(p.total)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                            {rev.byMethod.length > 0 && (
                                <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', mt: 3 }}>
                                    {rev.byMethod.map((m) => (
                                        <Box key={m.method}>
                                            <Typography variant="caption" color="text.secondary">
                                                {t(paymentMethodKey(m.method))} · {t('reports.paymentsCount', { count: m.count })}
                                            </Typography>
                                            <Typography fontWeight={600}>{money(m.total)}</Typography>
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </>
                    )}
                </Section>
            )}

            {/* Appointments */}
            <Section title={t(ap?.ownOnly ? 'reports.myAppointmentStats' : 'reports.appointmentStats')}>
                {!ap || ap.total === 0 ? (
                    <NoData />
                ) : (
                    <Grid container spacing={2}>
                        {[
                            { key: 'total', label: t('reports.appointments'), value: ap.total, sub: t('reports.stillBooked', { count: ap.byStatus.scheduled + ap.byStatus.confirmed }) },
                            { key: 'completed', label: t('appointments.completed'), value: ap.completed, sub: `${ap.completionRate}%`, color: 'success.main' },
                            { key: 'cancelled', label: t('appointments.cancelled'), value: ap.cancelled, sub: `${ap.cancellationRate}%`, color: 'error.main' },
                            { key: 'noShow', label: t('appointments.noShow'), value: ap.noShow, sub: `${ap.noShowRate}%`, color: 'warning.main' },
                        ].map((s) => (
                            <Grid item xs={6} md={3} key={s.key}>
                                <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', textAlign: 'center' }}>
                                    <Typography variant="h4" fontWeight={700} color={s.color}>
                                        {s.value}
                                    </Typography>
                                    <Typography variant="body2">{s.label}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {s.sub}
                                    </Typography>
                                </Box>
                            </Grid>
                        ))}
                        <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                                {t('reports.ratesHint')}
                            </Typography>
                        </Grid>
                    </Grid>
                )}
            </Section>

            {/* Dentists */}
            <Section title={t('reports.dentistPerformance')}>
                {!dp || dp.rows.length === 0 ? (
                    <NoData />
                ) : (
                    <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table size="small" sx={{ minWidth: 640 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('appointments.dentist')}</TableCell>
                                    <TableCell align="right">{t('reports.appointments')}</TableCell>
                                    <TableCell align="right">{t('appointments.completed')}</TableCell>
                                    <TableCell align="right">{t('appointments.cancelled')}</TableCell>
                                    <TableCell align="right">{t('appointments.noShow')}</TableCell>
                                    <TableCell align="right">{t('reports.treatmentsDone')}</TableCell>
                                    {withMoney && <TableCell align="right">{t('reports.collected')}</TableCell>}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {dp.rows.map((row) => (
                                    <TableRow key={row.dentistId}>
                                        <TableCell>
                                            {row.firstName} {row.lastName}
                                            {!row.isActive && (
                                                <Typography component="span" variant="caption" color="text.secondary">
                                                    {' '}({t('reports.formerStaff')})
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right">{row.appointments}</TableCell>
                                        <TableCell align="right">{row.completed}</TableCell>
                                        <TableCell align="right">{row.cancelled}</TableCell>
                                        <TableCell align="right">{row.noShow}</TableCell>
                                        <TableCell align="right">{row.treatmentsDone}</TableCell>
                                        {withMoney && <TableCell align="right">{money(row.collected)}</TableCell>}
                                    </TableRow>
                                ))}
                                {withMoney && !!dp.unassignedCollected && (
                                    <TableRow>
                                        <TableCell colSpan={6}>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('reports.unassigned')}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">{money(dp.unassignedCollected)}</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Section>

            {/* Treatments */}
            <Section title={t('reports.treatmentStats')}>
                {!tr || tr.rows.length === 0 ? (
                    <NoData />
                ) : (
                    <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('treatments.name')}</TableCell>
                                    <TableCell align="right">{t('reports.timesDone')}</TableCell>
                                    {withMoney && <TableCell align="right">{t('reports.collected')}</TableCell>}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {tr.rows.map((row) => (
                                    <TableRow key={row.treatmentId ?? `n:${row.name}`}>
                                        <TableCell>
                                            {row.name ? localizedTreatmentName({ name: row.name, nameHy: row.nameHy, nameRu: row.nameRu }) : t('reports.otherLines')}
                                            {row.code && (
                                                <Typography component="span" variant="caption" color="text.secondary">
                                                    {' '}· {row.code}
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right">{row.done}</TableCell>
                                        {withMoney && <TableCell align="right">{money(row.collected)}</TableCell>}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
                {withMoney && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                        {t('reports.collectedHint')}
                    </Typography>
                )}
            </Section>
        </Box>
    );
};

export default ReportsPage;
