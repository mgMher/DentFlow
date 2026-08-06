import React, { useEffect, useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    TextField,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
} from '@mui/material';
import {
    AttachMoney as RevenueIcon,
    CalendarToday as AppointmentIcon,
    PersonAdd as NewPatientIcon,
    CheckCircle as CompletionIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { reportsActions } from '../../store/reports';
import { billingActions } from '../../store/billing';
import { PageHeader, StatCard, LoadingSpinner } from '../../components/ui';
import { formatCurrency } from '../../utils/formatters';

type PeriodType = 'daily' | 'weekly' | 'monthly';

const ReportsPage: React.FC = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();

    const dashboard = useSelector((state: RootState) => state.reports.dashboard);
    const revenue = useSelector((state: RootState) => state.billing.revenue);
    const loading = useSelector((state: RootState) => state.http.loading.includes('GET_DASHBOARD'));

    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [period, setPeriod] = useState<PeriodType>('monthly');

    useEffect(() => {
        dispatch(reportsActions.getDashboard());
        dispatch(billingActions.getRevenue({ startDate, endDate, period }));
    }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
        if (field === 'startDate') {
            setStartDate(value);
        } else {
            setEndDate(value);
        }
        dispatch(
            billingActions.getRevenue({
                startDate: field === 'startDate' ? value : startDate,
                endDate: field === 'endDate' ? value : endDate,
                period,
            }),
        );
    };

    const handlePeriodChange = (value: PeriodType) => {
        setPeriod(value);
        dispatch(billingActions.getRevenue({ startDate, endDate, period: value }));
    };

    const totalRevenue = dashboard?.monthRevenue ?? 0;
    const totalAppointments = dashboard?.todayAppointments ?? 0;
    const totalPatients = dashboard?.totalActivePatients ?? 0;

    const revenueData = revenue?.breakdown || [];
    const appointmentBreakdown = revenue?.appointmentStats || {
        completed: 0,
        cancelled: 0,
        noShow: 0,
    };
    const topTreatments = revenue?.topTreatments || [];

    const completionRate =
        totalAppointments > 0
            ? Math.round((appointmentBreakdown.completed / Math.max(totalAppointments, 1)) * 100)
            : 0;

    if (loading && !dashboard) {
        return <LoadingSpinner fullPage />;
    }

    return (
        <Box>
            <PageHeader title={t('reports.title')} />

            {/* Date Range Filter */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={3}>
                        <TextField
                            label={t('common.date') + ' (' + t('appointments.startTime') + ')'}
                            type="date"
                            fullWidth
                            size="small"
                            value={startDate}
                            onChange={(e) => handleDateChange('startDate', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <TextField
                            label={t('common.date') + ' (' + t('appointments.endTime') + ')'}
                            type="date"
                            fullWidth
                            size="small"
                            value={endDate}
                            onChange={(e) => handleDateChange('endDate', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <TextField
                            label={t('reports.period')}
                            select
                            fullWidth
                            size="small"
                            value={period}
                            onChange={(e) => handlePeriodChange(e.target.value as PeriodType)}
                        >
                            <MenuItem value="daily">{t('reports.daily')}</MenuItem>
                            <MenuItem value="weekly">{t('reports.weekly')}</MenuItem>
                            <MenuItem value="monthly">{t('reports.monthly')}</MenuItem>
                        </TextField>
                    </Grid>
                </Grid>
            </Paper>

            {/* Stat Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title={t('reports.totalRevenue')}
                        value={formatCurrency(totalRevenue)}
                        icon={<RevenueIcon />}
                        color="#38A169"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title={t('reports.appointmentStats')}
                        value={totalAppointments}
                        icon={<AppointmentIcon />}
                        color="#3182CE"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title={t('reports.patientStats')}
                        value={totalPatients}
                        icon={<NewPatientIcon />}
                        color="#805AD5"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title={t('reports.completionRate')}
                        value={`${completionRate}%`}
                        icon={<CompletionIcon />}
                        color="#ED8936"
                    />
                </Grid>
            </Grid>

            {/* Revenue Chart (Bar visualization) */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    {t('reports.revenueReport')}
                </Typography>
                {revenueData.length === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                        {t('common.noData')}
                    </Typography>
                ) : (
                    <Box sx={{ mt: 2 }}>
                        {/* Simple bar chart visualization */}
                        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 200, mb: 2 }}>
                            {revenueData.map((item: any, index: number) => {
                                const maxVal = Math.max(
                                    ...revenueData.map((d: any) => d.amount || d.revenue || 0),
                                    1,
                                );
                                const value = item.amount || item.revenue || 0;
                                const heightPercent = (value / maxVal) * 100;
                                return (
                                    <Box
                                        key={index}
                                        sx={{
                                            flex: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            height: '100%',
                                            justifyContent: 'flex-end',
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            sx={{ mb: 0.5, fontSize: 10 }}
                                        >
                                            {formatCurrency(value)}
                                        </Typography>
                                        <Box
                                            sx={{
                                                width: '60%',
                                                height: `${Math.max(heightPercent, 2)}%`,
                                                bgcolor: 'primary.main',
                                                borderRadius: '4px 4px 0 0',
                                                minHeight: 4,
                                                transition: 'height 0.3s ease',
                                            }}
                                        />
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ mt: 0.5, fontSize: 10 }}
                                        >
                                            {item.label || item.period || item.date || ''}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                )}
            </Paper>

            {/* Appointment Stats */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    {t('reports.appointmentStats')}
                </Typography>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                        <Box
                            sx={{
                                p: 2,
                                borderRadius: 2,
                                bgcolor: '#F0FFF4',
                                textAlign: 'center',
                            }}
                        >
                            <Typography variant="h4" fontWeight={700} color="#38A169">
                                {appointmentBreakdown.completed}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('appointments.completed')}
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Box
                            sx={{
                                p: 2,
                                borderRadius: 2,
                                bgcolor: '#FFF5F5',
                                textAlign: 'center',
                            }}
                        >
                            <Typography variant="h4" fontWeight={700} color="#E53E3E">
                                {appointmentBreakdown.cancelled}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('appointments.cancelled')}
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Box
                            sx={{
                                p: 2,
                                borderRadius: 2,
                                bgcolor: '#F7FAFC',
                                textAlign: 'center',
                            }}
                        >
                            <Typography variant="h4" fontWeight={700} color="#A0AEC0">
                                {appointmentBreakdown.noShow}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('appointments.noShow')}
                            </Typography>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>

            {/* Top Treatments */}
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                    {t('reports.treatmentStats')}
                </Typography>
                {topTreatments.length === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                        {t('common.noData')}
                    </Typography>
                ) : (
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>#</TableCell>
                                    <TableCell>{t('treatments.name')}</TableCell>
                                    <TableCell align="center">{t('reports.appointmentStats')}</TableCell>
                                    <TableCell align="right">{t('reports.totalRevenue')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {topTreatments.map((treatment: any, index: number) => (
                                    <TableRow key={index}>
                                        <TableCell>{index + 1}</TableCell>
                                        <TableCell>{treatment.name || treatment.treatmentName}</TableCell>
                                        <TableCell align="center">{treatment.count}</TableCell>
                                        <TableCell align="right">
                                            {formatCurrency(treatment.revenue || treatment.amount || 0)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>
        </Box>
    );
};

export default ReportsPage;
