import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box,
    Grid,
    Card,
    CardContent,
    CardHeader,
    Typography,
    Button,
    List,
    ListItem,
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
} from '@mui/icons-material';
import { RootState } from '../../store';
import { reportsActions } from '../../store/reports';
import { StatCard, PageHeader } from '../../components/ui';
import StatusChip from '../../components/ui/StatusChip';
import { formatCurrency, formatTime, getInitials } from '../../utils/formatters';
import { patientName, staffName } from '../../utils/references';
import { Appointment, Patient, DashboardSummary } from '../../types';

const DashboardPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const user = useSelector((state: RootState) => state.auth.user);
    const dashboard: DashboardSummary | null = useSelector((state: RootState) => state.reports.dashboard);
    const isLoading = useSelector((state: RootState) =>
        state.http.loading.includes('GET_DASHBOARD'),
    );

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

    const upcomingAppointments = dashboard?.upcomingAppointments?.slice(0, 5) || [];
    const recentActivity = dashboard?.recentActivity?.slice(0, 5) || [];

    return (
        <Box>
            {/* Page Header */}
            <PageHeader
                title={`${t('dashboard.welcome')}, ${user?.firstName || ''}!`}
                subtitle={t('dashboard.title')}
            />

            {/* Stat Cards Row */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                    {isLoading ? (
                        <Skeleton variant="rounded" height={120} sx={{ borderRadius: 4 }} />
                    ) : (
                        <StatCard
                            title={t('dashboard.todayAppointments')}
                            value={dashboard?.todayAppointments ?? 0}
                            icon={<CalendarMonthIcon fontSize="large" />}
                            color="#3182CE"
                        />
                    )}
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    {isLoading ? (
                        <Skeleton variant="rounded" height={120} sx={{ borderRadius: 4 }} />
                    ) : (
                        <StatCard
                            title={t('dashboard.monthRevenue')}
                            value={formatCurrency(dashboard?.monthRevenue ?? 0)}
                            icon={<AttachMoneyIcon fontSize="large" />}
                            color="#38A169"
                        />
                    )}
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    {isLoading ? (
                        <Skeleton variant="rounded" height={120} sx={{ borderRadius: 4 }} />
                    ) : (
                        <StatCard
                            title={t('dashboard.totalPatients')}
                            value={dashboard?.totalActivePatients ?? 0}
                            icon={<PeopleIcon fontSize="large" />}
                            color="#0B5E6E"
                        />
                    )}
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    {isLoading ? (
                        <Skeleton variant="rounded" height={120} sx={{ borderRadius: 4 }} />
                    ) : (
                        <StatCard
                            title={t('dashboard.pendingInvoices')}
                            value={dashboard?.pendingInvoices ?? 0}
                            icon={<ReceiptIcon fontSize="large" />}
                            color="#ED8936"
                        />
                    )}
                </Grid>
            </Grid>

            {/* Bottom Section: Upcoming Appointments + Quick Actions + Recent Activity */}
            <Grid container spacing={3}>
                {/* Upcoming Appointments */}
                <Grid item xs={12} md={7}>
                    <Card sx={{ height: '100%' }}>
                        <CardHeader
                            title={
                                <Typography variant="h6" fontWeight={600}>
                                    {t('dashboard.upcomingAppointments')}
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
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <Box key={i} sx={{ mb: 2 }}>
                                        <Skeleton variant="rounded" height={56} />
                                    </Box>
                                ))
                            ) : upcomingAppointments.length === 0 ? (
                                <Box
                                    sx={{
                                        textAlign: 'center',
                                        py: 4,
                                        color: 'text.secondary',
                                    }}
                                >
                                    <CalendarMonthIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
                                    <Typography variant="body2">
                                        {t('dashboard.noUpcomingAppointments')}
                                    </Typography>
                                </Box>
                            ) : (
                                <List disablePadding>
                                    {upcomingAppointments.map((appointment, index) => (
                                        <React.Fragment key={appointment._id}>
                                            {index > 0 && <Divider variant="inset" component="li" />}
                                            <ListItem
                                                alignItems="center"
                                                sx={{
                                                    px: 0,
                                                    cursor: 'pointer',
                                                    borderRadius: 2,
                                                    '&:hover': { backgroundColor: 'action.hover' },
                                                }}
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
                                                            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}
                                                        >
                                                            <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                                            <Typography variant="caption" color="text.secondary">
                                                                {formatTime(appointment.startTime)}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary" sx={{ mx: 0.5 }}>
                                                                &middot;
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {staffName(appointment.dentistId)}
                                                            </Typography>
                                                        </Box>
                                                    }
                                                />
                                                <StatusChip status={appointment.status} />
                                            </ListItem>
                                        </React.Fragment>
                                    ))}
                                </List>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* Right Column: Quick Actions + Recent Activity */}
                <Grid item xs={12} md={5}>
                    <Grid container spacing={3}>
                        {/* Quick Actions */}
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
                                        <Button
                                            variant="contained"
                                            startIcon={<AddIcon />}
                                            fullWidth
                                            onClick={() => navigate('/appointments')}
                                            sx={{
                                                justifyContent: 'flex-start',
                                                py: 1.5,
                                                px: 2.5,
                                                borderRadius: 2,
                                                background: 'linear-gradient(135deg, #0B5E6E, #1A8A9E)',
                                                '&:hover': {
                                                    background: 'linear-gradient(135deg, #074750, #0B5E6E)',
                                                },
                                            }}
                                        >
                                            {t('dashboard.newAppointment')}
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            startIcon={<PersonAddIcon />}
                                            fullWidth
                                            onClick={() => navigate('/patients/new')}
                                            sx={{
                                                justifyContent: 'flex-start',
                                                py: 1.5,
                                                px: 2.5,
                                                borderRadius: 2,
                                                borderColor: '#0B5E6E',
                                                color: '#0B5E6E',
                                                '&:hover': {
                                                    borderColor: '#074750',
                                                    backgroundColor: 'rgba(11, 94, 110, 0.04)',
                                                },
                                            }}
                                        >
                                            {t('dashboard.newPatient')}
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            startIcon={<ReceiptLongIcon />}
                                            fullWidth
                                            onClick={() => navigate('/billing/new')}
                                            sx={{
                                                justifyContent: 'flex-start',
                                                py: 1.5,
                                                px: 2.5,
                                                borderRadius: 2,
                                                borderColor: '#C9A84C',
                                                color: '#C9A84C',
                                                '&:hover': {
                                                    borderColor: '#A88A3A',
                                                    backgroundColor: 'rgba(201, 168, 76, 0.04)',
                                                },
                                            }}
                                        >
                                            {t('dashboard.createInvoice')}
                                        </Button>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Recent Activity */}
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
                                    {isLoading ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <Box key={i} sx={{ mb: 1.5 }}>
                                                <Skeleton variant="rounded" height={40} />
                                            </Box>
                                        ))
                                    ) : recentActivity.length === 0 ? (
                                        <Box
                                            sx={{
                                                textAlign: 'center',
                                                py: 3,
                                                color: 'text.secondary',
                                            }}
                                        >
                                            <Typography variant="body2">
                                                {t('dashboard.noRecentActivity')}
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <List disablePadding dense>
                                            {recentActivity.map((activity, index) => (
                                                <React.Fragment key={activity._id}>
                                                    {index > 0 && <Divider component="li" />}
                                                    <ListItem sx={{ px: 0 }}>
                                                        <ListItemAvatar sx={{ minWidth: 40 }}>
                                                            <Avatar
                                                                sx={{
                                                                    width: 32,
                                                                    height: 32,
                                                                    fontSize: 12,
                                                                    bgcolor:
                                                                        activity.type === 'appointment'
                                                                            ? '#3182CE'
                                                                            : activity.type === 'patient'
                                                                            ? '#0B5E6E'
                                                                            : activity.type === 'invoice'
                                                                            ? '#ED8936'
                                                                            : '#38A169',
                                                                }}
                                                            >
                                                                {activity.type === 'appointment' ? (
                                                                    <CalendarMonthIcon sx={{ fontSize: 16 }} />
                                                                ) : activity.type === 'patient' ? (
                                                                    <PeopleIcon sx={{ fontSize: 16 }} />
                                                                ) : activity.type === 'invoice' ? (
                                                                    <ReceiptIcon sx={{ fontSize: 16 }} />
                                                                ) : (
                                                                    <AddIcon sx={{ fontSize: 16 }} />
                                                                )}
                                                            </Avatar>
                                                        </ListItemAvatar>
                                                        <ListItemText
                                                            primary={
                                                                <Typography variant="body2" fontWeight={500}>
                                                                    {activity.description}
                                                                </Typography>
                                                            }
                                                            secondary={
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {activity.userName} &middot;{' '}
                                                                    {formatTime(activity.timestamp)}
                                                                </Typography>
                                                            }
                                                        />
                                                    </ListItem>
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
