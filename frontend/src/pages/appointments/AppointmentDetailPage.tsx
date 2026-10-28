import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    Alert,
    Box,
    Button,
    Chip,
    Divider,
    Grid,
    Link,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import {
    AccessTime as TimeIcon,
    ArrowBack as BackIcon,
    Cancel as CancelIcon,
    CheckCircle as CompletedIcon,
    DoNotDisturb as NoShowIcon,
    EditCalendar as RescheduleIcon,
    Event as EventIcon,
    MeetingRoom as RoomIcon,
    Notes as NotesIcon,
    Person as PersonIcon,
    PlayArrow as StartIcon,
    Repeat as RepeatIcon,
    Restore as RebookIcon,
    ThumbUp as ConfirmIcon,
    MedicalServices as DentistIcon,
} from '@mui/icons-material';
import { RootState } from '../../store';
import { appointmentsActions } from '../../store/appointments';
import { ConfirmDialog, EmptyState, LoadingSpinner, PageHeader, StatusChip } from '../../components/ui';
import AppointmentFormDialog from '../../components/appointments/AppointmentFormDialog';
import CancelAppointmentDialog from '../../components/appointments/CancelAppointmentDialog';
import { useHttpState, usePermission } from '../../hooks';
import { formatDate, formatDateTime, formatTime } from '../../utils/formatters';
import { formatArmenianPhone } from '../../utils/validators';
import { patientName, roomName, staffName } from '../../utils/references';
import {
    CANCELLABLE,
    EDITABLE,
    NEEDS_STARTED,
    STATUS_TRANSITIONS,
    appointmentLabel,
    cancelReasonLabel,
    localizedTreatmentName,
    statusKey,
} from '../../utils/appointments';
import { AppointmentStatus, Patient, Treatment } from '../../types';

const STATUS_ICONS: Partial<Record<AppointmentStatus, React.ReactNode>> = {
    scheduled: <RebookIcon />,
    confirmed: <ConfirmIcon />,
    in_progress: <StartIcon />,
    completed: <CompletedIcon />,
    no_show: <NoShowIcon />,
};

/** Wording for a status button, which differs from the status name ("Mark as no-show", "Rebook"). */
const ACTION_KEYS: Partial<Record<AppointmentStatus, string>> = {
    scheduled: 'appointments.actions.rebook',
    confirmed: 'appointments.actions.confirm',
    in_progress: 'appointments.actions.start',
    completed: 'appointments.actions.complete',
    no_show: 'appointments.actions.noShow',
};

const START_GRACE_MS = 30 * 60_000;

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, py: 1.25 }}>
        <Box sx={{ color: 'text.secondary', mt: 0.25 }}>{icon}</Box>
        <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {label}
            </Typography>
            <Box sx={{ overflowWrap: 'anywhere' }}>{children}</Box>
        </Box>
    </Box>
);

const AppointmentDetailPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { id } = useParams<{ id: string }>();
    const can = usePermission();
    const canManage = can('manageAppointments');

    const stored = useSelector((state: RootState) => state.appointments.current);
    const appointment = stored && stored._id === id ? stored : null;
    const { loading, error: loadError } = useHttpState('GET_APPOINTMENT');
    const statusChange = useHttpState('UPDATE_STATUS');

    const [pendingStatus, setPendingStatus] = useState<AppointmentStatus | null>(null);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [rescheduleOpen, setRescheduleOpen] = useState(false);

    useEffect(() => {
        if (id) dispatch(appointmentsActions.getAppointment(id));
    }, [id, dispatch]);

    if (!appointment) {
        if (loadError && !loading) {
            return (
                <Box>
                    <PageHeader title={t('appointments.title')}>
                        <Button variant="outlined" startIcon={<BackIcon />} onClick={() => navigate('/appointments')}>
                            {t('common.back')}
                        </Button>
                    </PageHeader>
                    <EmptyState title={t('appointments.notFound')} description={loadError} />
                </Box>
            );
        }
        return <LoadingSpinner fullPage />;
    }

    const patient = typeof appointment.patientId === 'object' ? (appointment.patientId as Patient) : null;
    const treatments = (appointment.treatmentIds || []).filter((x): x is Treatment => typeof x === 'object' && !!x);
    const started = new Date(appointment.startTime).getTime() <= Date.now() + START_GRACE_MS;
    const nextStatuses = STATUS_TRANSITIONS[appointment.status].filter(
        (s) => (!NEEDS_STARTED.includes(s) || started) && (s !== 'scheduled' || new Date(appointment.startTime) > new Date()),
    );

    return (
        <Box>
            <PageHeader
                title={appointmentLabel(appointment)}
                subtitle={`${formatDate(appointment.startTime)} · ${formatTime(appointment.startTime)}–${formatTime(appointment.endTime)}`}
            >
                <Button variant="outlined" startIcon={<BackIcon />} onClick={() => navigate(-1)}>
                    {t('common.back')}
                </Button>
            </PageHeader>

            {statusChange.error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={statusChange.clearError}>
                    {statusChange.error}
                </Alert>
            )}

            <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <StatusChip status={appointment.status} label={t(statusKey(appointment.status))} />
                            {appointment.isRecurring && <Chip size="small" icon={<RepeatIcon />} label={t('appointments.partOfSeries')} />}
                        </Box>
                        <Divider sx={{ mb: 1 }} />

                        <InfoRow icon={<PersonIcon />} label={t('appointments.patient')}>
                            {patient ? (
                                <>
                                    <Link component="button" variant="body1" fontWeight={600} onClick={() => navigate(`/patients/${patient._id}`)}>
                                        {patientName(patient)}
                                    </Link>
                                    <Typography variant="body2" color="text.secondary">
                                        {[patient.phone && formatArmenianPhone(patient.phone), patient.email].filter(Boolean).join(' · ')}
                                    </Typography>
                                </>
                            ) : (
                                '-'
                            )}
                        </InfoRow>
                        <InfoRow icon={<DentistIcon />} label={t('appointments.dentist')}>
                            {staffName(appointment.dentistId)}
                        </InfoRow>
                        <InfoRow icon={<EventIcon />} label={t('appointments.dateTime')}>
                            {formatDate(appointment.startTime)} · {formatTime(appointment.startTime)}–{formatTime(appointment.endTime)}
                        </InfoRow>
                        <InfoRow icon={<TimeIcon />} label={t('appointments.duration')}>
                            {t('appointments.minutes', { count: appointment.duration })}
                        </InfoRow>
                        {appointment.treatmentRoomId && (
                            <InfoRow icon={<RoomIcon />} label={t('appointments.room')}>
                                {roomName(appointment.treatmentRoomId)}
                            </InfoRow>
                        )}
                        {(treatments.length > 0 || appointment.treatmentType) && (
                            <InfoRow icon={<DentistIcon />} label={t('appointments.plannedTreatments')}>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {treatments.map((tr) => (
                                        <Chip key={tr._id} size="small" label={localizedTreatmentName(tr)} />
                                    ))}
                                    {!treatments.length && appointment.treatmentType}
                                </Box>
                            </InfoRow>
                        )}
                        {appointment.notes && (
                            <InfoRow icon={<NotesIcon />} label={t('appointments.notes')}>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                    {appointment.notes}
                                </Typography>
                            </InfoRow>
                        )}
                        {appointment.status === 'cancelled' && (
                            <InfoRow icon={<CancelIcon />} label={t('appointments.cancelReason')}>
                                <Typography variant="body2">{cancelReasonLabel(appointment.cancelReason) || '-'}</Typography>
                                {appointment.cancelNote && (
                                    <Typography variant="body2" color="text.secondary">
                                        {appointment.cancelNote}
                                    </Typography>
                                )}
                                {appointment.cancelledAt && (
                                    <Typography variant="caption" color="text.secondary">
                                        {formatDateTime(appointment.cancelledAt)}
                                        {appointment.cancelledBy && ` · ${staffName(appointment.cancelledBy)}`}
                                    </Typography>
                                )}
                            </InfoRow>
                        )}
                    </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            {t('common.actions')}
                        </Typography>
                        {!canManage || (!nextStatuses.length && !EDITABLE.includes(appointment.status)) ? (
                            <Typography variant="body2" color="text.secondary">
                                {canManage ? t('appointments.noActions') : t('appointments.viewOnly')}
                            </Typography>
                        ) : (
                            <Stack spacing={1}>
                                {nextStatuses.map((s) => (
                                    <Button
                                        key={s}
                                        variant={s === 'completed' ? 'contained' : 'outlined'}
                                        startIcon={STATUS_ICONS[s]}
                                        disabled={statusChange.loading}
                                        onClick={() => setPendingStatus(s)}
                                    >
                                        {t(ACTION_KEYS[s] || statusKey(s))}
                                    </Button>
                                ))}
                                {EDITABLE.includes(appointment.status) && (
                                    <Button variant="outlined" startIcon={<RescheduleIcon />} onClick={() => setRescheduleOpen(true)}>
                                        {t('appointments.reschedule')}
                                    </Button>
                                )}
                                {CANCELLABLE.includes(appointment.status) && (
                                    <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={() => setCancelOpen(true)}>
                                        {t('appointments.cancelAppointment')}
                                    </Button>
                                )}
                            </Stack>
                        )}
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="caption" color="text.secondary">
                            {t('appointments.createdAt')}: {formatDateTime(appointment.createdAt)}
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>

            <ConfirmDialog
                open={!!pendingStatus}
                title={t('appointments.changeStatus')}
                message={
                    pendingStatus
                        ? t('appointments.confirmStatusChange', { status: t(statusKey(pendingStatus)) })
                        : ''
                }
                variant={pendingStatus === 'no_show' ? 'danger' : 'default'}
                onConfirm={() => {
                    if (pendingStatus) dispatch(appointmentsActions.updateStatus({ id: appointment._id, status: pendingStatus }));
                    setPendingStatus(null);
                }}
                onCancel={() => setPendingStatus(null)}
            />
            <CancelAppointmentDialog appointment={cancelOpen ? appointment : null} onClose={() => setCancelOpen(false)} />
            <AppointmentFormDialog open={rescheduleOpen} appointment={appointment} onClose={() => setRescheduleOpen(false)} />
        </Box>
    );
};

export default AppointmentDetailPage;
