import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box,
    Button,
    IconButton,
    MenuItem,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    Add as AddIcon,
    CalendarMonth as CalendarIcon,
    CalendarViewDay as DayIcon,
    CalendarViewWeek as WeekIcon,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    Today as TodayIcon,
    ViewList as ListIcon,
} from '@mui/icons-material';
import { addDays, addWeeks, startOfWeek } from 'date-fns';
import { RootState } from '../../store';
import { appointmentsActions, AppointmentFilters } from '../../store/appointments';
import { staffActions } from '../../store/staff';
import { scheduleActions } from '../../store/schedule';
import { EmptyState, LoadingSpinner, PageHeader, StatusChip } from '../../components/ui';
import AppointmentFormDialog from '../../components/appointments/AppointmentFormDialog';
import ScheduleView, { ScheduleMode, ScheduleMove, ScheduleSlot } from '../../components/appointments/ScheduleView';
import MoveAppointmentDialog from '../../components/appointments/MoveAppointmentDialog';
import { usePermission } from '../../hooks';
import { formatDate, formatTime } from '../../utils/formatters';
import { patientName, staffName } from '../../utils/references';
import { staffRefId } from '../../utils/staff';
import { APPOINTMENT_STATUS_COLORS, DEFAULT_PAGE_SIZE } from '../../utils/constants';
import { APPOINTMENT_STATUSES, appointmentLabel, statusKey } from '../../utils/appointments';
import { toLocalDateString } from '../../utils/dates';
import { Appointment, AppointmentStatus } from '../../types';

const MAX_PER_DAY_CELL = 3;
type ViewName = 'day' | 'week' | 'month' | 'list';
const VIEWS: ViewName[] = ['day', 'week', 'month', 'list'];

/** Per-browser preferences; storage can be unavailable (private mode), so never let it throw. */
const remembered = <T extends string>(key: string, allowed: T[], fallback: T): T => {
    try {
        const value = localStorage.getItem(key) as T | null;
        return value && allowed.includes(value) ? value : fallback;
    } catch {
        return fallback;
    }
};
const remember = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch {
        /* not kept: fine */
    }
};

const startOfDayLocal = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** `[first day of month 00:00, first day of next month 00:00)` in the browser's (the clinic's) time. */
const monthRange = (month: Date) => ({
    startDate: new Date(month.getFullYear(), month.getMonth(), 1).toISOString(),
    endDate: new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString(),
});

const AppointmentsPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const can = usePermission();
    const canBook = can('manageAppointments');

    const { list, total, calendar } = useSelector((state: RootState) => state.appointments);
    const dentists = useSelector((state: RootState) => state.staff.dentists);
    const rooms = useSelector((state: RootState) => state.schedule.rooms);
    const workingHours = useSelector((state: RootState) => state.clinic.clinic?.workingHours) ?? [];
    const listLoading = useSelector((state: RootState) => state.http.loading.includes('GET_APPOINTMENTS'));
    const calendarLoading = useSelector((state: RootState) => state.http.loading.includes('GET_CALENDAR'));

    const [view, setViewState] = useState<ViewName>(() => remembered('appointments.view', VIEWS, 'day'));
    const [mode, setModeState] = useState<ScheduleMode>(() => remembered<ScheduleMode>('appointments.columns', ['dentist', 'room'], 'dentist'));
    const [focus, setFocus] = useState(() => startOfDayLocal(new Date()));
    const [resourceId, setResourceId] = useState<string>('all');
    const [slot, setSlot] = useState<ScheduleSlot | null>(null);
    const [move, setMove] = useState<ScheduleMove | null>(null);
    const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const setView = (v: ViewName) => {
        setViewState(v);
        remember('appointments.view', v);
    };
    const setMode = (m: ScheduleMode) => {
        setModeState(m);
        setResourceId('all');
        remember('appointments.columns', m);
    };
    const timeGrid = view === 'day' || view === 'week';
    const [status, setStatus] = useState<AppointmentStatus | 'all'>('all');
    const [dentistId, setDentistId] = useState('all');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
    const [selectedDay, setSelectedDay] = useState<string>(toLocalDateString());
    const [bookingDate, setBookingDate] = useState<string | null>(null);

    // Filters go to the server: the old page fetched the 20 oldest appointments
    // ever and filtered those in the browser.
    // The day / week grid loads every column and filters on screen.
    const filters = useMemo<AppointmentFilters & { startDate: string; endDate: string }>(() => {
        const range =
            view === 'day'
                ? { startDate: focus.toISOString(), endDate: addDays(focus, 1).toISOString() }
                : view === 'week'
                  ? (() => {
                        const monday = startOfWeek(focus, { weekStartsOn: 1 });
                        return { startDate: monday.toISOString(), endDate: addDays(monday, 7).toISOString() };
                    })()
                  : monthRange(month);
        return {
            ...range,
            ...(status !== 'all' ? { status } : {}),
            ...(!timeGrid && dentistId !== 'all' ? { dentistId } : {}),
        };
    }, [view, focus, month, status, dentistId, timeGrid]);

    useEffect(() => {
        dispatch(staffActions.getDentists());
        dispatch(scheduleActions.getRooms());
    }, [dispatch]);

    useEffect(() => {
        dispatch(appointmentsActions.getCalendar(filters));
    }, [dispatch, filters]);

    useEffect(() => {
        if (view === 'list') {
            dispatch(appointmentsActions.getAppointments({ ...filters, page: page + 1, limit: rowsPerPage }));
        }
    }, [dispatch, filters, view, page, rowsPerPage]);

    useEffect(() => setPage(0), [filters]);

    const byDay = useMemo(() => {
        const map = new Map<string, Appointment[]>();
        for (const appt of calendar) {
            const key = toLocalDateString(new Date(appt.startTime));
            map.set(key, [...(map.get(key) || []), appt]);
        }
        return map;
    }, [calendar]);

    const shiftMonth = (delta: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
    const shift = (delta: number) => {
        if (view === 'day') setFocus((d) => addDays(d, delta));
        else if (view === 'week') setFocus((d) => addWeeks(d, delta));
        else shiftMonth(delta);
    };
    const goToday = () => {
        const now = new Date();
        setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
        setSelectedDay(toLocalDateString(now));
        setFocus(startOfDayLocal(now));
    };

    // The week grid shows one dentist or chair: default to the first.
    const columnOptions = mode === 'dentist'
        ? dentists.map((d) => ({ id: staffRefId(d), name: staffName(d) }))
        : rooms.filter((r) => r.isActive !== false).map((r) => ({ id: r._id, name: r.name }));
    const gridResource = view === 'week' && resourceId === 'all' ? columnOptions[0]?.id ?? 'all' : resourceId;

    // date-fns locales, not Intl: browsers often lack Armenian and fall back to English.
    const weekStart = startOfWeek(focus, { weekStartsOn: 1 });
    const monthTitle =
        view === 'day'
            ? formatDate(focus, 'EEEE, d MMMM yyyy', i18n.language)
            : view === 'week'
              ? `${formatDate(weekStart, 'd MMM', i18n.language)} – ${formatDate(addDays(weekStart, 6), 'd MMM yyyy', i18n.language)}`
              : formatDate(month, 'LLLL yyyy', i18n.language);
    const today = toLocalDateString();

    const renderCalendar = () => {
        const firstWeekday = month.getDay();
        const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
        const cells: (string | null)[] = [
            ...Array(firstWeekday).fill(null),
            ...Array.from({ length: daysInMonth }, (_, i) =>
                toLocalDateString(new Date(month.getFullYear(), month.getMonth(), i + 1)),
            ),
        ];

        return (
            <Paper sx={{ overflow: 'hidden' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                    {WEEKDAYS.map((d) => (
                        <Box key={d} sx={{ p: 1, textAlign: 'center', borderBottom: 1, borderColor: 'divider' }}>
                            <Typography variant="caption" fontWeight={600} color="text.secondary">
                                {t(`days.${d}`).slice(0, 3)}
                            </Typography>
                        </Box>
                    ))}
                    {cells.map((day, i) => {
                        if (!day) return <Box key={`blank-${i}`} sx={{ minHeight: 96, borderRight: 1, borderBottom: 1, borderColor: 'divider' }} />;
                        const items = byDay.get(day) || [];
                        const selected = day === selectedDay;
                        return (
                            <Box
                                key={day}
                                onClick={() => setSelectedDay(day)}
                                onDoubleClick={() => canBook && day >= today && setBookingDate(day)}
                                sx={{
                                    minHeight: 96,
                                    p: 0.5,
                                    minWidth: 0,
                                    cursor: 'pointer',
                                    borderRight: 1,
                                    borderBottom: 1,
                                    borderColor: 'divider',
                                    bgcolor: selected ? 'action.selected' : 'transparent',
                                    '&:hover': { bgcolor: 'action.hover' },
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    fontWeight={day === today ? 800 : 500}
                                    color={day === today ? 'primary.main' : 'text.primary'}
                                >
                                    {Number(day.slice(8))}
                                </Typography>
                                {items.slice(0, MAX_PER_DAY_CELL).map((appt) => (
                                    <Box
                                        key={appt._id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/appointments/${appt._id}`);
                                        }}
                                        sx={{
                                            mt: 0.25,
                                            px: 0.5,
                                            borderRadius: 0.5,
                                            fontSize: 11,
                                            lineHeight: 1.6,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            color: '#fff',
                                            bgcolor: APPOINTMENT_STATUS_COLORS[appt.status] || 'primary.main',
                                            opacity: appt.status === 'cancelled' ? 0.5 : 1,
                                        }}
                                    >
                                        {formatTime(appt.startTime)} {patientName(appt.patientId)}
                                    </Box>
                                ))}
                                {items.length > MAX_PER_DAY_CELL && (
                                    <Typography variant="caption" color="text.secondary">
                                        {t('appointments.more', { count: items.length - MAX_PER_DAY_CELL })}
                                    </Typography>
                                )}
                            </Box>
                        );
                    })}
                </Box>
            </Paper>
        );
    };

    const dayItems = byDay.get(selectedDay) || [];

    const renderRows = (items: Appointment[], showDate: boolean) => (
        <TableContainer>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>{showDate ? t('appointments.date') : t('appointments.time')}</TableCell>
                        <TableCell>{t('appointments.patient')}</TableCell>
                        <TableCell>{t('appointments.dentist')}</TableCell>
                        <TableCell>{t('appointments.visitFor')}</TableCell>
                        <TableCell>{t('common.status')}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {items.map((appt) => (
                        <TableRow key={appt._id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/appointments/${appt._id}`)}>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                {showDate && `${formatDate(appt.startTime)} `}
                                {formatTime(appt.startTime)}–{formatTime(appt.endTime)}
                            </TableCell>
                            <TableCell>{patientName(appt.patientId)}</TableCell>
                            <TableCell>{staffName(appt.dentistId)}</TableCell>
                            <TableCell sx={{ maxWidth: 260, overflowWrap: 'anywhere' }}>{appointmentLabel(appt)}</TableCell>
                            <TableCell>
                                <StatusChip status={appt.status} label={t(statusKey(appt.status))} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );

    return (
        <Box>
            <PageHeader
                title={t('appointments.title')}
                actionLabel={canBook ? t('appointments.newAppointment') : undefined}
                onAction={
                    canBook
                        ? () => {
                              const day = timeGrid ? toLocalDateString(focus) : selectedDay;
                              setBookingDate(day >= today ? day : today);
                          }
                        : undefined
                }
                actionIcon={<AddIcon />}
            />

            <Paper sx={{ p: 2, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <IconButton size="small" onClick={() => shift(-1)} aria-label={t('common.previous')}>
                        <ChevronLeftIcon />
                    </IconButton>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ minWidth: 160, textAlign: 'center', textTransform: 'capitalize' }}>
                        {monthTitle}
                    </Typography>
                    <IconButton size="small" onClick={() => shift(1)} aria-label={t('common.next')}>
                        <ChevronRightIcon />
                    </IconButton>
                    <Button size="small" startIcon={<TodayIcon />} onClick={goToday}>
                        {t('appointments.today')}
                    </Button>
                </Box>
                <TextField
                    select
                    size="small"
                    label={t('common.status')}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AppointmentStatus | 'all')}
                    sx={{ minWidth: 160 }}
                >
                    <MenuItem value="all">{t('common.all')}</MenuItem>
                    {APPOINTMENT_STATUSES.map((s) => (
                        <MenuItem key={s} value={s}>
                            {t(statusKey(s))}
                        </MenuItem>
                    ))}
                </TextField>
                {timeGrid ? (
                    <>
                        <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, m) => m && setMode(m)}>
                            <ToggleButton value="dentist">{t('appointments.byDentist')}</ToggleButton>
                            <ToggleButton value="room">{t('appointments.byRoom')}</ToggleButton>
                        </ToggleButtonGroup>
                        <TextField
                            select
                            size="small"
                            label={mode === 'dentist' ? t('appointments.dentist') : t('appointments.room')}
                            value={gridResource}
                            onChange={(e) => setResourceId(e.target.value)}
                            sx={{ minWidth: 180 }}
                        >
                            {view === 'day' && <MenuItem value="all">{t('common.all')}</MenuItem>}
                            {columnOptions.map((o) => (
                                <MenuItem key={o.id} value={o.id}>
                                    {o.name}
                                </MenuItem>
                            ))}
                        </TextField>
                    </>
                ) : (
                    <TextField
                        select
                        size="small"
                        label={t('appointments.dentist')}
                        value={dentistId}
                        onChange={(e) => setDentistId(e.target.value)}
                        sx={{ minWidth: 180 }}
                    >
                        <MenuItem value="all">{t('common.all')}</MenuItem>
                        {dentists.map((d) => (
                            <MenuItem key={d._id} value={staffRefId(d)}>
                                {staffName(d)}
                            </MenuItem>
                        ))}
                    </TextField>
                )}
                <Box sx={{ flexGrow: 1 }} />
                <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
                    <ToggleButton value="day" aria-label={t('appointments.dayView')}>
                        <Tooltip title={t('appointments.dayView')}>
                            <DayIcon fontSize="small" />
                        </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="week" aria-label={t('appointments.weekView')}>
                        <Tooltip title={t('appointments.weekView')}>
                            <WeekIcon fontSize="small" />
                        </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="month" aria-label={t('appointments.monthView')}>
                        <Tooltip title={t('appointments.monthView')}>
                            <CalendarIcon fontSize="small" />
                        </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="list" aria-label={t('appointments.list')}>
                        <Tooltip title={t('appointments.list')}>
                            <ListIcon fontSize="small" />
                        </Tooltip>
                    </ToggleButton>
                </ToggleButtonGroup>
            </Paper>

            {timeGrid ? (
                <ScheduleView
                    view={view as 'day' | 'week'}
                    date={focus}
                    mode={mode}
                    appointments={calendar}
                    dentists={dentists}
                    rooms={rooms}
                    resourceId={gridResource}
                    workingHours={workingHours}
                    canEdit={canBook}
                    onMove={setMove}
                    onSelectSlot={setSlot}
                />
            ) : view === 'month' ? (
                <>
                    {calendarLoading && !calendar.length ? <LoadingSpinner /> : renderCalendar()}
                    <Paper sx={{ mt: 2 }}>
                        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant="subtitle1" fontWeight={600}>
                                {formatDate(selectedDay)} · {t('appointments.countForDay', { count: dayItems.length })}
                            </Typography>
                            {canBook && selectedDay >= today && (
                                <Button size="small" startIcon={<AddIcon />} onClick={() => setBookingDate(selectedDay)}>
                                    {t('appointments.bookThisDay')}
                                </Button>
                            )}
                        </Box>
                        {dayItems.length ? renderRows(dayItems, false) : <EmptyState title={t('appointments.noAppointmentsDay')} />}
                    </Paper>
                </>
            ) : (
                <Paper>
                    {listLoading && !list.length ? (
                        <LoadingSpinner />
                    ) : list.length ? (
                        renderRows(list, true)
                    ) : (
                        <EmptyState title={t('appointments.noAppointmentsMonth')} />
                    )}
                    <TablePagination
                        component="div"
                        count={total}
                        page={page}
                        onPageChange={(_, p) => setPage(p)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(e) => {
                            setRowsPerPage(parseInt(e.target.value, 10));
                            setPage(0);
                        }}
                        rowsPerPageOptions={[10, 20, 50, 100]}
                        labelRowsPerPage={t('common.rowsPerPage')}
                    />
                </Paper>
            )}

            <AppointmentFormDialog
                open={!!bookingDate}
                defaultDate={bookingDate || undefined}
                onClose={() => setBookingDate(null)}
            />
            {/* A slot picked on the day / week grid. */}
            <AppointmentFormDialog
                open={!!slot}
                defaultDate={slot ? toLocalDateString(slot.start) : undefined}
                defaultStartTime={slot ? formatTime(slot.start) : undefined}
                defaultDuration={slot ? Math.max(5, Math.round((slot.end.getTime() - slot.start.getTime()) / 60000)) : undefined}
                defaultDentistId={slot?.dentistId}
                defaultRoomId={slot?.roomId}
                onClose={() => setSlot(null)}
            />
            <MoveAppointmentDialog move={move} dentists={dentists} rooms={rooms} onClose={() => setMove(null)} />
        </Box>
    );
};

export default AppointmentsPage;
