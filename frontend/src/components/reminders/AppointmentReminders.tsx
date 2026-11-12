import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Divider, Stack, Typography } from '@mui/material';
import api from '../../api/axios';
import { ReminderLogEntry } from '../../types';
import { formatDateTime } from '../../utils/formatters';
import ReminderLogChip from './ReminderLogChip';

/** Reminders sent for one appointment (shown on the appointment page). */
const AppointmentReminders: React.FC<{ appointmentId: string }> = ({ appointmentId }) => {
    const { t, i18n } = useTranslation();
    const [entries, setEntries] = useState<ReminderLogEntry[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        api.get(`/reminders/appointments/${appointmentId}`)
            .then((res) => !cancelled && setEntries(res.data?.data ?? []))
            .catch(() => !cancelled && setEntries(null));
        return () => {
            cancelled = true;
        };
    }, [appointmentId]);

    if (!entries) return null;
    return (
        <Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
                {t('reminders.title')}
            </Typography>
            {!entries.length ? (
                <Typography variant="body2" color="text.secondary">
                    {t('reminders.noneYet')}
                </Typography>
            ) : (
                <Stack spacing={1.5}>
                    {entries.map((e) => (
                        <Box key={e._id}>
                            <Typography variant="caption" color="text.secondary" component="div">
                                {t(`reminders.rules.${e.rule}`)} · {formatDateTime(e.createdAt, i18n.language)}
                            </Typography>
                            <ReminderLogChip entry={e} />
                        </Box>
                    ))}
                </Stack>
            )}
        </Box>
    );
};

export default AppointmentReminders;
