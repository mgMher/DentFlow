import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box,
    Typography,
    Paper,
    Grid,
    Button,
    Divider,
    Chip,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    CalendarMonth as CalendarIcon,
    AccessTime as ClockIcon,
    Person as PersonIcon,
    MedicalServices as TreatmentIcon,
    MeetingRoom as RoomIcon,
    Notes as NotesIcon,
    CheckCircle as CheckCircleIcon,
    PlayArrow as PlayIcon,
    Cancel as CancelIcon,
    PersonOff as NoShowIcon,
    EventAvailable as ConfirmIcon,
} from '@mui/icons-material';
import { RootState } from '../../store';
import { appointmentsActions } from '../../store/appointments';
import { PageHeader, StatusChip, LoadingSpinner, ConfirmDialog } from '../../components/ui';
import { formatDate, formatTime } from '../../utils/formatters';
import { Patient, UserProfile } from '../../types';
import { APPOINTMENT_STATUS_COLORS } from '../../utils/constants';

// ── Helpers ─────────────────────────────────────────────────────────────────

const getPatientName = (patient: string | Patient | null): string => {
    if (!patient) return '-';
    if (typeof patient === 'string') return patient;
    return `${patient.lastName} ${patient.firstName}`;
};

const getPatientPhone = (patient: string | Patient | null): string => {
    if (!patient || typeof patient === 'string') return '-';
    return patient.phone || '-';
};

const getPatientEmail = (patient: string | Patient | null): string => {
    if (!patient || typeof patient === 'string') return '-';
    return patient.email || '-';
};

const getDentistName = (dentist: string | UserProfile | null): string => {
    if (!dentist) return '-';
    if (typeof dentist === 'string') return dentist;
    return `${dentist.lastName} ${dentist.firstName}`;
};

// ── Status flow: which transitions are allowed ──────────────────────────────

