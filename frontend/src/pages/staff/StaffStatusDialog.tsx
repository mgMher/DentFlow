import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Checkbox, FormControlLabel, Typography } from '@mui/material';
import api from '../../api/axios';
import { ConfirmDialog } from '../../components/ui';
import { staffActions } from '../../store/staff';
import { getFullName } from '../../utils/formatters';

interface StaffStatusDialogProps {
    /** Member to change; the dialog is open while this is set. */
    member: { _id: string; firstName: string; lastName: string; role?: string } | null;
    /** Target state: true = activate, false = deactivate. */
    isActive: boolean;
    onClose: () => void;
}

/**
 * Confirm activating or deactivating a staff member. Deactivating a dentist
 * shows their booked upcoming appointments and offers to cancel them, instead
 * of leaving patients booked with someone who no longer works here.
 */
const StaffStatusDialog: React.FC<StaffStatusDialogProps> = ({ member, isActive, onClose }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [upcoming, setUpcoming] = useState<number | null>(null);
    const [cancelUpcoming, setCancelUpcoming] = useState(false);

    const memberId = member?._id;
    const checkAppointments = !!memberId && !isActive && member?.role === 'dentist';

    useEffect(() => {
        setUpcoming(null);
        setCancelUpcoming(false);
        if (!checkAppointments) return;

        let cancelled = false;
        api.get(`/users/${memberId}/upcoming-appointments`)
            .then((res) => !cancelled && setUpcoming(res.data?.data?.count ?? 0))
            .catch(() => !cancelled && setUpcoming(null));
        return () => {
            cancelled = true;
        };
    }, [checkAppointments, memberId]);

    const confirm = () => {
        if (!member) return;
        dispatch(
            staffActions.updateStaffStatus({
                id: member._id,
                isActive,
                cancelUpcomingAppointments: !isActive && !!upcoming && cancelUpcoming,
            }),
        );
        onClose();
    };

    return (
        <ConfirmDialog
            open={!!member}
            title={t('staff.changeStatus')}
            message={
                member
                    ? t('staff.confirmStatusChange', {
                          name: getFullName(member.firstName, member.lastName),
                          status: isActive ? t('common.active') : t('common.inactive'),
                      })
                    : ''
            }
            variant={isActive ? 'default' : 'danger'}
            onConfirm={confirm}
            onCancel={onClose}
        >
            {checkAppointments && !!upcoming && (
                <>
                    <Typography variant="body2" sx={{ mt: 2 }}>
                        {t('staff.upcomingAppointments', { count: upcoming })}
                    </Typography>
                    <FormControlLabel
                        control={<Checkbox checked={cancelUpcoming} onChange={(e) => setCancelUpcoming(e.target.checked)} />}
                        label={t('staff.cancelUpcomingAppointments')}
                    />
                </>
            )}
        </ConfirmDialog>
    );
};

export default StaffStatusDialog;
