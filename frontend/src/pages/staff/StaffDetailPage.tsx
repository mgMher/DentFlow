import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Avatar,
    Box,
    Button,
    FormControlLabel,
    Grid,
    MenuItem,
    Paper,
    Switch,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import {
    ArrowBack as BackIcon,
    AttachMoney as RevenueIcon,
    CheckCircle as CompletedIcon,
    Event as AppointmentsIcon,
    Percent as RateIcon,
    Save as SaveIcon,
    ToggleOff as DeactivateIcon,
    ToggleOn as ActivateIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Controller, useForm } from 'react-hook-form';
import { RootState } from '../../store';
import { staffActions } from '../../store/staff';
import { reportsActions } from '../../store/reports';
import {
    ConfirmDialog,
    LoadingSpinner,
    PageHeader,
    StatCard,
    StatusChip,
} from '../../components/ui';
import { useAuth, useHttpState } from '../../hooks';
import { formatCurrency, getFullName, getInitials } from '../../utils/formatters';
import { EMAIL_PATTERN, isArmenianPhone } from '../../utils/validators';
import { staffRefId } from '../../utils/staff';
import { DENTIST_SPECIALIZATIONS, STAFF_ROLES } from '../../types';
import {
    AvailabilityRow,
    StaffFormData,
    availabilityToRows,
    emptyStaffForm,
    invalidAvailabilityRows,
    roleTranslationKey,
    rowsToAvailability,
    staffToForm,
    toStaffPayload,
} from './staffForm';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
    if (value !== index) return null;
    return <Box sx={{ py: 3 }}>{children}</Box>;
};

const StaffDetailPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();

    const staff = useSelector((state: RootState) => state.staff.current);
    const performance = useSelector((state: RootState) => state.reports.dentistPerformance);
    const loading = useSelector((state: RootState) =>
        state.http.loading.includes('GET_STAFF_MEMBER'),
    );
    const loadingPerformance = useSelector((state: RootState) =>
        state.http.loading.includes('GET_DENTIST_PERF'),
    );
    const { error: loadError } = useHttpState('GET_STAFF_MEMBER');
    const {
        loading: savingProfile,
        error: profileError,
        success: profileSaved,
        clearSuccess: clearProfileSaved,
    } = useHttpState('UPDATE_STAFF');
    const {
        loading: savingAvailability,
        error: availabilityError,
        success: availabilitySaved,
        clearSuccess: clearAvailabilitySaved,
    } = useHttpState('UPDATE_STAFF_AVAILABILITY');
    const {
        error: statusError,
        success: statusSuccess,
        clearError: clearStatusError,
        clearSuccess: clearStatusSuccess,
    } = useHttpState('UPDATE_STAFF_STATUS');
    const { error: performanceError } = useHttpState('GET_DENTIST_PERF');

    const [activeTab, setActiveTab] = useState(0);
    const [availability, setAvailability] = useState<AvailabilityRow[]>(() =>
        availabilityToRows(undefined),
    );
    const [pendingStatus, setPendingStatus] = useState<boolean | null>(null);

    const canManageStaff = user?.role === 'clinic_admin' || user?.role === 'super_admin';
    // Members maintain their own working hours even without staff-management rights.
    const isSelf = !!staff && !!user && staffRefId(staff) === user._id;
    const canEditAvailability = canManageStaff || isSelf;

    const {
        control,
        handleSubmit,
        watch,
        reset,
        formState: { errors, isDirty },
    } = useForm<StaffFormData>({ defaultValues: emptyStaffForm, mode: 'onBlur' });

    const selectedRole = watch('role');

    useEffect(() => {
        if (id) {
            dispatch(staffActions.getStaffMember(id));
        }
        return () => {
            dispatch(staffActions.clearStaffMember());
        };
    }, [dispatch, id]);

    // Re-seed both forms from the server record: on load, and again after a save
    // returns the stored document, so the fields show what was actually kept.
    useEffect(() => {
        if (!staff || staff._id !== id) return;
        reset(staffToForm(staff));
        setAvailability(availabilityToRows(staff.schedule?.defaultAvailability));
    }, [staff, id]); // eslint-disable-line react-hooks/exhaustive-deps

    // `/reports` is open to admins and dentists only, so anyone else would just
    // get a 403 behind the tab.
    const canSeeReports = canManageStaff || user?.role === 'dentist';
    const showPerformance = staff?.role === 'dentist' && canSeeReports;

    useEffect(() => {
        if (activeTab === 2 && showPerformance) {
            dispatch(reportsActions.getDentistPerf());
        }
    }, [activeTab, showPerformance, dispatch]);

    // The refreshed record is the visible feedback; drop the flag so it does not
    // pile up across changes.
    useEffect(() => {
        if (statusSuccess) clearStatusSuccess();
    }, [statusSuccess, clearStatusSuccess]);

    // Changing the role away from dentist removes the third tab under the user.
    useEffect(() => {
        if (activeTab === 2 && !showPerformance) setActiveTab(0);
    }, [activeTab, showPerformance]);

    // The saved banners are acknowledgements, not state: drop them after a beat
    // so a later save shows a fresh one.
    useEffect(() => {
        if (!profileSaved) return;
        const timer = setTimeout(clearProfileSaved, 4000);
        return () => clearTimeout(timer);
    }, [profileSaved, clearProfileSaved]);

    useEffect(() => {
        if (!availabilitySaved) return;
        const timer = setTimeout(clearAvailabilitySaved, 4000);
        return () => clearTimeout(timer);
    }, [availabilitySaved, clearAvailabilitySaved]);

    /**
     * Performance rows are keyed by the auth id, which is what appointments and
     * invoices reference — not the profile id in the URL.
     */
    const stats = useMemo(() => {
        const refId = staffRefId(staff);
        if (!refId || !performance) return null;

        const appointments = performance.appointmentsPerDentist?.find(
            (row: any) => row._id === refId,
        );
        const revenue = performance.revenuePerDentist?.find((row: any) => row._id === refId);

        const total = appointments?.totalAppointments ?? 0;
        return {
            total,
            completed: appointments?.completed ?? 0,
            cancelled: appointments?.cancelled ?? 0,
            completionRate: total ? Math.round(((appointments?.completed ?? 0) / total) * 100) : 0,
            revenue: revenue?.totalRevenue ?? 0,
            invoiceCount: revenue?.invoiceCount ?? 0,
        };
    }, [performance, staff]);

    const onSaveProfile = (data: StaffFormData) => {
        if (!id) return;
        dispatch(staffActions.updateStaff({ id, data: toStaffPayload(data) }));
    };

    const availabilityErrors = invalidAvailabilityRows(availability);

    const handleSaveAvailability = () => {
        if (!id || availabilityErrors.length > 0) return;
        dispatch(
            staffActions.updateStaffAvailability({
                id,
                defaultAvailability: rowsToAvailability(availability),
            }),
        );
    };

    const handleAvailabilityChange = (
        index: number,
        field: keyof AvailabilityRow,
        value: string | boolean,
    ) => {
        setAvailability((rows) =>
            rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
        );
    };

    const confirmStatusChange = () => {
        if (!id || pendingStatus === null) return;
        dispatch(staffActions.updateStaffStatus({ id, isActive: pendingStatus }));
        setPendingStatus(null);
    };

    if (loading || (!staff && !loadError)) {
        return <LoadingSpinner fullPage />;
    }

    if (!staff) {
        return (
            <Box>
                <PageHeader title={t('staff.title')}>
                    <Button variant="text" startIcon={<BackIcon />} onClick={() => navigate('/staff')}>
                        {t('common.back')}
                    </Button>
                </PageHeader>
                <Alert severity="error">{loadError}</Alert>
            </Box>
        );
    }

    const isActive = staff.isActive !== false;

    return (
        <Box>
            <PageHeader title={t('staff.title')}>
                <Button variant="text" startIcon={<BackIcon />} onClick={() => navigate('/staff')}>
                    {t('common.back')}
                </Button>
                {canManageStaff && (
                    <Button
                        variant="outlined"
                        color={isActive ? 'error' : 'success'}
                        startIcon={isActive ? <DeactivateIcon /> : <ActivateIcon />}
                        onClick={() => {
                            clearStatusError();
                            setPendingStatus(!isActive);
                        }}
                    >
                        {isActive ? t('common.deactivate') : t('common.activate')}
                    </Button>
                )}
            </PageHeader>

            {statusError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {statusError}
                </Alert>
            )}

            {/* Staff Profile Card */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Avatar
                        src={staff.avatar || undefined}
                        sx={{ width: 80, height: 80, fontSize: 28, bgcolor: 'primary.main' }}
                    >
                        {getInitials(staff.firstName, staff.lastName)}
                    </Avatar>
                    <Box>
                        <Typography variant="h5" fontWeight={700}>
                            {getFullName(staff.firstName, staff.lastName, staff.patronymic)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <StatusChip
                                status={staff.role === 'dentist' ? 'confirmed' : 'scheduled'}
                                translationPrefix="staff"
                                label={t(`staff.${roleTranslationKey(staff.role)}`)}
                            />
                            <StatusChip
                                status={isActive ? 'active' : 'inactive'}
                                translationPrefix="common"
                            />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {staff.email}
                            {staff.phone ? ` | ${staff.phone}` : ''}
                        </Typography>
                    </Box>
                </Box>
            </Paper>

            {/* Tabs */}
            <Paper sx={{ mb: 3 }}>
                <Tabs
                    value={activeTab}
                    onChange={(_e, v) => setActiveTab(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
                >
                    <Tab label={t('staff.profile')} />
                    <Tab label={t('staff.availability')} />
                    {showPerformance && <Tab label={t('reports.dentistPerformance')} />}
                </Tabs>
            </Paper>

            {/* Profile Tab */}
            <TabPanel value={activeTab} index={0}>
                <Paper sx={{ p: 3 }}>
                    {!canManageStaff && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            {t('staff.readOnlyProfile')}
                        </Alert>
                    )}
                    {profileError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {profileError}
                        </Alert>
                    )}
                    {profileSaved && !profileError && (
                        <Alert severity="success" sx={{ mb: 2 }}>
                            {t('toast.saveSuccess')}
                        </Alert>
                    )}
                    <Box component="form" onSubmit={handleSubmit(onSaveProfile)} noValidate>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={4}>
                                <Controller
                                    name="firstName"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            required
                                            fullWidth
                                            size="small"
                                            label={t('patients.firstName')}
                                            disabled={!canManageStaff}
                                            error={!!errors.firstName}
                                            helperText={errors.firstName?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Controller
                                    name="lastName"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            required
                                            fullWidth
                                            size="small"
                                            label={t('patients.lastName')}
                                            disabled={!canManageStaff}
                                            error={!!errors.lastName}
                                            helperText={errors.lastName?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Controller
                                    name="patronymic"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.patronymic')}
                                            disabled={!canManageStaff}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Controller
                                    name="email"
                                    control={control}
                                    rules={{
                                        required: t('validation.required'),
                                        pattern: {
                                            value: EMAIL_PATTERN,
                                            message: t('validation.invalidEmail'),
                                        },
                                    }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            required
                                            fullWidth
                                            size="small"
                                            type="email"
                                            label={t('patients.email')}
                                            disabled={!canManageStaff}
                                            error={!!errors.email}
                                            helperText={
                                                errors.email?.message || t('staff.emailIsLogin')
                                            }
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Controller
                                    name="phone"
                                    control={control}
                                    rules={{
                                        validate: (value) =>
                                            !value.trim() ||
                                            isArmenianPhone(value) ||
                                            t('validation.invalidArmenianPhone'),
                                    }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.phone')}
                                            placeholder="+374 93 123456"
                                            disabled={!canManageStaff}
                                            error={!!errors.phone}
                                            helperText={
                                                errors.phone?.message ||
                                                t('validation.invalidArmenianPhone')
                                            }
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Controller
                                    name="role"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            select
                                            required
                                            fullWidth
                                            size="small"
                                            label={t('staff.role')}
                                            disabled={!canManageStaff}
                                            error={!!errors.role}
                                            helperText={errors.role?.message}
                                        >
                                            {STAFF_ROLES.map((role) => (
                                                <MenuItem key={role} value={role}>
                                                    {t(`staff.${roleTranslationKey(role)}`)}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    )}
                                />
                            </Grid>
                            {selectedRole === 'dentist' && (
                                <Grid item xs={12} md={4}>
                                    <Controller
                                        name="specialization"
                                        control={control}
                                        rules={{ required: t('validation.required') }}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                select
                                                required
                                                fullWidth
                                                size="small"
                                                label={t('staff.specialization')}
                                                disabled={!canManageStaff}
                                                error={!!errors.specialization}
                                                helperText={errors.specialization?.message}
                                            >
                                                {DENTIST_SPECIALIZATIONS.map((spec) => (
                                                    <MenuItem key={spec} value={spec}>
                                                        {t(`staff.specializations.${spec}`)}
                                                    </MenuItem>
                                                ))}
                                            </TextField>
                                        )}
                                    />
                                </Grid>
                            )}
                            <Grid item xs={12} md={selectedRole === 'dentist' ? 4 : 8}>
                                <Controller
                                    name="licenseNumber"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('staff.licenseNumber')}
                                            disabled={!canManageStaff}
                                        />
                                    )}
                                />
                            </Grid>
                        </Grid>
                        {canManageStaff && (
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
                                <Button
                                    color="inherit"
                                    disabled={!isDirty || savingProfile}
                                    onClick={() => reset(staffToForm(staff))}
                                >
                                    {t('common.reset')}
                                </Button>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    startIcon={<SaveIcon />}
                                    disabled={savingProfile}
                                >
                                    {savingProfile ? t('common.loading') : t('common.save')}
                                </Button>
                            </Box>
                        )}
                    </Box>
                </Paper>
            </TabPanel>

            {/* Availability Tab */}
            <TabPanel value={activeTab} index={1}>
                <Paper>
                    <Box sx={{ p: 2, pb: 0 }}>
                        <Typography variant="body2" color="text.secondary">
                            {t('staff.availabilityHint')}
                        </Typography>
                        {!canEditAvailability && (
                            <Alert severity="info" sx={{ mt: 2 }}>
                                {t('staff.readOnlyAvailability')}
                            </Alert>
                        )}
                        {availabilityError && (
                            <Alert severity="error" sx={{ mt: 2 }}>
                                {availabilityError}
                            </Alert>
                        )}
                        {availabilitySaved && !availabilityError && (
                            <Alert severity="success" sx={{ mt: 2 }}>
                                {t('toast.saveSuccess')}
                            </Alert>
                        )}
                    </Box>
                    <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ width: '25%' }}>{t('staff.day')}</TableCell>
                                    <TableCell sx={{ width: '25%' }}>
                                        {t('appointments.startTime')}
                                    </TableCell>
                                    <TableCell sx={{ width: '25%' }}>
                                        {t('appointments.endTime')}
                                    </TableCell>
                                    <TableCell sx={{ width: '25%' }}>
                                        {t('staff.working')}
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {availability.map((row, index) => {
                                    const invalid = row.isOpen && row.startTime >= row.endTime;
                                    return (
                                        <TableRow key={row.day}>
                                            <TableCell>
                                                <Typography fontWeight={row.isOpen ? 600 : 400}>
                                                    {t(`days.${row.day}`)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <TextField
                                                    type="time"
                                                    size="small"
                                                    value={row.startTime}
                                                    onChange={(e) =>
                                                        handleAvailabilityChange(
                                                            index,
                                                            'startTime',
                                                            e.target.value,
                                                        )
                                                    }
                                                    disabled={!row.isOpen || !canEditAvailability}
                                                    error={invalid}
                                                    sx={{ width: 140 }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <TextField
                                                    type="time"
                                                    size="small"
                                                    value={row.endTime}
                                                    onChange={(e) =>
                                                        handleAvailabilityChange(
                                                            index,
                                                            'endTime',
                                                            e.target.value,
                                                        )
                                                    }
                                                    disabled={!row.isOpen || !canEditAvailability}
                                                    error={invalid}
                                                    helperText={
                                                        invalid
                                                            ? t('staff.endBeforeStart')
                                                            : undefined
                                                    }
                                                    sx={{ width: 140 }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            checked={row.isOpen}
                                                            onChange={(e) =>
                                                                handleAvailabilityChange(
                                                                    index,
                                                                    'isOpen',
                                                                    e.target.checked,
                                                                )
                                                            }
                                                            disabled={!canEditAvailability}
                                                            color="primary"
                                                        />
                                                    }
                                                    label={
                                                        row.isOpen
                                                            ? t('staff.working')
                                                            : t('staff.dayOff')
                                                    }
                                                />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    {canEditAvailability && (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, p: 2 }}>
                            <Button
                                color="inherit"
                                disabled={savingAvailability}
                                onClick={() =>
                                    setAvailability(
                                        availabilityToRows(staff.schedule?.defaultAvailability),
                                    )
                                }
                            >
                                {t('common.reset')}
                            </Button>
                            <Button
                                variant="contained"
                                startIcon={<SaveIcon />}
                                onClick={handleSaveAvailability}
                                disabled={savingAvailability || availabilityErrors.length > 0}
                            >
                                {savingAvailability ? t('common.loading') : t('common.save')}
                            </Button>
                        </Box>
                    )}
                </Paper>
            </TabPanel>

            {/* Performance Tab — dentists only */}
            {showPerformance && (
                <TabPanel value={activeTab} index={2}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t('staff.performanceHint')}
                    </Typography>
                    {performanceError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {performanceError}
                        </Alert>
                    )}
                    {loadingPerformance && !performance ? (
                        <LoadingSpinner />
                    ) : (
                        <>
                            <Grid container spacing={3} sx={{ mb: 3 }}>
                                <Grid item xs={12} md={3}>
                                    <StatCard
                                        title={t('staff.totalAppointments')}
                                        value={stats?.total ?? 0}
                                        icon={<AppointmentsIcon />}
                                        color="#3182CE"
                                    />
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <StatCard
                                        title={t('appointments.completed')}
                                        value={stats?.completed ?? 0}
                                        icon={<CompletedIcon />}
                                        color="#38A169"
                                    />
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <StatCard
                                        title={t('reports.completionRate')}
                                        value={`${stats?.completionRate ?? 0}%`}
                                        icon={<RateIcon />}
                                        color="#ED8936"
                                    />
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <StatCard
                                        title={t('reports.totalRevenue')}
                                        value={formatCurrency(stats?.revenue ?? 0)}
                                        icon={<RevenueIcon />}
                                        color="#0B5E6E"
                                    />
                                </Grid>
                            </Grid>
                            <Paper sx={{ p: 3 }}>
                                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                                    {t('reports.dentistPerformance')}
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={6} md={3}>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('appointments.cancelled')}
                                        </Typography>
                                        <Typography variant="h6">{stats?.cancelled ?? 0}</Typography>
                                    </Grid>
                                    <Grid item xs={6} md={3}>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('billing.invoices')}
                                        </Typography>
                                        <Typography variant="h6">
                                            {stats?.invoiceCount ?? 0}
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </Paper>
                        </>
                    )}
                </TabPanel>
            )}

            <ConfirmDialog
                open={pendingStatus !== null}
                title={t('staff.changeStatus')}
                message={t('staff.confirmStatusChange', {
                    name: getFullName(staff.firstName, staff.lastName),
                    status: pendingStatus ? t('common.active') : t('common.inactive'),
                })}
                variant={pendingStatus ? 'default' : 'danger'}
                onConfirm={confirmStatusChange}
                onCancel={() => setPendingStatus(null)}
            />
        </Box>
    );
};

export default StaffDetailPage;