const STATUS_TRANSITIONS: Record<string, string[]> = {
    scheduled: ['confirmed', 'cancelled', 'no_show'],
    confirmed: ['in_progress', 'cancelled', 'no_show'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
    no_show: [],
};

// ── Component ───────────────────────────────────────────────────────────────

const AppointmentDetailPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { id } = useParams<{ id: string }>();

    const appointment = useSelector((state: RootState) => state.appointments.current);
    const { loading } = useSelector((state: RootState) => state.http);

    const isLoading = loading.includes('GET_APPOINTMENT');
    const isUpdating = loading.includes('UPDATE_STATUS');

    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [confirmStatusDialog, setConfirmStatusDialog] = useState<string | null>(null);

    // ── Effects ─────────────────────────────────────────────────────────────

    useEffect(() => {
        if (id) {
            dispatch(appointmentsActions.getAppointment(id));
        }
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Handlers ────────────────────────────────────────────────────────────

    const handleStatusUpdate = (status: string) => {
        if (status === 'cancelled') {
            setCancelDialogOpen(true);
            return;
        }
        setConfirmStatusDialog(status);
    };

    const handleConfirmStatus = () => {
        if (!id || !confirmStatusDialog) return;
        dispatch(appointmentsActions.updateStatus({ id, status: confirmStatusDialog }));
        setConfirmStatusDialog(null);
    };

    const handleCancelSubmit = () => {
        if (!id) return;
        dispatch(appointmentsActions.cancelAppointment({ id, reason: cancelReason }));
        setCancelDialogOpen(false);
        setCancelReason('');
    };

    // ── Status action button config ─────────────────────────────────────────

    const getStatusButton = (status: string) => {
        const config: Record<string, { label: string; color: 'primary' | 'success' | 'error' | 'warning' | 'inherit'; icon: React.ReactNode }> = {
            confirmed: {
                label: t('appointments.confirmed'),
                color: 'success',
                icon: <ConfirmIcon />,
            },
            in_progress: {
                label: t('appointments.inProgress'),
                color: 'warning',
                icon: <PlayIcon />,
            },
            completed: {
                label: t('appointments.completed'),
                color: 'primary',
                icon: <CheckCircleIcon />,
            },
            cancelled: {
                label: t('appointments.cancelled'),
                color: 'error',
                icon: <CancelIcon />,
            },
            no_show: {
                label: t('appointments.noShow'),
                color: 'inherit',
                icon: <NoShowIcon />,
            },
        };
        return config[status] || { label: status, color: 'inherit' as const, icon: null };
    };

    // ── Info row component ──────────────────────────────────────────────────

    const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, py: 1.5 }}>
            <Box sx={{ color: 'text.secondary', mt: 0.25 }}>{icon}</Box>
            <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                    {label}
                </Typography>
                <Typography variant="body1">{value}</Typography>
            </Box>
        </Box>
    );

    // ── Render ──────────────────────────────────────────────────────────────

    if (isLoading || !appointment) {
        return <LoadingSpinner fullPage />;
    }

    const allowedTransitions = STATUS_TRANSITIONS[appointment.status] || [];

    return (
        <Box>
            {/* Back + Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <IconButton onClick={() => navigate('/appointments')} size="small">
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="body2" color="text.secondary">
                    {t('common.back')}
                </Typography>
            </Box>

            <PageHeader
                title={appointment.title || getPatientName(appointment.patientId)}
                subtitle={`${formatDate(appointment.startTime)} ${formatTime(appointment.startTime)} - ${formatTime(appointment.endTime)}`}
            >
                <StatusChip status={appointment.status} />
            </PageHeader>

            <Grid container spacing={3}>
                {/* Main info card */}
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            {t('appointments.title')}
                        </Typography>
                        <Divider sx={{ mb: 2 }} />

                        <InfoRow
                            icon={<PersonIcon />}
                            label={t('appointments.patient')}
                            value={
                                <Box>
                                    <Typography variant="body1" fontWeight={600}>
                                        {getPatientName(appointment.patientId)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {getPatientPhone(appointment.patientId)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {getPatientEmail(appointment.patientId)}
                                    </Typography>
                                </Box>
                            }
                        />

                        <Divider />

                        <InfoRow
                            icon={<PersonIcon />}
                            label={t('appointments.dentist')}
                            value={getDentistName(appointment.dentistId)}
                        />

                        <Divider />

                        <InfoRow
                            icon={<CalendarIcon />}
                            label={t('appointments.dateTime')}
                            value={`${formatDate(appointment.startTime)} | ${formatTime(appointment.startTime)} - ${formatTime(appointment.endTime)}`}
                        />

                        <Divider />

                        <InfoRow
                            icon={<ClockIcon />}
                            label={t('appointments.duration')}
                            value={`${appointment.duration} ${t('common.minutes').toLowerCase()}`}
                        />

                        {appointment.treatmentType && (
                            <>
                                <Divider />
                                <InfoRow
                                    icon={<TreatmentIcon />}
                                    label={t('appointments.treatmentType')}
                                    value={appointment.treatmentType}
                                />
                            </>
                        )}

                        {appointment.treatmentRoomId && (
                            <>
                                <Divider />
                                <InfoRow
                                    icon={<RoomIcon />}
                                    label={t('appointments.room')}
                                    value={appointment.treatmentRoomId}
                                />
                            </>
                        )}

                        {appointment.notes && (
                            <>
                                <Divider />
                                <InfoRow
                                    icon={<NotesIcon />}
                                    label={t('appointments.notes')}
                                    value={appointment.notes}
                                />
                            </>
                        )}

                        {appointment.cancelReason && (
                            <>
                                <Divider />
                                <InfoRow
                                    icon={<CancelIcon />}
                                    label={t('appointments.cancelReason')}
                                    value={appointment.cancelReason}
                                />
                            </>
                        )}
                    </Paper>
                </Grid>

                {/* Side panel: status actions + treatment details */}
                <Grid item xs={12} md={4}>
                    {/* Status actions */}
                    <Paper sx={{ p: 3, mb: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            {t('common.actions')}
                        </Typography>
                        <Divider sx={{ mb: 2 }} />

                        {allowedTransitions.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                                {t('appointments.completed') === t(`appointments.${appointment.status}`)
                                    ? t('appointments.completed')
                                    : t('appointments.cancelled')
                                }
                            </Typography>
                        ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                {allowedTransitions.map((status) => {
                                    const btn = getStatusButton(status);
                                    return (
                                        <Button
                                            key={status}
                                            variant="outlined"
                                            color={btn.color}
                                            startIcon={btn.icon}
                                            fullWidth
                                            onClick={() => handleStatusUpdate(status)}
                                            disabled={isUpdating}
                                        >
                                            {btn.label}
                                        </Button>
                                    );
                                })}
                            </Box>
                        )}
                    </Paper>

                    {/* Treatment details section */}
                    {appointment.treatmentIds && appointment.treatmentIds.length > 0 && (
                        <Paper sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom>
                                {t('treatments.title')}
                            </Typography>
                            <Divider sx={{ mb: 2 }} />

                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {appointment.treatmentIds.map((tid, idx) => (
                                    <Chip
                                        key={idx}
                                        label={tid}
                                        variant="outlined"
                                        size="small"
                                    />
                                ))}
                            </Box>
                        </Paper>
                    )}

                    {/* Appointment metadata */}
                    <Paper sx={{ p: 3, mt: 3 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            {t('common.status')}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <Box
                                sx={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    bgcolor: APPOINTMENT_STATUS_COLORS[appointment.status] || '#A0AEC0',
                                }}
                            />
                            <StatusChip status={appointment.status} />
                        </Box>

                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            {t('common.date')}
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                            {formatDate(appointment.createdAt)}
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>

            {/* Cancel dialog with reason input */}
            <Dialog
                open={cancelDialogOpen}
                onClose={() => setCancelDialogOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>{t('appointments.cancel')}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t('appointments.cancelReason')}
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder={t('appointments.cancelReason')}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setCancelDialogOpen(false)} color="inherit">
                        {t('common.close')}
                    </Button>
                    <Button
                        onClick={handleCancelSubmit}
                        variant="contained"
                        color="error"
                        disabled={!cancelReason.trim()}
                    >
                        {t('appointments.cancel')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirm status change dialog */}
            <ConfirmDialog
                open={!!confirmStatusDialog}
                title={t('common.confirm')}
                message={`${t('common.confirm')}?`}
                onConfirm={handleConfirmStatus}
                onCancel={() => setConfirmStatusDialog(null)}
            />
        </Box>
    );
};

export default AppointmentDetailPage;
