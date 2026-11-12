import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import { Calendar, dateFnsLocalizer, SlotInfo, View } from 'react-big-calendar';
import withDragAndDrop, { EventInteractionArgs } from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { addDays, format, getDay, parse, startOfWeek } from 'date-fns';
import api from '../../api/axios';
import { Appointment, BlockedTime, TreatmentRoom, UserProfile, WorkingHour } from '../../types';
import { localeMap } from '../../utils/formatters';
import { patientName, staffName } from '../../utils/references';
import { staffRefId } from '../../utils/staff';
import { APPOINTMENT_STATUS_COLORS } from '../../utils/constants';
import { appointmentLabel, statusKey } from '../../utils/appointments';
import { toLocalDateString } from '../../utils/dates';

export type ScheduleMode = 'dentist' | 'room';

export interface ScheduleEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    resourceId: string;
    appointment?: Appointment;
    blocked?: BlockedTime;
}

export interface ScheduleMove {
    appointment: Appointment;
    start: Date;
    end: Date;
    /** Set when the drop landed in another column. */
    dentistId?: string;
    /** `null`: dropped in the "no chair" column. */
    treatmentRoomId?: string | null;
}

export interface ScheduleSlot {
    start: Date;
    end: Date;
    dentistId?: string;
    roomId?: string;
}

interface ScheduleViewProps {
    view: 'day' | 'week';
    date: Date;
    mode: ScheduleMode;
    appointments: Appointment[];
    dentists: UserProfile[];
    rooms: TreatmentRoom[];
    /** Column(s) to show: one id, or every dentist / chair. Week view always shows one. */
    resourceId: string | 'all';
    workingHours: WorkingHour[];
    canEdit: boolean;
    onMove: (move: ScheduleMove) => void;
    onSelectSlot: (slot: ScheduleSlot) => void;
}

const NO_ROOM = '__none';
const EDITABLE = ['scheduled', 'confirmed'];
const DnDCalendar = withDragAndDrop<ScheduleEvent, { id: string; title: string }>(Calendar);

const ref = (value: unknown): string =>
    value && typeof value === 'object' ? (value as { _id: string })._id : (value as string) || '';

/** `HH:mm` to minutes after midnight. */
const minutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

/**
 * Day and week time grid (F2). The day view puts every dentist — or every
 * chair — in its own column; the week view shows one. Appointments can be
 * dragged to another time or column and resized; the page confirms each move.
 * Clicking or dragging over free time books it. Blocked time is shaded, and so
 * are the clinic's closed hours.
 */
