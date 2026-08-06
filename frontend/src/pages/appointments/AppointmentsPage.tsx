import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import {
    Box,
    Typography,
    ToggleButtonGroup,
    ToggleButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Tooltip,
    TextField,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Autocomplete,
    Grid,
    Select,
    FormControl,
    InputLabel,
} from '@mui/material';
import {
    CalendarMonth as CalendarIcon,
    ViewList as ListIcon,
    Visibility as ViewIcon,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    AccessTime as ClockIcon,
} from '@mui/icons-material';
import { RootState } from '../../store';
import { appointmentsActions } from '../../store/appointments';
import { staffActions } from '../../store/staff';
import { patientsActions } from '../../store/patients';
import { treatmentsActions } from '../../store/treatments';
import { PageHeader, StatusChip, EmptyState, LoadingSpinner } from '../../components/ui';
import { formatDate, formatTime } from '../../utils/formatters';
import { APPOINTMENT_STATUS_COLORS } from '../../utils/constants';
import { Appointment, Patient, UserProfile } from '../../types';

// ── Helper: extract name from populated or raw field ────────────────────────

const getPatientName = (patient: string | Patient | null): string => {
    if (!patient) return '-';
    if (typeof patient === 'string') return patient;
    return `${patient.lastName} ${patient.firstName}`;
};

const getDentistName = (dentist: string | UserProfile | null): string => {
    if (!dentist) return '-';
    if (typeof dentist === 'string') return dentist;
    return `${dentist.lastName} ${dentist.firstName}`;
};

// ── Form types ──────────────────────────────────────────────────────────────

interface NewAppointmentForm {
    patientId: string;
    dentistId: string;
    date: string;
    startTime: string;
    endTime: string;
    treatmentType: string;
    notes: string;
}

// ── Calendar helpers ────────────────────────────────────────────────────────

const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number): number => {
    return new Date(year, month, 1).getDay();
};

const isSameDay = (d1: Date, d2: Date): boolean => {
    return d1.getFullYear() === d2.getFullYear()
        && d1.getMonth() === d2.getMonth()
        && d1.getDate() === d2.getDate();
};

// ── Status options ──────────────────────────────────────────────────────────

const APPOINTMENT_STATUSES = [
    'scheduled',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'no_show',
] as const;

// ── Component ───────────────────────────────────────────────────────────────

const AppointmentsPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { list: appointments, calendar: calendarAppointments, total } = useSelector(
        (state: RootState) => state.appointments,
    );
    const { dentists } = useSelector((state: RootState) => state.staff);
    const { list: patients } = useSelector((state: RootState) => state.patients);
    const { list: treatments } = useSelector((state: RootState) => state.treatments);
    const { loading } = useSelector((state: RootState) => state.http);

    const isLoading = loading.includes('GET_APPOINTMENTS') || loading.includes('GET_CALENDAR');

    // ── Local state ─────────────────────────────────────────────────────────

    const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterDentist, setFilterDentist] = useState<string>('all');
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);

    // ── Form ────────────────────────────────────────────────────────────────

    const {
        control,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm<NewAppointmentForm>({
        defaultValues: {
            patientId: '',
            dentistId: '',
            date: new Date().toISOString().slice(0, 10),
            startTime: '09:00',
            endTime: '10:00',
            treatmentType: '',
            notes: '',
        },
    });

    const watchStart = watch('startTime');
    const watchEnd = watch('endTime');

    const calculatedDuration = useMemo(() => {
        if (!watchStart || !watchEnd) return 0;
        const [sh, sm] = watchStart.split(':').map(Number);
        const [eh, em] = watchEnd.split(':').map(Number);
        const diff = (eh * 60 + em) - (sh * 60 + sm);
        return diff > 0 ? diff : 0;
    }, [watchStart, watchEnd]);

    // ── Effects ─────────────────────────────────────────────────────────────

    useEffect(() => {
        dispatch(appointmentsActions.getAppointments());
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        dispatch(appointmentsActions.getCalendar({
            startDate: new Date(year, month, 1).toISOString(),
            endDate: new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString(),
        }));
        dispatch(staffActions.getDentists());
        dispatch(patientsActions.getPatients());
        dispatch(treatmentsActions.getTreatments());
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        dispatch(appointmentsActions.getCalendar({
            startDate: new Date(year, month, 1).toISOString(),
            endDate: new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString(),
        }));
    }, [calendarDate]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Filtered list ───────────────────────────────────────────────────────

    const filteredAppointments = useMemo(() => {
        let result = [...appointments];
        if (filterStatus !== 'all') {
            result = result.filter((a) => a.status === filterStatus);
        }
        if (filterDentist !== 'all') {
            result = result.filter((a) => {
                const dentistId = typeof a.dentistId === 'string' ? a.dentistId : a.dentistId?._id;
                return dentistId === filterDentist;
            });
        }
        return result;
    }, [appointments, filterStatus, filterDentist]);

    // ── Calendar data: group appointments by day ────────────────────────────

    const appointmentsByDay = useMemo(() => {
        const map = new Map<string, Appointment[]>();
        const source = calendarAppointments.length > 0 ? calendarAppointments : appointments;
        source.forEach((appt) => {
            const key = new Date(appt.startTime).toDateString();
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(appt);
        });
        return map;
    }, [calendarAppointments, appointments]);

    // ── Selected day appointments ───────────────────────────────────────────

    const selectedDayAppointments = useMemo(() => {
        if (!selectedDay) return [];
        const key = selectedDay.toDateString();
        return appointmentsByDay.get(key) || [];
    }, [selectedDay, appointmentsByDay]);

    // ── Handlers ────────────────────────────────────────────────────────────

    const handleViewChange = (_: React.MouseEvent<HTMLElement>, value: 'calendar' | 'list' | null) => {
        if (value) setViewMode(value);
    };

    const handlePrevMonth = () => {
        setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
        setSelectedDay(null);
    };

    const handleNextMonth = () => {
        setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
        setSelectedDay(null);
    };

    const handleDayClick = (day: Date) => {
        setSelectedDay(day);
    };

    const handleOpenDialog = () => {
        reset();
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        reset();
    };

    const onSubmit = (data: NewAppointmentForm) => {
        const startTime = new Date(`${data.date}T${data.startTime}:00`).toISOString();
        const endTime = new Date(`${data.date}T${data.endTime}:00`).toISOString();
        dispatch(appointmentsActions.createAppointment({
            patientId: data.patientId,
            dentistId: data.dentistId,
            startTime,
            endTime,
            duration: calculatedDuration,
            treatmentType: data.treatmentType,
            notes: data.notes,
            status: 'scheduled',
            title: data.treatmentType || 'Appointment',
        }));
        handleCloseDialog();
    };

    // ── Calendar grid render ────────────────────────────────────────────────

    const renderCalendarGrid = () => {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const today = new Date();
        const weekDays = [
            t('days.sunday'), t('days.monday'), t('days.tuesday'),
            t('days.wednesday'), t('days.thursday'), t('days.friday'), t('days.saturday'),
        ];

        const cells: React.ReactNode[] = [];

        // Blank cells for days before the first of the month
        for (let i = 0; i < firstDay; i++) {
            cells.push(
                <Box
                    key={`blank-${i}`}
                    sx={{
                        p: 1,
                        minHeight: 80,
                        borderRight: '1px solid',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                    }}
                />,
            );
        }

        // Day cells
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateKey = date.toDateString();
            const dayAppointments = appointmentsByDay.get(dateKey) || [];
            const isToday = isSameDay(date, today);
            const isSelected = selectedDay ? isSameDay(date, selectedDay) : false;

            cells.push(
                <Box
                    key={day}
                    onClick={() => handleDayClick(date)}
                    sx={{
                        p: 1,
                        minHeight: 80,
                        borderRight: '1px solid',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        cursor: 'pointer',
                        bgcolor: isSelected
                            ? 'primary.main'
                            : isToday
                                ? 'action.hover'
                                : 'transparent',
                        '&:hover': {
                            bgcolor: isSelected ? 'primary.dark' : 'action.hover',
                        },
                        transition: 'background-color 0.15s',
                    }}
                >
                    <Typography
                        variant="body2"
                        fontWeight={isToday ? 700 : 400}
                        sx={{
                            color: isSelected ? 'primary.contrastText' : isToday ? 'primary.main' : 'text.primary',
                        }}
                    >
                        {day}
                    </Typography>
                    {dayAppointments.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                            {dayAppointments.slice(0, 3).map((appt) => (
                                <Box
                                    key={appt._id}
                                    sx={{
                                        width: '100%',
                                        px: 0.5,
                                        py: 0.25,
                                        borderRadius: 0.5,
                                        bgcolor: APPOINTMENT_STATUS_COLORS[appt.status] || '#A0AEC0',
                                        color: '#fff',
                                        fontSize: 10,
                                        lineHeight: 1.3,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {formatTime(appt.startTime)} {getPatientName(appt.patientId)}
                                </Box>
                            ))}
                            {dayAppointments.length > 3 && (
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: isSelected ? 'primary.contrastText' : 'text.secondary',
                                        fontSize: 10,
                                    }}
                                >
                                    +{dayAppointments.length - 3}
                                </Typography>
                            )}
                        </Box>
                    )}
                </Box>,
            );
        }

        return (
            <Box>
                {/* Month navigation */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                    <IconButton onClick={handlePrevMonth} size="small">
                        <ChevronLeftIcon />
                    </IconButton>
                    <Typography variant="h6" sx={{ mx: 2, minWidth: 180, textAlign: 'center' }}>
                        {formatDate(calendarDate, 'LLLL yyyy')}
                    </Typography>
                    <IconButton onClick={handleNextMonth} size="small">
                        <ChevronRightIcon />
                    </IconButton>
                </Box>

                {/* Weekday headers */}
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(7, 1fr)',
                        borderLeft: '1px solid',
                        borderTop: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    {weekDays.map((wd) => (
                        <Box
                            key={wd}
                            sx={{
                                p: 1,
                                textAlign: 'center',
                                fontWeight: 700,
                                fontSize: 12,
                                color: 'text.secondary',
                                borderRight: '1px solid',
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'action.hover',
                            }}
                        >
                            {wd.slice(0, 3)}
                        </Box>
                    ))}

                    {/* Calendar cells */}
                    {cells}
                </Box>

                {/* Selected day detail */}
                {selectedDay && (
                    <Paper sx={{ mt: 2, p: 2 }}>
                        <Typography variant="h6" gutterBottom>
                            {formatDate(selectedDay, 'EEEE, dd MMMM yyyy')}
                        </Typography>
                        {selectedDayAppointments.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                                {t('appointments.noAppointments')}
                            </Typography>
                        ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {selectedDayAppointments.map((appt) => (
                                    <Paper
                                        key={appt._id}
                                        variant="outlined"
                                        sx={{
                                            p: 1.5,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            cursor: 'pointer',
                                            '&:hover': { bgcolor: 'action.hover' },
                                        }}
                                        onClick={() => navigate(`/appointments/${appt._id}`)}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <ClockIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                                <Typography variant="body2" fontWeight={600}>
                                                    {formatTime(appt.startTime)} - {formatTime(appt.endTime)}
                                                </Typography>
                                            </Box>
                                            <Typography variant="body2">
                                                {getPatientName(appt.patientId)}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {getDentistName(appt.dentistId)}
                                            </Typography>
                                        </Box>
                                        <StatusChip status={appt.status} />
                                    </Paper>
                                ))}
                            </Box>
                        )}
                    </Paper>
                )}
            </Box>
        );
    };

    // ── Render ───────────────────────────────────────────────────────────────

    if (isLoading && appointments.length === 0) {
        return <LoadingSpinner fullPage />;
    }

    return (
        <Box>
            <PageHeader
                title={t('appointments.title')}
                actionLabel={t('appointments.newAppointment')}
                onAction={handleOpenDialog}
            >
                <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={handleViewChange}
                    size="small"
                >
                    <ToggleButton value="calendar">
                        <Tooltip title={t('appointments.calendarView')}>
                            <CalendarIcon />
                        </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="list">
                        <Tooltip title={t('appointments.listView')}>
                            <ListIcon />
                        </Tooltip>
                    </ToggleButton>
                </ToggleButtonGroup>
            </PageHeader>

            {/* Filter bar */}
            <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>{t('appointments.status')}</InputLabel>
                    <Select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        label={t('appointments.status')}
                    >
                        <MenuItem value="all">{t('common.all')}</MenuItem>
                        {APPOINTMENT_STATUSES.map((s) => (
                            <MenuItem key={s} value={s}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box
                                        sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            bgcolor: APPOINTMENT_STATUS_COLORS[s] || '#A0AEC0',
                                        }}
                                    />
                                    {t(`appointments.${s === 'in_progress' ? 'inProgress' : s === 'no_show' ? 'noShow' : s}`)}
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>{t('appointments.dentist')}</InputLabel>
                    <Select
                        value={filterDentist}
                        onChange={(e) => setFilterDentist(e.target.value)}
                        label={t('appointments.dentist')}
                    >
                        <MenuItem value="all">{t('common.all')}</MenuItem>
                        {dentists.map((d: any) => (
                            <MenuItem key={d._id} value={d._id}>
                                {d.lastName} {d.firstName}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Box sx={{ flex: 1 }} />

                <Typography variant="body2" color="text.secondary">
                    {total} {t('appointments.title').toLowerCase()}
                </Typography>
            </Paper>

            {/* View content */}
            {viewMode === 'calendar' ? (
                <Paper sx={{ p: 2 }}>{renderCalendarGrid()}</Paper>
            ) : filteredAppointments.length === 0 ? (
                <EmptyState
                    title={t('appointments.noAppointments')}
                    actionLabel={t('appointments.newAppointment')}
                    onAction={handleOpenDialog}
                />
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('appointments.dateTime')}</TableCell>
                                <TableCell>{t('appointments.patient')}</TableCell>
                                <TableCell>{t('appointments.dentist')}</TableCell>
                                <TableCell>{t('appointments.treatmentType')}</TableCell>
                                <TableCell>{t('appointments.duration')}</TableCell>
                                <TableCell>{t('appointments.status')}</TableCell>
                                <TableCell align="right">{t('common.actions')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredAppointments.map((appt) => (
                                <TableRow
                                    key={appt._id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/appointments/${appt._id}`)}
                                >
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>
                                            {formatDate(appt.startTime)}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {formatTime(appt.startTime)} - {formatTime(appt.endTime)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>{getPatientName(appt.patientId)}</TableCell>
                                    <TableCell>{getDentistName(appt.dentistId)}</TableCell>
                                    <TableCell>{appt.treatmentType || '-'}</TableCell>
                                    <TableCell>
                                        {appt.duration} {t('common.minutes').toLowerCase()}
                                    </TableCell>
                                    <TableCell>
                                        <StatusChip status={appt.status} />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title={t('common.edit')}>
                                            <IconButton
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/appointments/${appt._id}`);
                                                }}
                                            >
                                                <ViewIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* New Appointment Dialog */}
            <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <DialogTitle>{t('appointments.newAppointment')}</DialogTitle>
                    <DialogContent>
                        <Grid container spacing={2} sx={{ mt: 0.5 }}>
                            {/* Patient selector */}
                            <Grid item xs={12}>
                                <Controller
                                    name="patientId"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <Autocomplete
                                            options={patients}
                                            getOptionLabel={(opt: Patient) =>
                                                `${opt.lastName} ${opt.firstName}${opt.patronymic ? ` ${opt.patronymic}` : ''}`
                                            }
                                            value={patients.find((p) => p._id === field.value) || null}
                                            onChange={(_, val) => field.onChange(val?._id || '')}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label={t('appointments.patient')}
                                                    error={!!errors.patientId}
                                                    helperText={errors.patientId?.message}
                                                />
                                            )}
                                        />
                                    )}
                                />
                            </Grid>

                            {/* Dentist selector */}
                            <Grid item xs={12}>
                                <Controller
                                    name="dentistId"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            select
                                            fullWidth
                                            label={t('appointments.dentist')}
                                            error={!!errors.dentistId}
                                            helperText={errors.dentistId?.message}
                                        >
                                            {dentists.map((d: any) => (
                                                <MenuItem key={d._id} value={d._id}>
                                                    {d.lastName} {d.firstName}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    )}
                                />
                            </Grid>

                            {/* Date */}
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="date"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            type="date"
                                            label={t('common.date')}
                                            InputLabelProps={{ shrink: true }}
                                            error={!!errors.date}
                                            helperText={errors.date?.message}
                                        />
                                    )}
                                />
                            </Grid>

                            {/* Start time */}
                            <Grid item xs={6} sm={4}>
                                <Controller
                                    name="startTime"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            type="time"
                                            label={t('appointments.startTime')}
                                            InputLabelProps={{ shrink: true }}
                                            error={!!errors.startTime}
                                            helperText={errors.startTime?.message}
                                        />
                                    )}
                                />
                            </Grid>

                            {/* End time */}
                            <Grid item xs={6} sm={4}>
                                <Controller
                                    name="endTime"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            type="time"
                                            label={t('appointments.endTime')}
                                            InputLabelProps={{ shrink: true }}
                                            error={!!errors.endTime}
                                            helperText={errors.endTime?.message}
                                        />
                                    )}
                                />
                            </Grid>

                            {/* Auto-calculated duration */}
                            <Grid item xs={12}>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        px: 2,
                                        py: 1,
                                        bgcolor: 'action.hover',
                                        borderRadius: 1,
                                    }}
                                >
                                    <ClockIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                    <Typography variant="body2" color="text.secondary">
                                        {t('appointments.duration')}: {calculatedDuration} {t('common.minutes').toLowerCase()}
                                    </Typography>
                                </Box>
                            </Grid>

                            {/* Treatment type */}
                            <Grid item xs={12}>
                                <Controller
                                    name="treatmentType"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            select
                                            fullWidth
                                            label={t('appointments.treatmentType')}
                                        >
                                            <MenuItem value="">-</MenuItem>
                                            {treatments.map((tr) => (
                                                <MenuItem key={tr._id} value={tr.name}>
                                                    {tr.name}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    )}
                                />
                            </Grid>

                            {/* Notes */}
                            <Grid item xs={12}>
                                <Controller
                                    name="notes"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            multiline
                                            rows={3}
                                            label={t('appointments.notes')}
                                        />
                                    )}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2 }}>
                        <Button onClick={handleCloseDialog} color="inherit">
                            {t('common.cancel')}
                        </Button>
                        <Button type="submit" variant="contained">
                            {t('common.save')}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </Box>
    );
};

export default AppointmentsPage;
