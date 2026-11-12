import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    Stack,
    Switch,
    TextField,
    Typography,
} from '@mui/material';
import { ContentCopy as CopyIcon, Telegram as TelegramIcon, Sms as SmsIcon, LinkOff as UnlinkIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { usePermission } from '../../hooks';
import { PatientReminderStatus } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import { formatDate } from '../../utils/formatters';

const unwrap = (res: { data: any }) => res.data?.data ?? res.data;

/** On the patient profile: how this patient gets reminders, and linking their Telegram. */
const PatientRemindersCard: React.FC<{ patientId: string }> = ({ patientId }) => {
    const { t } = useTranslation();
    const can = usePermission();
    const editor = can('editPatients');
    const [status, setStatus] = useState<PatientReminderStatus | null>(null);
    const [link, setLink] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        api.get(`/reminders/patients/${patientId}`)
            .then((res) => setStatus(unwrap(res)))
            .catch(() => setStatus(null));
    }, [patientId]);

    useEffect(load, [load]);

    const run = async (request: () => Promise<any>, onDone?: (data: any) => void) => {
        setBusy(true);
        setError(null);
        try {
            const data = unwrap(await request());
            onDone?.(data);
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    if (!status) return null;

    const channel = status.optOut
        ? t('reminders.patient.off')
        : status.telegramLinked
          ? 'Telegram'
          : status.smsAvailable
            ? 'SMS'
            : t('reminders.patient.noChannel');

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                    {t('reminders.patient.title')}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {!status.enabled && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        {t('reminders.patient.clinicOff')}
                    </Alert>
                )}
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        {t('reminders.patient.channel')}:
                    </Typography>
                    <Chip size="small" label={channel} color={status.optOut ? 'default' : 'primary'} variant="outlined" />
                    {status.telegramLinked && status.telegramLinkedAt && (
                        <Typography variant="caption" color="text.secondary">
                            {t('reminders.patient.linkedOn', { date: formatDate(status.telegramLinkedAt) })}
                        </Typography>
                    )}
                </Stack>

                {editor && (
                    <Stack spacing={1.5}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={!status.optOut}
                                    disabled={busy}
                                    onChange={(e) =>
                                        run(() => api.patch(`/reminders/patients/${patientId}`, { optOut: !e.target.checked }), setStatus)
                                    }
                                />
                            }
                            label={t('reminders.patient.receive')}
                        />
                        {status.telegramAvailable && !status.telegramLinked && (
                            <Box>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<TelegramIcon />}
                                    disabled={busy}
                                    onClick={() =>
                                        run(() => api.post(`/reminders/patients/${patientId}/telegram-link`), (data) => setLink(data.link))
                                    }
                                >
                                    {t('reminders.patient.linkTelegram')}
                                </Button>
                            </Box>
                        )}
                        {status.telegramLinked && (
                            <Box>
                                <Button
                                    size="small"
                                    color="inherit"
                                    startIcon={<UnlinkIcon />}
                                    disabled={busy}
                                    onClick={() => run(() => api.delete(`/reminders/patients/${patientId}/telegram`), setStatus)}
                                >
                                    {t('reminders.patient.unlink')}
                                </Button>
                            </Box>
                        )}
                        {!status.telegramAvailable && (
                            <Typography variant="caption" color="text.secondary">
                                {t('reminders.patient.noBot')}
                            </Typography>
                        )}
                    </Stack>
                )}
            </CardContent>

            <Dialog open={!!link} onClose={() => { setLink(null); load(); }} maxWidth="sm" fullWidth>
                <DialogTitle>{t('reminders.patient.linkTitle')}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t('reminders.patient.linkHelp')}
                    </Typography>
                    <TextField fullWidth size="small" value={link ?? ''} InputProps={{ readOnly: true }} onFocus={(e) => e.target.select()} />
                    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                </DialogContent>
                <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
                    <Button
                        startIcon={<CopyIcon />}
                        onClick={() =>
                            navigator.clipboard
                                ?.writeText(link ?? '')
                                .then(() => toast.success(t('reminders.patient.copied')))
                                .catch(() => undefined)
                        }
                    >
                        {t('reminders.patient.copy')}
                    </Button>
                    {status.smsAvailable && (
                        <Button
                            startIcon={<SmsIcon />}
                            disabled={busy}
                            onClick={() =>
                                run(
                                    () => api.post(`/reminders/patients/${patientId}/telegram-link/sms`),
                                    (data) => toast.success(t('reminders.patient.smsSent', { to: data.to })),
                                )
                            }
                        >
                            {t('reminders.patient.sendBySms')}
                        </Button>
                    )}
                    <Button variant="contained" onClick={() => { setLink(null); load(); }}>
                        {t('common.close')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Card>
    );
};

export default PatientRemindersCard;
