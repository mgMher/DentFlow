import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import {
    Alert,
    Box,
    Button,
    Chip,
    Divider,
    FormControlLabel,
    Grid,
    MenuItem,
    Paper,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { Send as SendIcon, Telegram as TelegramIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { settingsActions } from '../../store/settings';
import { PatientPicker } from '../../components/ui';
import ReminderLogChip from '../../components/reminders/ReminderLogChip';
import { ReminderLogEntry, ReminderSettings, SmsProviderName } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import { formatDateTime } from '../../utils/formatters';
import { patientName } from '../../utils/references';

type Loaded = ReminderSettings & { language: 'hy' | 'ru' | 'en'; defaultText: string; placeholders: string[] };
interface Template {
    _id: string;
    type: string;
    channel: string;
    language: string;
    bodyTemplate: string;
    isActive: boolean;
}

const unwrap = (res: { data: any }) => res.data?.data ?? res.data;

/** Settings → Reminders (F3): when, through which channels, with what text; a test; the delivery log. */
const RemindersTab: React.FC = () => {
    const { t, i18n } = useTranslation();
    const dispatch = useDispatch();
    const [settings, setSettings] = useState<Loaded | null>(null);
    const [form, setForm] = useState({
        enabled: false,
        dayBeforeEnabled: true,
        dayBeforeTime: '10:00',
        hoursBeforeEnabled: false,
        hoursBefore: 2,
        smsProvider: 'off' as SmsProviderName,
        twilioAccountSid: '',
        twilioAuthToken: '',
        twilioFrom: '',
    });
    const [botToken, setBotToken] = useState('');
    const [template, setTemplate] = useState<Template | null>(null);
    const [text, setText] = useState('');
    const [log, setLog] = useState<ReminderLogEntry[]>([]);
    const [testPatient, setTestPatient] = useState<string | null>(null);
    const [testChannel, setTestChannel] = useState<'telegram' | 'sms'>('sms');
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const apply = (s: Loaded) => {
        setSettings(s);
        setForm({
            enabled: s.enabled,
            dayBeforeEnabled: s.dayBeforeEnabled,
            dayBeforeTime: s.dayBeforeTime,
            hoursBeforeEnabled: s.hoursBeforeEnabled,
            hoursBefore: s.hoursBefore,
            smsProvider: s.sms.provider,
            twilioAccountSid: s.sms.twilioAccountSid,
            twilioAuthToken: '',
            twilioFrom: s.sms.twilioFrom,
        });
    };

    const load = useCallback(async () => {
        const s: Loaded = unwrap(await api.get('/reminders/settings'));
        apply(s);
        const templates: Template[] = unwrap(await api.get('/settings/templates')) ?? [];
        const own = templates.find((x) => x.type === 'appointment_reminder' && x.channel === 'sms' && x.language === s.language) ?? null;
        setTemplate(own);
        setText(own?.bodyTemplate ?? '');
        setLog(unwrap(await api.get('/reminders/log')) ?? []);
    }, []);

    useEffect(() => {
        load().catch((err) => setError(apiErrorMessage(err)));
    }, [load]);

    const run = async (key: string, request: () => Promise<unknown>, success: string) => {
        setBusy(key);
        setError(null);
        try {
            await request();
            toast.success(t(success));
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusy(null);
        }
    };

    const save = () =>
        run(
            'save',
            async () => {
                const { twilioAuthToken, ...rest } = form;
                apply(unwrap(await api.put('/reminders/settings', { ...rest, ...(twilioAuthToken ? { twilioAuthToken } : {}) })));
                await load();
            },
            'toast.saveSuccess',
        );

    const connect = (token: string | null) =>
        run(
            'bot',
            async () => {
                apply(unwrap(await api.put('/reminders/settings', { telegramBotToken: token })));
                setBotToken('');
                await load();
            },
            token ? 'reminders.telegram.connected' : 'toast.updateSuccess',
        );

    const saveText = () =>
        run(
            'text',
            async () => {
                if (!text.trim()) {
                    if (template) await api.delete(`/settings/templates/${template._id}`);
                } else if (template) {
                    await api.patch(`/settings/templates/${template._id}`, { bodyTemplate: text.trim(), isActive: true });
                } else {
                    await api.post('/settings/templates', {
                        type: 'appointment_reminder',
                        channel: 'sms',
                        language: settings!.language,
                        bodyTemplate: text.trim(),
                    });
                }
                dispatch(settingsActions.getTemplates());
                await load();
            },
            'toast.saveSuccess',
        );

    if (!settings) {
        return error ? <Alert severity="error">{error}</Alert> : null;
    }

    const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
    const tg = settings.telegram;

    return (
        <Stack spacing={3}>
            {error && (
                <Alert severity="error" onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                        <Typography variant="h6">{t('reminders.title')}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('reminders.settings.intro')}
                        </Typography>
                    </Box>
                    <FormControlLabel
                        control={<Switch checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />}
                        label={t('reminders.settings.enabled')}
                    />
                </Box>
                <Divider sx={{ my: 2 }} />
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6}>
                        <FormControlLabel
                            control={<Switch checked={form.dayBeforeEnabled} onChange={(e) => set('dayBeforeEnabled', e.target.checked)} />}
                            label={t('reminders.settings.dayBefore')}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            type="time"
                            size="small"
                            label={t('reminders.settings.sendAt')}
                            value={form.dayBeforeTime}
                            disabled={!form.dayBeforeEnabled}
                            onChange={(e) => set('dayBeforeTime', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ min: '08:00', max: '19:59', step: 900 }}
                            helperText={t('reminders.settings.sendAtHint')}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControlLabel
                            control={<Switch checked={form.hoursBeforeEnabled} onChange={(e) => set('hoursBeforeEnabled', e.target.checked)} />}
                            label={t('reminders.settings.hoursBefore')}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            select
                            size="small"
                            label={t('reminders.settings.hours')}
                            value={form.hoursBefore}
                            disabled={!form.hoursBeforeEnabled}
                            onChange={(e) => set('hoursBefore', Number(e.target.value))}
                            sx={{ minWidth: 160 }}
                        >
                            {[1, 2, 3, 4, 6, 8, 12].map((h) => (
                                <MenuItem key={h} value={h}>
                                    {t('reminders.settings.hoursN', { count: h })}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                </Grid>
                <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                    {t('reminders.settings.rulesHint')}
                </Typography>

                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    {t('reminders.sms.title')}
                </Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                        <TextField
                            select
                            fullWidth
                            size="small"
                            label={t('reminders.sms.provider')}
                            value={form.smsProvider}
                            onChange={(e) => set('smsProvider', e.target.value as SmsProviderName)}
                        >
                            <MenuItem value="off">{t('reminders.sms.off')}</MenuItem>
                            <MenuItem value="twilio">Twilio</MenuItem>
                            <MenuItem value="log">{t('reminders.sms.log')}</MenuItem>
                        </TextField>
                    </Grid>
                    {form.smsProvider === 'twilio' && (
                        <>
                            <Grid item xs={12} sm={4}>
                                <TextField fullWidth size="small" label="Account SID" value={form.twilioAccountSid} onChange={(e) => set('twilioAccountSid', e.target.value)} />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    type="password"
                                    label="Auth token"
                                    value={form.twilioAuthToken}
                                    placeholder={settings.sms.hasAuthToken ? t('reminders.sms.tokenSaved') : ''}
                                    InputLabelProps={{ shrink: true }}
                                    onChange={(e) => set('twilioAuthToken', e.target.value)}
                                    helperText={settings.sms.hasAuthToken ? t('reminders.sms.tokenKeep') : undefined}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label={t('reminders.sms.from')}
                                    value={form.twilioFrom}
                                    onChange={(e) => set('twilioFrom', e.target.value)}
                                    helperText={t('reminders.sms.fromHint')}
                                />
                            </Grid>
                        </>
                    )}
                    {form.smsProvider === 'log' && (
                        <Grid item xs={12} sm={8}>
                            <Alert severity="info">{t('reminders.sms.logHint')}</Alert>
                        </Grid>
                    )}
                </Grid>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                    <Button variant="contained" onClick={save} disabled={busy === 'save'}>
                        {t('common.save')}
                    </Button>
                </Box>
            </Paper>

            <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    <TelegramIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                    Telegram
                </Typography>
                {tg.connected ? (
                    <Stack spacing={1.5}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Chip color="success" size="small" label={t('reminders.telegram.connectedAs', { bot: `@${tg.botUsername}` })} />
                            <Button size="small" color="inherit" disabled={busy === 'bot'} onClick={() => connect(null)}>
                                {t('reminders.telegram.disconnect')}
                            </Button>
                        </Box>
                        {tg.mode === 'not_receiving' && <Alert severity="warning">{t('reminders.telegram.notReceiving')}</Alert>}
                        {tg.mode === 'polling' && <Alert severity="info">{t('reminders.telegram.polling')}</Alert>}
                        <Typography variant="body2" color="text.secondary">
                            {t('reminders.telegram.linkHint')}
                        </Typography>
                    </Stack>
                ) : (
                    <Stack spacing={1.5}>
                        <Typography variant="body2" color="text.secondary">
                            {t('reminders.telegram.howTo')}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <TextField
                                size="small"
                                type="password"
                                label={t('reminders.telegram.token')}
                                value={botToken}
                                onChange={(e) => setBotToken(e.target.value.trim())}
                                sx={{ minWidth: 320, flex: 1 }}
                            />
                            <Button variant="contained" disabled={!botToken || busy === 'bot'} onClick={() => connect(botToken)}>
                                {t('reminders.telegram.connect')}
                            </Button>
                        </Box>
                    </Stack>
                )}
            </Paper>

            <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    {t('reminders.text.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('reminders.text.help', { language: t(`reminders.languages.${settings.language}`) })}
                </Typography>
                <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    value={text}
                    placeholder={settings.defaultText}
                    onChange={(e) => setText(e.target.value)}
                    inputProps={{ maxLength: 600 }}
                    helperText={`${t('reminders.text.placeholders')}: ${(settings.placeholders ?? []).map((p) => `{{${p}}}`).join(' ')}`}
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                    {template && (
                        <Button color="inherit" disabled={busy === 'text'} onClick={() => { setText(''); }}>
                            {t('reminders.text.useDefault')}
                        </Button>
                    )}
                    <Button variant="outlined" disabled={busy === 'text'} onClick={saveText}>
                        {t('common.save')}
                    </Button>
                </Box>
            </Paper>

            <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    {t('reminders.test.title')}
                </Typography>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={6}>
                        <PatientPicker value={testPatient} onChange={(id) => setTestPatient(id || null)} />
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <TextField select fullWidth size="small" label={t('reminders.test.channel')} value={testChannel} onChange={(e) => setTestChannel(e.target.value as 'telegram' | 'sms')}>
                            <MenuItem value="sms">SMS</MenuItem>
                            <MenuItem value="telegram">Telegram</MenuItem>
                        </TextField>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<SendIcon />}
                            disabled={!testPatient || busy === 'test'}
                            onClick={() =>
                                run('test', () => api.post('/reminders/test', { channel: testChannel, patientId: testPatient }), 'reminders.test.sent')
                            }
                        >
                            {t('reminders.test.send')}
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    {t('reminders.log.title')}
                </Typography>
                {!log.length ? (
                    <Typography variant="body2" color="text.secondary">
                        {t('reminders.noneYet')}
                    </Typography>
                ) : (
                    <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('reminders.log.when')}</TableCell>
                                    <TableCell>{t('reminders.log.patient')}</TableCell>
                                    <TableCell>{t('reminders.log.appointment')}</TableCell>
                                    <TableCell>{t('reminders.log.rule')}</TableCell>
                                    <TableCell>{t('common.status')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {log.map((e) => (
                                    <TableRow key={e._id}>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(e.createdAt, i18n.language)}</TableCell>
                                        <TableCell>{patientName(e.patientId as any)}</TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                            {typeof e.appointmentId === 'object' ? formatDateTime(e.appointmentId.startTime, i18n.language) : '—'}
                                        </TableCell>
                                        <TableCell>{t(`reminders.rules.${e.rule}`)}</TableCell>
                                        <TableCell>
                                            <ReminderLogChip entry={e} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>
        </Stack>
    );
};

export default RemindersTab;
