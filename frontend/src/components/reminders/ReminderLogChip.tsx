import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { ReminderLogEntry } from '../../types';

const COLORS: Record<string, 'success' | 'error' | 'default' | 'warning'> = {
    sent: 'success',
    failed: 'error',
    skipped: 'default',
    pending: 'warning',
};
const REASON_CODES = ['optedOut', 'noChannel', 'patientMissing'];

/** Status, channel and outcome of one reminder, in words. */
const ReminderLogChip: React.FC<{ entry: ReminderLogEntry }> = ({ entry }) => {
    const { t } = useTranslation();
    const reason = entry.reason && REASON_CODES.includes(entry.reason) ? t(`reminders.reasons.${entry.reason}`) : entry.reason;
    return (
        <Box>
            <Tooltip title={entry.text || ''}>
                <Chip
                    size="small"
                    color={COLORS[entry.status] ?? 'default'}
                    variant={entry.status === 'sent' ? 'filled' : 'outlined'}
                    label={`${t(`reminders.statuses.${entry.status}`)}${entry.channel ? ` · ${t(`reminders.channels.${entry.channel}`)}` : ''}`}
                />
            </Tooltip>
            {(reason || entry.answer) && (
                <Typography variant="caption" color={entry.status === 'failed' ? 'error' : 'text.secondary'} component="div" sx={{ mt: 0.5 }}>
                    {entry.answer ? t(`reminders.answers.${entry.answer}`) : reason}
                </Typography>
            )}
        </Box>
    );
};

export default ReminderLogChip;
