import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { ArrowForward as ArrowIcon } from '@mui/icons-material';
import { appointmentsActions } from '../../store/appointments';
import { useHttpState } from '../../hooks';
import { TreatmentRoom, UserProfile } from '../../types';
import { formatDate, formatTime } from '../../utils/formatters';
import { patientName, staffName } from '../../utils/references';
import { staffRefId } from '../../utils/staff';
import { ScheduleMove } from './ScheduleView';

interface MoveAppointmentDialogProps {
    move: ScheduleMove | null;
    dentists: UserProfile[];
    rooms: TreatmentRoom[];
    onClose: () => void;
}

const when = (start: Date | string, end: Date | string, language: string) =>
    `${formatDate(start, 'EEE dd.MM', language)} ${formatTime(start)}–${formatTime(end)}`;

/** Confirms a drag on the calendar before the appointment is moved. */
const MoveAppointmentDialog: React.FC<MoveAppointmentDialogProps> = ({ move, dentists, rooms, onClose }) => {
    const { t, i18n } = useTranslation();
    const dispatch = useDispatch();
    const update = useHttpState('UPDATE_APPOINTMENT');

    useEffect(() => {
        if (move) update.clearError();
    }, [move]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!update.success || !move) return;
        update.clearSuccess();
        onClose();
    }, [update.success]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!move) return null;
    const { appointment: a } = move;
    const newDentist = move.dentistId ? dentists.find((d) => staffRefId(d) === move.dentistId) : null;
    const newRoom =
        move.treatmentRoomId === undefined
            ? undefined
            : move.treatmentRoomId === null
              ? t('appointments.noRoom')
              : rooms.find((r) => r._id === move.treatmentRoomId)?.name;
    const oldRoom = a.treatmentRoomId && typeof a.treatmentRoomId === 'object' ? a.treatmentRoomId.name : t('appointments.noRoom');

    const confirm = (allowOutsideHours = false) =>
        dispatch(
            appointmentsActions.updateAppointment({
                id: a._id,
                data: {
                    startTime: move.start.toISOString(),
                    endTime: move.end.toISOString(),
                    ...(move.dentistId ? { dentistId: move.dentistId } : {}),
                    ...(move.treatmentRoomId !== undefined ? { treatmentRoomId: move.treatmentRoomId } : {}),
                    ...(allowOutsideHours ? { allowOutsideHours: true } : {}),
                },
            }),
        );

    const Row: React.FC<{ label: string; from: string; to: string }> = ({ label, from, to }) => (
        <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>{from}</Typography>
                <ArrowIcon fontSize="small" color="action" />
                <Typography variant="body2" fontWeight={600}>{to}</Typography>
            </Box>
        </Box>
    );

    return (
        <Dialog open onClose={update.loading ? undefined : onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{t('appointments.moveTitle', { patient: patientName(a.patientId) })}</DialogTitle>
            <DialogContent>
                {update.error && (
                    <Alert
                        severity={update.errorCode === 'appointmentOutsideHours' ? 'warning' : 'error'}
                        sx={{ mb: 2 }}
                        action={
                            update.errorCode === 'appointmentOutsideHours' ? (
                                <Button color="inherit" size="small" onClick={() => confirm(true)}>
                                    {t('appointments.moveAnyway')}
                                </Button>
                            ) : undefined
                        }
                    >
                        {update.error}
                    </Alert>
                )}
                <Row
                    label={t('appointments.time')}
                    from={when(a.startTime, a.endTime, i18n.language)}
                    to={when(move.start, move.end, i18n.language)}
                />
                {newDentist && (
                    <Row label={t('appointments.dentist')} from={staffName(a.dentistId)} to={staffName(newDentist)} />
                )}
                {newRoom !== undefined && <Row label={t('appointments.room')} from={oldRoom} to={newRoom ?? '—'} />}
                <Typography variant="caption" color="text.secondary">{t('appointments.moveHint')}</Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit" disabled={update.loading}>{t('common.cancel')}</Button>
                <Button variant="contained" onClick={() => confirm()} disabled={update.loading}>
                    {update.loading ? t('common.loading') : t('appointments.moveConfirm')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default MoveAppointmentDialog;
