import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    MenuItem,
    Radio,
    RadioGroup,
    Stack,
    TextField,
} from '@mui/material';
import { appointmentsActions } from '../../store/appointments';
import { Appointment } from '../../types';
import { CANCEL_REASONS } from '../../utils/appointments';

interface CancelAppointmentDialogProps {
    appointment: Appointment | null;
    onClose: () => void;
}

/** Cancel with a structured reason (for reports and the patient's history) and an optional note. */
const CancelAppointmentDialog: React.FC<CancelAppointmentDialogProps> = ({ appointment, onClose }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [reason, setReason] = useState<string>('');
    const [note, setNote] = useState('');
    const [scope, setScope] = useState<'this' | 'following'>('this');

    useEffect(() => {
        setReason('');
        setNote('');
        setScope('this');
    }, [appointment]);

    const confirm = () => {
        if (!appointment || !reason) return;
        dispatch(
            appointmentsActions.cancelAppointment({
                id: appointment._id,
                reason,
                note: note.trim() || undefined,
                scope: appointment.isRecurring ? scope : undefined,
            }),
        );
        onClose();
    };

    return (
        <Dialog open={!!appointment} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{t('appointments.cancelAppointment')}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        select
                        required
                        fullWidth
                        label={t('appointments.cancelReason')}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                    >
                        {CANCEL_REASONS.map((r) => (
                            <MenuItem key={r} value={r}>
                                {t(`appointments.cancelReasons.${r}`)}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        fullWidth
                        multiline
                        rows={2}
                        label={t('appointments.cancelNote')}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        inputProps={{ maxLength: 500 }}
                    />
                    {appointment?.isRecurring && (
                        <RadioGroup value={scope} onChange={(e) => setScope(e.target.value as 'this' | 'following')}>
                            <FormControlLabel value="this" control={<Radio />} label={t('appointments.cancelThisOnly')} />
                            <FormControlLabel value="following" control={<Radio />} label={t('appointments.cancelFollowing')} />
                        </RadioGroup>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} color="inherit">
                    {t('common.back')}
                </Button>
                <Button variant="contained" color="error" onClick={confirm} disabled={!reason}>
                    {t('appointments.cancelAppointment')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CancelAppointmentDialog;
