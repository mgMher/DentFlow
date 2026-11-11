import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    Alert,
    Box,
    Grid,
    Card,
    CardContent,
    CardHeader,
    Typography,
    Button,
    List,
    ListItemButton,
    ListItemText,
    ListItemAvatar,
    Avatar,
    Divider,
    Skeleton,
} from '@mui/material';
import {
    CalendarMonth as CalendarMonthIcon,
    AttachMoney as AttachMoneyIcon,
    People as PeopleIcon,
    Receipt as ReceiptIcon,
    Add as AddIcon,
    PersonAdd as PersonAddIcon,
    ReceiptLong as ReceiptLongIcon,
    AccessTime as AccessTimeIcon,
    ArrowForward as ArrowForwardIcon,
    Payments as PaymentsIcon,
    MedicalServices as TreatmentIcon,
} from '@mui/icons-material';
import { RootState } from '../../store';
import { reportsActions } from '../../store/reports';
import { StatCard, PageHeader } from '../../components/ui';
import StatusChip from '../../components/ui/StatusChip';
import { formatCurrency, formatDateTime, getInitials } from '../../utils/formatters';
import { patientName, staffName } from '../../utils/references';
import { useHttpState, usePermission } from '../../hooks';
import { ActivityItem, Appointment, DashboardSummary, Patient } from '../../types';

const ACTIVITY_LOOK: Record<ActivityItem['type'], { color: string; icon: React.ReactNode }> = {
    patient: { color: '#0B5E6E', icon: <PeopleIcon sx={{ fontSize: 16 }} /> },
    appointment: { color: '#3182CE', icon: <CalendarMonthIcon sx={{ fontSize: 16 }} /> },
    treatment: { color: '#805AD5', icon: <TreatmentIcon sx={{ fontSize: 16 }} /> },
    invoice: { color: '#ED8936', icon: <ReceiptIcon sx={{ fontSize: 16 }} /> },
    payment: { color: '#38A169', icon: <PaymentsIcon sx={{ fontSize: 16 }} /> },
};

const activityLink = (item: ActivityItem): string => {
    switch (item.type) {
        case 'patient':
        case 'treatment':
            return `/patients/${item.id}`;
        case 'appointment':
            return `/appointments/${item.id}`;
        default:
            return `/billing/${item.id}`;
    }
};

const SkeletonCard = () => <Skeleton variant="rounded" height={120} sx={{ borderRadius: 4 }} />;

const DashboardPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const can = usePermission();

    const user = useSelector((state: RootState) => state.auth.user);
    const dashboard: DashboardSummary | null = useSelector((state: RootState) => state.reports.dashboard);
    const { loading: isLoading, error } = useHttpState('GET_DASHBOARD');

    useEffect(() => {
        dispatch(reportsActions.getDashboard());
    }, [dispatch]);

    const getPatientInitials = (appointment: Appointment): string => {
        if (typeof appointment.patientId === 'object' && appointment.patientId !== null) {
            const patient = appointment.patientId as Patient;
            return getInitials(patient.firstName, patient.lastName);
        }
        return '?';
    };

    const activityText = (item: ActivityItem): string => {
        const patient = item.patient ? patientName(item.patient as Patient) : '—';
        const money = item.amount !== undefined ? formatCurrency(item.amount, item.currency) : '';
        switch (item.type) {
            case 'patient':
                return t('dashboard.activity.patient', { patient });
            case 'appointment':
                return t('dashboard.activity.appointment', {
                    patient,
                    when: item.startTime ? formatDateTime(item.startTime, i18n.language) : '',
                });
            case 'treatment':
                return t('dashboard.activity.treatment', { patient, treatment: item.treatmentName });
            case 'invoice':
                return t('dashboard.activity.invoice', { number: item.invoiceNumber, patient, amount: money });
            case 'payment':
                return t('dashboard.activity.payment', { patient, amount: money });
        }
    };

    const loadingFirst = isLoading && !dashboard;
    const upcomingAppointments = dashboard?.upcomingAppointments ?? [];
    const recentActivity = dashboard?.recentActivity ?? [];
    const cards: React.ReactNode[] = dashboard
        ? [
              <StatCard
                  key="today"
                  title={t(dashboard.ownAppointments ? 'dashboard.myTodayAppointments' : 'dashboard.todayAppointments')}
                  value={dashboard.today.appointments}
                  icon={<CalendarMonthIcon fontSize="large" />}
                  color="#3182CE"
              />,
              dashboard.monthRevenue && (
                  <StatCard
                      key="revenue"
                      title={t('dashboard.monthRevenue')}
                      value={formatCurrency(dashboard.monthRevenue.amount, dashboard.monthRevenue.currency)}
                      icon={<AttachMoneyIcon fontSize="large" />}
                      color="#38A169"
                  />
              ),
              <StatCard
                  key="patients"
                  title={t('dashboard.activePatients')}
                  value={dashboard.activePatients}
                  icon={<PeopleIcon fontSize="large" />}
                  color="#0B5E6E"
                  caption={
                      dashboard.newPatientsThisMonth
                          ? { text: t('dashboard.newThisMonth', { count: dashboard.newPatientsThisMonth }), color: 'success.main' }
                          : undefined
                  }
              />,
              dashboard.invoices && (
                  <StatCard
                      key="invoices"
                      title={t('dashboard.openInvoices')}
                      value={dashboard.invoices.open}
                      icon={<ReceiptIcon fontSize="large" />}
                      color="#ED8936"
                      caption={
                          dashboard.invoices.overdue
                              ? { text: t('dashboard.overdueCount', { count: dashboard.invoices.overdue }), color: 'error.main' }
                              : undefined
                      }
                  />
              ),
          ].filter(Boolean)
        : [];
    // The cards this role sees share one row on wide screens.
    const cardWidth = 12 / Math.min(Math.max(cards.length, 1), 4);

    const quickActions = [
        can('manageAppointments') && {
            key: 'appointment',
            label: t('dashboard.newAppointment'),
            icon: <AddIcon />,
            to: '/appointments',
        },
        can('editPatients') && {
            key: 'patient',
            label: t('dashboard.newPatient'),
            icon: <PersonAddIcon />,
            to: '/patients/new',
        },
        can('manageBilling') && {
            key: 'invoice',
            label: t('dashboard.createInvoice'),
            icon: <ReceiptLongIcon />,
            to: '/billing/new',
        },
    ].filter((a): a is { key: string; label: string; icon: React.ReactElement; to: string } => !!a);

    return (
        <Box>
            <PageHeader title={`${t('dashboard.welcome')}, ${user?.firstName || ''}!`} subtitle={t('dashboard.title')} />

            {error && !dashboard && (
                <Alert
                    severity="error"
                    sx={{ mb: 3 }}
                    action={
                        <Button color="inherit" size="small" onClick={() => dispatch(reportsActions.getDashboard())}>
                            {t('common.retry')}
                        </Button>
                    }
                >
                    {error}
                </Alert>
            )}

            {/* Stat cards: only the ones this role may see */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {loadingFirst
                    ? [0, 1, 2, 3].map((i) => (
                          <Grid item xs={12} sm={6} lg={3} key={i}>
                              <SkeletonCard />
                          </Grid>
                      ))
                    : cards.map((card, i) => (
                          <Grid item xs={12} sm={6} lg={cardWidth} key={i}>
                              {card}
                          </Grid>
                      ))}
            </Grid>

            <Grid container spacing={3}>
                {/* Upcoming Appointments */}
                <Grid item xs={12} md={7}>
                    <Card sx={{ height: '100%' }}>
                        <CardHeader
                            title={
                                <Typography variant="h6" fontWeight={600}>
                                    {t(
                                        dashboard?.ownAppointments
                                            ? 'dashboard.myUpcomingAppointments'
                                            : 'dashboard.upcomingAppointments',
                                    )}
                                </Typography>
                            }
                            action={
                                <Button
                                    size="small"
                                    endIcon={<ArrowForwardIcon />}
                                    onClick={() => navigate('/appointments')}
                                    sx={{ textTransform: 'none' }}
                                >
                                    {t('dashboard.viewAll')}
                                </Button>
                            }
                        />
                        <CardContent sx={{ pt: 0 }}>
                            {loadingFirst ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <Box key={i} sx={{ mb: 2 }}>
                                        <Skeleton variant="rounded" height={56} />
                                    </Box>
                                ))
                            ) : upcomingAppointments.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                                    <CalendarMonthIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
                                    <Typography variant="body2">{t('dashboard.noUpcomingAppointments')}</Typography>
                                </Box>
                            ) : (
                                <List disablePadding>
                                    {upcomingAppointments.map((appointment, index) => (
                                        <React.Fragment key={appointment._id}>
                                            {index > 0 && <Divider variant="inset" component="li" />}
                                            <ListItemButton
                                                sx={{ px: 1, borderRadius: 2 }}
                                                onClick={() => navigate(`/appointments/${appointment._id}`)}
                                            >
                                                <ListItemAvatar>
                                                    <Avatar
                                                        sx={{
                                                            bgcolor: '#0B5E6E',
                                                            width: 40,
                                                            height: 40,
                                                            fontSize: 14,
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        {getPatientInitials(appointment)}
                                                    </Avatar>
                                                </ListItemAvatar>
                                                <ListItemText
                                                    primary={
                                                        <Typography variant="body2" fontWeight={600}>
                                                            {patientName(appointment.patientId)}
                                                        </Typography>
                                                    }
                                                    secondary={
                                                        <Box
                                                            component="span"
                                                            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}
                                                        >
                                                            <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                                            <Typography variant="caption" color="text.secondary">
                                                                {formatDateTime(appointment.startTime, i18n.language)}
                                                            </Typography>
                                                            {!dashboard?.ownAppointments && (
                                                                <>
                                                                    <Typography variant="caption" color="text.secondary" sx={{ mx: 0.5 }}>
                                                                        &middot;
                                                                    </Typography>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        {staffName(appointment.dentistId)}
                                                                    </Typography>
                                                                </>
                                                            )}
                                                        </Box>
                                                    }
                                                />
                                                <StatusChip status={appointment.status} />
                                            </ListItemButton>
                                        </React.Fragment>
                                    ))}
                                </List>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* Right column: quick actions + recent activity */}
                <Grid item xs={12} md={5}>
                    <Grid container spacing={3}>
                        {quickActions.length > 0 && (
                            <Grid item xs={12}>
                                <Card>
                                    <CardHeader
                                        title={
                                            <Typography variant="h6" fontWeight={600}>
                                                {t('dashboard.quickActions')}
                                            </Typography>
                                        }
                                    />
                                    <CardContent sx={{ pt: 0 }}>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                            {quickActions.map((action, i) => (
                                                <Button
                                                    key={action.key}
                                                    variant={i === 0 ? 'contained' : 'outlined'}
                                                    startIcon={action.icon}
                                                    fullWidth
                                                    onClick={() => navigate(action.to)}
                                                    sx={{ justifyContent: 'flex-start', py: 1.5, px: 2.5, borderRadius: 2 }}
                                                >
                                                    {action.label}
                                                </Button>
                                            ))}
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        )}

                        <Grid item xs={12}>
                            <Card>
                                <CardHeader
                                    title={
                                        <Typography variant="h6" fontWeight={600}>
                                            {t('dashboard.recentActivity')}
                                        </Typography>
                                    }
                                />
                                <CardContent sx={{ pt: 0 }}>
                                    {loadingFirst ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <Box key={i} sx={{ mb: 1.5 }}>
                                                <Skeleton variant="rounded" height={40} />
                                            </Box>
                                        ))
                                    ) : recentActivity.length === 0 ? (
                                        <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                                            <Typography variant="body2">{t('dashboard.noRecentActivity')}</Typography>
                                        </Box>
                                    ) : (
                                        <List disablePadding dense>
                                            {recentActivity.map((activity, index) => (
                                                <React.Fragment key={`${activity.type}-${activity.id}-${activity.at}`}>
                                                    {index > 0 && <Divider component="li" />}
                                                    <ListItemButton
                                                        sx={{ px: 1, borderRadius: 2 }}
                                                        onClick={() => navigate(activityLink(activity))}
                                                    >
                                                        <ListItemAvatar sx={{ minWidth: 40 }}>
                                                            <Avatar
                                                                sx={{
                                                                    width: 32,
                                                                    height: 32,
                                                                    bgcolor: ACTIVITY_LOOK[activity.type].color,
                                                                }}
                                                            >
                                                                {ACTIVITY_LOOK[activity.type].icon}
                                                            </Avatar>
                                                        </ListItemAvatar>
                                                        <ListItemText
                                                            primary={
                                                                <Typography variant="body2" fontWeight={500}>
                                                                    {activityText(activity)}
                                                                </Typography>
                                                            }
                                                            secondary={
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {activity.by
                                                                        ? `${activity.by.firstName} ${activity.by.lastName} · `
                                                                        : ''}
                                                                    {formatDateTime(activity.at, i18n.language)}
                                                                </Typography>
                                                            }
                                                        />
                                                    </ListItemButton>
                                                </React.Fragment>
                                            ))}
                                        </List>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>
        </Box>
    );
};

export default DashboardPage;
