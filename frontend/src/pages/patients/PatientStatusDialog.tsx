import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Checkbox, FormControlLabel, TextField, Typography } from '@mui/material';
import api from '../../api/axios';
import { ConfirmDialog } from '../../components/ui';
import { patientsActions } from '../../store/patients';
import { PatientStatus } from '../../types';

interface PatientStatusDialogProps {
    /** Patient to change; the dialog is open while this and `status` are set. */
    patientId: string | null;
    patientName: string;
    status: PatientStatus | null;
    onClose: () => void;
}

/** Leaving the clinic for good: booked appointments should normally go too. */
const CANCEL_BY_DEFAULT: PatientStatus[] = ['archived', 'deceased'];

/**
 * Confirm a patient status change, with an optional reason for the audit
 * trail. When the patient is leaving, shows how many appointments are still
 * booked and offers to cancel them — they used to stay in the calendar.
 */
const PatientStatusDialog: React.FC<PatientStatusDialogProps> = ({ patientId, patientName, status, onClose }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [reason, setReason] = useState('');
    const [upcoming, setUpcoming] = useState<number | null>(null);
    const [cancelUpcoming, setCancelUpcoming] = useState(false);

    const open = !!patientId && !!status;
    const leaving = !!status && status !== 'active';

    useEffect(() => {
        setReason('');
        setUpcoming(null);
        setCancelUpcoming(!!status && CANCEL_BY_DEFAULT.includes(status));
        if (!open || !leaving) return;

        let cancelled = false;
        api.get(`/patients/${patientId}/upcoming-appointments`)
            .then((res) => !cancelled && setUpcoming(res.data?.data?.count ?? 0))
            .catch(() => !cancelled && setUpcoming(null));
        return () => {
            cancelled = true;
        };
    }, [open, leaving, patientId, status]);

    const confirm = () => {
        if (!patientId || !status) return;
        dispatch(
            patientsActions.updatePatientStatus({
                id: patientId,
                status,
                reason: reason.trim() || undefined,
                cancelUpcomingAppointments: leaving && !!upcoming && cancelUpcoming,
            }),
        );
        onClose();
    };

    return (
        <ConfirmDialog
            open={open}
            title={t('patients.changeStatus')}
            message={status ? t('patients.confirmStatusChangeFor', { name: patientName, status: t(`patients.${status}`) }) : ''}
            variant={status === 'active' ? 'default' : 'danger'}
            onConfirm={confirm}
            onCancel={onClose}
        >
            {leaving && !!upcoming && (
                <>
                    <Typography variant="body2" sx={{ mt: 2 }}>
                        {t('patients.upcomingAppointments', { count: upcoming })}
                    </Typography>
                    <FormControlLabel
                        control={<Checkbox checked={cancelUpcoming} onChange={(e) => setCancelUpcoming(e.target.checked)} />}
                        label={t('patients.cancelUpcomingAppointments')}
                    />
                </>
            )}
            <TextField
                fullWidth
                size="small"
                label={t('patients.statusReason')}
                placeholder={t('patients.statusReasonHint')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                multiline
                rows={2}
                sx={{ mt: 2 }}
            />
        </ConfirmDialog>
    );
};

export default PatientStatusDialog;
