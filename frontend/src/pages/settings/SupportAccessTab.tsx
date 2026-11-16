import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import api from '../../api/axios';
import { RootState } from '../../store';
import { clinicActions } from '../../store/clinic';
import { apiErrorMessage } from '../../utils/apiError';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { hasEnded, isEnding, lastDayOf, SUPPORT_HOURS } from '../../utils/platform';

/**
 * F13: the clinic's plan and end date (set by DentFlow), and whether DentFlow
 * support may look in — read-only, for a few hours, every screen logged.
 */
const SupportAccessTab: React.FC = () => {
    const { t, i18n } = useTranslation();
    const dispatch = useDispatch();
    const clinic = useSelector((state: RootState) => state.clinic.clinic);
    const [busy, setBusy] = useState(false);
    if (!clinic) return null;

    const sub = clinic.subscription;
    const ends = sub?.expiresAt;
    const until = clinic.supportAccessUntil && new Date(clinic.supportAccessUntil) > new Date() ? clinic.supportAccessUntil : null;

    const run = (request: Promise<unknown>, message: string) => {
        setBusy(true);
        request
            .then(() => {
                toast.success(message);
                dispatch(clinicActions.getClinic());
            })
            .catch((err) => toast.error(apiErrorMessage(err)))
            .finally(() => setBusy(false));
    };

    return (
        <Stack spacing={3}>
            <Card>
                <CardContent>
                    <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>{t('subscription.title')}</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">{t('subscription.plan')}:</Typography>
                        <Typography variant="body2" fontWeight={600}>{sub?.plan || '—'}</Typography>
                        {sub?.status && <Chip size="small" label={t(`subscription.status.${sub.status}`)} color={sub.status === 'trial' ? 'info' : 'default'} />}
                    </Box>
                    <Typography variant="body2" color={hasEnded(ends) ? 'error' : isEnding(ends) ? 'warning.main' : 'text.primary'}>
                        {ends
                            ? t(hasEnded(ends) ? 'subscription.endedOn' : 'subscription.endsOn', { date: formatDate(lastDayOf(ends), 'dd.MM.yyyy', i18n.language) })
                            : t('subscription.noEnd')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>{t('subscription.about')}</Typography>
                </CardContent>
            </Card>

            <Card>
                <CardContent>
                    <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>{t('support.title')}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('support.about')}</Typography>
                    {until ? (
                        <Alert
                            severity="info"
                            action={
                                <Button color="inherit" size="small" disabled={busy} onClick={() => run(api.delete('/clinics/current/support-access'), t('support.turnedOff'))}>
                                    {t('support.turnOff')}
                                </Button>
                            }
                        >
                            {t('support.allowedUntil', { time: formatDateTime(until, i18n.language) })}
                        </Alert>
                    ) : (
                        <>
                            <Typography variant="body2" sx={{ mb: 1 }}>{t('support.off')}</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {SUPPORT_HOURS.map((hours) => (
                                    <Button
                                        key={hours}
                                        variant="outlined"
                                        size="small"
                                        disabled={busy}
                                        onClick={() => run(api.put('/clinics/current/support-access', { hours }), t('support.turnedOn'))}
                                    >
                                        {t('support.allowFor', { count: hours })}
                                    </Button>
                                ))}
                            </Box>
                        </>
                    )}
                </CardContent>
            </Card>
        </Stack>
    );
};

export default SupportAccessTab;