const ScheduleView: React.FC<ScheduleViewProps> = ({
    view,
    date,
    mode,
    appointments,
    dentists,
    rooms,
    resourceId,
    workingHours,
    canEdit,
    onMove,
    onSelectSlot,
}) => {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const navigate = useNavigate();
    const [blocked, setBlocked] = useState<BlockedTime[]>([]);

    const localizer = useMemo(
        () =>
            dateFnsLocalizer({
                format,
                parse,
                startOfWeek: (d: Date) => startOfWeek(d, { weekStartsOn: 1 }),
                getDay,
                locales: localeMap,
            }),
        [],
    );

    // The visible range, for blocked times (the page loads the appointments).
    const range = useMemo(() => {
        const from = view === 'week' ? startOfWeek(date, { weekStartsOn: 1 }) : date;
        return { from: toLocalDateString(from), to: toLocalDateString(view === 'week' ? addDays(from, 6) : from) };
    }, [view, date]);

    useEffect(() => {
        if (mode !== 'dentist') {
            setBlocked([]);
            return;
        }
        let cancelled = false;
        api.get('/schedule/blocked-times', { params: { startDate: range.from, endDate: range.to } })
            .then((res) => !cancelled && setBlocked(res.data?.data ?? []))
            .catch(() => !cancelled && setBlocked([]));
        return () => {
            cancelled = true;
        };
    }, [mode, range.from, range.to]);

    const activeRooms = useMemo(() => rooms.filter((r) => r.isActive !== false), [rooms]);

    const allResources = useMemo(
        () =>
            mode === 'dentist'
                ? dentists.map((d) => ({ id: staffRefId(d), title: staffName(d) }))
                : [...activeRooms.map((r) => ({ id: r._id, title: r.name })), { id: NO_ROOM, title: t('appointments.noRoom') }],
        [mode, dentists, activeRooms, t],
    );
    const resources = resourceId === 'all' ? allResources : allResources.filter((r) => r.id === resourceId);

    const resourceOf = (a: Appointment) =>
        mode === 'dentist' ? ref(a.dentistId) : ref(a.treatmentRoomId) || NO_ROOM;

    const events: ScheduleEvent[] = useMemo(
        () =>
            appointments
                .filter((a) => a.status !== 'cancelled')
                .map((a) => ({
                    id: a._id,
                    title: patientName(a.patientId),
                    start: new Date(a.startTime),
                    end: new Date(a.endTime),
                    resourceId: resourceOf(a),
                    appointment: a,
                }))
                .filter((e) => resources.some((r) => r.id === e.resourceId)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [appointments, mode, resources.map((r) => r.id).join()],
    );

    const background: ScheduleEvent[] = useMemo(
        () =>
            blocked
                .map((b) => ({
                    id: b._id,
                    title: b.title || t(`schedule.${b.reason}`),
                    start: new Date(b.startTime),
                    end: new Date(b.endTime),
                    resourceId: ref(b.dentistId),
                    blocked: b,
                }))
                .filter((e) => resources.some((r) => r.id === e.resourceId)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [blocked, t, resources.map((r) => r.id).join()],
    );

    // Grid from an hour before the earliest opening to an hour after the latest closing.
    const { min, max } = useMemo(() => {
        const open = workingHours.filter((h) => h.isOpen !== false && h.endTime > h.startTime);
        const from = open.length ? Math.max(0, Math.min(...open.map((h) => minutes(h.startTime))) - 60) : 8 * 60;
        const to = open.length ? Math.min(24 * 60 - 1, Math.max(...open.map((h) => minutes(h.endTime))) + 60) : 20 * 60;
        const at = (m: number) => new Date(1970, 0, 1, Math.floor(m / 60), m % 60);
        return { min: at(from), max: at(to) };
    }, [workingHours]);

    const closed = (slot: Date) => {
        if (!workingHours.length) return false;
        const day = workingHours.find((h) => h.dayOfWeek === slot.getDay());
        if (!day || day.isOpen === false) return true;
        const m = slot.getHours() * 60 + slot.getMinutes();
        return m < minutes(day.startTime) || m >= minutes(day.endTime);
    };

    const editable = (e: ScheduleEvent) => canEdit && !!e.appointment && EDITABLE.includes(e.appointment.status);

    const move = ({ event, start, end, resourceId: target }: EventInteractionArgs<ScheduleEvent>) => {
        if (!event.appointment) return;
        const column = target !== undefined && String(target) !== event.resourceId ? String(target) : undefined;
        onMove({
            appointment: event.appointment,
            start: new Date(start),
            end: new Date(end),
            ...(column && mode === 'dentist' ? { dentistId: column } : {}),
            ...(column && mode === 'room' ? { treatmentRoomId: column === NO_ROOM ? null : column } : {}),
        });
    };

    const select = (slot: SlotInfo) => {
        if (!canEdit || slot.start < new Date()) return;
        const column = slot.resourceId !== undefined ? String(slot.resourceId) : resources.length === 1 ? resources[0].id : undefined;
        // A click is one 15-minute cell: book the default 30 minutes from there.
        const end = slot.action === 'click' ? new Date(slot.start.getTime() + 30 * 60_000) : slot.end;
        onSelectSlot({
            start: slot.start,
            end,
            ...(column && mode === 'dentist' ? { dentistId: column } : {}),
            ...(column && mode === 'room' && column !== NO_ROOM ? { roomId: column } : {}),
        });
    };

    const EventBody: React.FC<{ event: ScheduleEvent }> = ({ event }) => {
        if (event.blocked) {
            return <Typography variant="caption" sx={{ fontStyle: 'italic' }}>{event.title}</Typography>;
        }
        const a = event.appointment!;
        return (
            <Box sx={{ lineHeight: 1.2 }}>
                <Typography variant="caption" fontWeight={700} component="div" noWrap>
                    {format(event.start, 'HH:mm')} {event.title}
                </Typography>
                <Typography variant="caption" component="div" noWrap sx={{ opacity: 0.9 }}>
                    {appointmentLabel(a)}
                </Typography>
                <Typography variant="caption" component="div" noWrap sx={{ opacity: 0.8 }}>
                    {mode === 'dentist' ? (a.treatmentRoomId && typeof a.treatmentRoomId === 'object' ? a.treatmentRoomId.name : '') : staffName(a.dentistId)}
                </Typography>
            </Box>
        );
    };

    const divider = theme.palette.divider;

    return (
        <Box
            sx={{
                height: { xs: 640, md: 'calc(100vh - 280px)' },
                minHeight: 520,
                '& .rbc-calendar': { fontFamily: theme.typography.fontFamily, color: 'text.primary' },
                '& .rbc-time-view, & .rbc-time-header-content, & .rbc-time-content, & .rbc-timeslot-group, & .rbc-day-slot .rbc-time-slot, & .rbc-header, & .rbc-time-header.rbc-overflowing, & .rbc-time-content > * + * > *':
                    { borderColor: divider },
                '& .rbc-time-view': { borderRadius: 1, backgroundColor: 'background.paper' },
                '& .rbc-header': { py: 0.75, fontWeight: 600 },
                // 16px per 15 minutes: a 30-minute visit shows its name and treatment.
                '& .rbc-timeslot-group': { minHeight: 64 },
                '& .rbc-time-content': { overflowY: 'auto' },
                '& .rbc-today': { backgroundColor: alpha(theme.palette.primary.main, 0.05) },
                '& .rbc-current-time-indicator': { backgroundColor: theme.palette.error.main, height: 2 },
                '& .rbc-label': { color: 'text.secondary', fontSize: 12 },
                '& .rbc-event': { border: 'none', p: '2px 4px' },
                '& .rbc-background-event': {
                    backgroundColor: alpha(theme.palette.text.primary, 0.08),
                    border: `1px dashed ${alpha(theme.palette.text.primary, 0.3)}`,
                    color: 'text.secondary',
                    opacity: 1,
                },
                '& .rbc-allday-cell': { display: 'none' },
                // Day view: the column is the dentist / chair; the date is in the page title.
                ...(view === 'day' ? { '& .rbc-time-view-resources .rbc-time-header-cell': { display: 'none' } } : {}),
                '& .rbc-time-header-gutter, & .rbc-time-gutter': { minWidth: 52 },
                '& .rbc-slot-selection': { backgroundColor: alpha(theme.palette.primary.main, 0.25), color: 'primary.contrastText' },
            }}
        >
            <DnDCalendar
                localizer={localizer}
                culture={i18n.language === 'en' ? 'en' : i18n.language}
                view={view as View}
                views={['day', 'week']}
                date={date}
                onNavigate={() => undefined}
                onView={() => undefined}
                toolbar={false}
                events={events}
                backgroundEvents={background}
                resources={view === 'day' ? resources : undefined}
                resourceIdAccessor="id"
                resourceTitleAccessor="title"
                step={15}
                timeslots={4}
                min={min}
                max={max}
                scrollToTime={min}
                selectable={canEdit}
                onSelectSlot={select}
                onSelectEvent={(e) => e.appointment && navigate(`/appointments/${e.id}`)}
                draggableAccessor={editable}
                resizableAccessor={editable}
                onEventDrop={move}
                onEventResize={move}
                tooltipAccessor={(e) =>
                    e.appointment
                        ? `${format(e.start, 'HH:mm')}–${format(e.end, 'HH:mm')} ${e.title} · ${staffName(e.appointment.dentistId)} · ${t(statusKey(e.appointment.status))}`
                        : e.title
                }
                eventPropGetter={(e) => {
                    if (e.blocked) return {};
                    const color = APPOINTMENT_STATUS_COLORS[e.appointment?.status ?? 'scheduled'] ?? theme.palette.primary.main;
                    return { style: { backgroundColor: color, color: '#fff', cursor: editable(e) ? 'move' : 'pointer' } };
                }}
                slotPropGetter={(slot) =>
                    closed(slot) ? { style: { backgroundColor: alpha(theme.palette.text.primary, 0.04) } } : {}
                }
                formats={{
                    timeGutterFormat: 'HH:mm',
                    eventTimeRangeFormat: () => '',
                    selectRangeFormat: ({ start, end }) => `${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`,
                    dayFormat: (d, culture, loc) => loc!.format(d, 'EEE d', culture),
                }}
                components={{ event: EventBody }}
                messages={{ noEventsInRange: t('appointments.noAppointmentsDay') }}
            />
        </Box>
    );
};

export default ScheduleView;
