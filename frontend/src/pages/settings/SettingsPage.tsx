import React, { useEffect, useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Tabs,
    Tab,
    TextField,
    Button,
    Switch,
    FormControlLabel,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Divider,
} from '@mui/material';
import {
    Save as SaveIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { clinicActions } from '../../store/clinic';
import { scheduleActions } from '../../store/schedule';
import { settingsActions } from '../../store/settings';
import { PageHeader, LoadingSpinner, ConfirmDialog } from '../../components/ui';
import { DAYS_OF_WEEK, LANGUAGES, CURRENCY_SYMBOLS } from '../../utils/constants';
import { Currency, WorkingHour, TreatmentRoom } from '../../types';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
    if (value !== index) return null;
    return <Box sx={{ py: 3 }}>{children}</Box>;
};

const CURRENCIES: Currency[] = ['AMD', 'USD', 'RUB'];

const TIMEZONES = [
    'Asia/Yerevan',
    'Europe/Moscow',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Berlin',
    'Asia/Dubai',
];

const SettingsPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const dispatch = useDispatch();

    const clinic = useSelector((state: RootState) => state.clinic.clinic);
    const rooms = useSelector((state: RootState) => state.schedule.rooms);
    const templates = useSelector((state: RootState) => state.settings.templates);
    const loading = useSelector((state: RootState) => state.http.loading.includes('GET_CLINIC'));
    const saving = useSelector(
        (state: RootState) =>
            state.http.loading.includes('UPDATE_CLINIC') ||
            state.http.loading.includes('UPDATE_WORKING_HOURS') ||
            state.http.loading.includes('UPDATE_SETTINGS'),
    );

    const [activeTab, setActiveTab] = useState(0);

    // Clinic Profile form
    const [profileForm, setProfileForm] = useState({
        name: '',
        phone: '',
        email: '',
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: '',
    });

    // Working Hours
    const [workingHours, setWorkingHours] = useState<WorkingHour[]>(
        DAYS_OF_WEEK.map((_, index) => ({
            dayOfWeek: index,
            startTime: '09:00',
            endTime: '18:00',
            isOpen: index > 0 && index < 6,
        })),
    );

    // Treatment Rooms
    const [roomDialogOpen, setRoomDialogOpen] = useState(false);
    const [editingRoom, setEditingRoom] = useState<TreatmentRoom | null>(null);
    const [roomForm, setRoomForm] = useState({ name: '', description: '', equipment: '' });
    const [deleteRoomId, setDeleteRoomId] = useState<string | null>(null);

    // Appearance
    const [appearance, setAppearance] = useState({
        darkMode: false,
        language: 'hy',
        currency: 'AMD' as Currency,
        timezone: 'Asia/Yerevan',
    });

    useEffect(() => {
        dispatch(clinicActions.getClinic());
        dispatch(scheduleActions.getRooms());
        dispatch(settingsActions.getTemplates());
    }, [dispatch]);

    useEffect(() => {
        if (clinic) {
            setProfileForm({
                name: clinic.name || '',
                phone: clinic.phone || '',
                email: clinic.email || '',
                street: clinic.address?.street || '',
                city: clinic.address?.city || '',
                state: clinic.address?.state || '',
                zipCode: clinic.address?.zipCode || '',
                country: clinic.address?.country || '',
            });
            if (clinic.workingHours && clinic.workingHours.length > 0) {
                setWorkingHours(
                    DAYS_OF_WEEK.map((_, index) => {
                        const existing = clinic.workingHours.find((wh) => wh.dayOfWeek === index);
                        return {
                            dayOfWeek: index,
                            startTime: existing?.startTime || '09:00',
                            endTime: existing?.endTime || '18:00',
                            isOpen: existing?.isOpen ?? (index > 0 && index < 6),
                        };
                    }),
                );
            }
            setAppearance({
                darkMode: false,
                language: clinic.language || 'hy',
                currency: clinic.currency || 'AMD',
                timezone: clinic.timezone || 'Asia/Yerevan',
            });
        }
    }, [clinic]);

    // ── Clinic Profile handlers ──

    const handleSaveProfile = () => {
        dispatch(
            clinicActions.updateClinic({
                name: profileForm.name,
                phone: profileForm.phone,
                email: profileForm.email,
                address: {
                    street: profileForm.street,
                    city: profileForm.city,
                    state: profileForm.state,
                    zipCode: profileForm.zipCode,
                    country: profileForm.country,
                },
            }),
        );
    };

    // ── Working Hours handlers ──

    const handleWorkingHoursChange = (index: number, field: keyof WorkingHour, value: any) => {
        const updated = [...workingHours];
        updated[index] = { ...updated[index], [field]: value };
        setWorkingHours(updated);
    };

    const handleSaveWorkingHours = () => {
        dispatch(clinicActions.updateWorkingHours({ workingHours }));
    };

    // ── Treatment Rooms handlers ──

    const handleOpenRoomDialog = (room?: TreatmentRoom) => {
        if (room) {
            setEditingRoom(room);
            setRoomForm({
                name: room.name,
                description: room.description || '',
                equipment: room.equipment?.join(', ') || '',
            });
        } else {
            setEditingRoom(null);
            setRoomForm({ name: '', description: '', equipment: '' });
        }
        setRoomDialogOpen(true);
    };

    const handleSaveRoom = () => {
        const data: Partial<TreatmentRoom> = {
            name: roomForm.name,
            description: roomForm.description || undefined,
            equipment: roomForm.equipment
                ? roomForm.equipment.split(',').map((s) => s.trim()).filter(Boolean)
                : [],
        };

        if (editingRoom) {
            dispatch(scheduleActions.createRoom({ ...data, _id: editingRoom._id } as any));
        } else {
            dispatch(scheduleActions.createRoom(data));
        }
        setRoomDialogOpen(false);
        setEditingRoom(null);
        setRoomForm({ name: '', description: '', equipment: '' });
    };

    const handleDeleteRoom = () => {
        if (deleteRoomId) {
            dispatch(settingsActions.deleteTemplate(deleteRoomId));
            setDeleteRoomId(null);
        }
    };

    // ── Notifications handlers ──

    const handleToggleTemplate = (templateId: string, currentActive: boolean) => {
        dispatch(
            settingsActions.updateTemplate({
                id: templateId,
                data: { isActive: !currentActive },
            }),
        );
    };

    // ── Appearance handlers ──

    const handleSaveAppearance = () => {
        if (appearance.language !== i18n.language) {
            i18n.changeLanguage(appearance.language);
        }
        dispatch(
            clinicActions.updateSettings({
                language: appearance.language,
                currency: appearance.currency,
                timezone: appearance.timezone,
            }),
        );
    };

    if (loading && !clinic) {
        return <LoadingSpinner fullPage />;
    }

    return (
        <Box>
            <PageHeader title={t('settings.title')} />

            <Paper sx={{ mb: 3 }}>
                <Tabs
                    value={activeTab}
                    onChange={(_e, v) => setActiveTab(v)}
                    sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
                    variant="scrollable"
                    scrollButtons="auto"
                >
                    <Tab label={t('settings.clinicProfile')} />
                    <Tab label={t('settings.workingHours')} />
                    <Tab label={t('settings.rooms')} />
                    <Tab label={t('settings.notifications')} />
                    <Tab label={t('settings.appearance')} />
                </Tabs>
            </Paper>

            {/* ── Clinic Profile Tab ── */}
            <TabPanel value={activeTab} index={0}>
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        {t('settings.clinicProfile')}
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label={t('auth.clinicName')}
                                fullWidth
                                required
                                value={profileForm.name}
                                onChange={(e) =>
                                    setProfileForm({ ...profileForm, name: e.target.value })
                                }
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField
                                label={t('patients.phone')}
                                fullWidth
                                value={profileForm.phone}
                                onChange={(e) =>
                                    setProfileForm({ ...profileForm, phone: e.target.value })
                                }
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField
                                label={t('patients.email')}
                                fullWidth
                                type="email"
                                value={profileForm.email}
                                onChange={(e) =>
                                    setProfileForm({ ...profileForm, email: e.target.value })
                                }
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                                {t('patients.address')}
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label={t('patients.address')}
                                fullWidth
                                value={profileForm.street}
                                onChange={(e) =>
                                    setProfileForm({ ...profileForm, street: e.target.value })
                                }
                                placeholder="Street address"
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField
                                label="City"
                                fullWidth
                                value={profileForm.city}
                                onChange={(e) =>
                                    setProfileForm({ ...profileForm, city: e.target.value })
                                }
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField
                                label="State / Region"
                                fullWidth
                                value={profileForm.state}
                                onChange={(e) =>
                                    setProfileForm({ ...profileForm, state: e.target.value })
                                }
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField
                                label="ZIP / Postal Code"
                                fullWidth
                                value={profileForm.zipCode}
                                onChange={(e) =>
                                    setProfileForm({ ...profileForm, zipCode: e.target.value })
                                }
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField
                                label="Country"
                                fullWidth
                                value={profileForm.country}
                                onChange={(e) =>
                                    setProfileForm({ ...profileForm, country: e.target.value })
                                }
                            />
                        </Grid>
                    </Grid>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                        <Button
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={handleSaveProfile}
                            disabled={saving || !profileForm.name.trim()}
                        >
                            {saving ? t('common.loading') : t('common.save')}
                        </Button>
                    </Box>
                </Paper>
            </TabPanel>

            {/* ── Working Hours Tab ── */}
            <TabPanel value={activeTab} index={1}>
                <Paper>
                    <Box sx={{ p: 2 }}>
                        <Typography variant="h6">{t('settings.workingHours')}</Typography>
                    </Box>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ width: '25%' }}>{t('common.date')}</TableCell>
                                    <TableCell sx={{ width: '25%' }}>{t('appointments.startTime')}</TableCell>
                                    <TableCell sx={{ width: '25%' }}>{t('appointments.endTime')}</TableCell>
                                    <TableCell sx={{ width: '25%' }}>{t('common.status')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {workingHours.map((wh, index) => (
                                    <TableRow key={DAYS_OF_WEEK[index]}>
                                        <TableCell>
                                            <Typography fontWeight={wh.isOpen ? 600 : 400}>
                                                {t(`days.${DAYS_OF_WEEK[index]}`)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                type="time"
                                                size="small"
                                                value={wh.startTime}
                                                onChange={(e) =>
                                                    handleWorkingHoursChange(index, 'startTime', e.target.value)
                                                }
                                                disabled={!wh.isOpen}
                                                sx={{ width: 140 }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                type="time"
                                                size="small"
                                                value={wh.endTime}
                                                onChange={(e) =>
                                                    handleWorkingHoursChange(index, 'endTime', e.target.value)
                                                }
                                                disabled={!wh.isOpen}
                                                sx={{ width: 140 }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormControlLabel
                                                control={
                                                    <Switch
                                                        checked={wh.isOpen}
                                                        onChange={(e) =>
                                                            handleWorkingHoursChange(
                                                                index,
                                                                'isOpen',
                                                                e.target.checked,
                                                            )
                                                        }
                                                        color="primary"
                                                    />
                                                }
                                                label={wh.isOpen ? t('common.active') : t('common.inactive')}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
                        <Button
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={handleSaveWorkingHours}
                            disabled={saving}
                        >
                            {saving ? t('common.loading') : t('common.save')}
                        </Button>
                    </Box>
                </Paper>
            </TabPanel>

            {/* ── Treatment Rooms Tab ── */}
            <TabPanel value={activeTab} index={2}>
                <Paper sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">{t('settings.rooms')}</Typography>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => handleOpenRoomDialog()}
                        >
                            {t('common.add')}
                        </Button>
                    </Box>
                    {rooms.length === 0 ? (
                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                            {t('common.noData')}
                        </Typography>
                    ) : (
                        <List>
                            {rooms.map((room, index) => (
                                <React.Fragment key={room._id}>
                                    {index > 0 && <Divider />}
                                    <ListItem>
                                        <ListItemText
                                            primary={room.name}
                                            secondary={
                                                <>
                                                    {room.description && (
                                                        <Typography variant="body2" component="span">
                                                            {room.description}
                                                        </Typography>
                                                    )}
                                                    {room.equipment && room.equipment.length > 0 && (
                                                        <Typography
                                                            variant="caption"
                                                            color="text.secondary"
                                                            component="span"
                                                            sx={{ display: 'block' }}
                                                        >
                                                            {room.equipment.join(', ')}
                                                        </Typography>
                                                    )}
                                                </>
                                            }
                                        />
                                        <ListItemSecondaryAction>
                                            <Tooltip title={t('common.edit')}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleOpenRoomDialog(room)}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title={t('common.delete')}>
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => setDeleteRoomId(room._id)}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                </React.Fragment>
                            ))}
                        </List>
                    )}
                </Paper>

                {/* Room Dialog */}
                <Dialog
                    open={roomDialogOpen}
                    onClose={() => setRoomDialogOpen(false)}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>
                        {editingRoom ? t('common.edit') : t('common.add')} - {t('settings.rooms')}
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                            <TextField
                                label={t('treatments.name')}
                                fullWidth
                                required
                                value={roomForm.name}
                                onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                            />
                            <TextField
                                label={t('treatments.description')}
                                fullWidth
                                multiline
                                rows={2}
                                value={roomForm.description}
                                onChange={(e) =>
                                    setRoomForm({ ...roomForm, description: e.target.value })
                                }
                            />
                            <TextField
                                label="Equipment (comma separated)"
                                fullWidth
                                value={roomForm.equipment}
                                onChange={(e) =>
                                    setRoomForm({ ...roomForm, equipment: e.target.value })
                                }
                                placeholder="X-ray, Dental chair, Sterilizer"
                            />
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2 }}>
                        <Button onClick={() => setRoomDialogOpen(false)} color="inherit">
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleSaveRoom}
                            disabled={!roomForm.name.trim()}
                        >
                            {t('common.save')}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Delete Room Confirm */}
                <ConfirmDialog
                    open={!!deleteRoomId}
                    title={t('common.confirm')}
                    message={t('common.delete') + '?'}
                    onConfirm={handleDeleteRoom}
                    onCancel={() => setDeleteRoomId(null)}
                    variant="danger"
                />
            </TabPanel>

            {/* ── Notifications Tab ── */}
            <TabPanel value={activeTab} index={3}>
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        {t('settings.templates')}
                    </Typography>
                    {templates.length === 0 ? (
                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                            {t('common.noData')}
                        </Typography>
                    ) : (
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>{t('treatments.name')}</TableCell>
                                        <TableCell>{t('treatments.category')}</TableCell>
                                        <TableCell>{t('treatments.description')}</TableCell>
                                        <TableCell align="center">{t('common.status')}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {templates.map((template: any) => (
                                        <TableRow key={template._id}>
                                            <TableCell>{template.type || template.name}</TableCell>
                                            <TableCell>{template.channel || '-'}</TableCell>
                                            <TableCell>{template.subject || template.description || '-'}</TableCell>
                                            <TableCell align="center">
                                                <Switch
                                                    checked={template.isActive !== false}
                                                    onChange={() =>
                                                        handleToggleTemplate(
                                                            template._id,
                                                            template.isActive !== false,
                                                        )
                                                    }
                                                    color="primary"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Paper>
            </TabPanel>

            {/* ── Appearance Tab ── */}
            <TabPanel value={activeTab} index={4}>
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        {t('settings.appearance')}
                    </Typography>
                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={appearance.darkMode}
                                        onChange={(e) =>
                                            setAppearance({ ...appearance, darkMode: e.target.checked })
                                        }
                                        color="primary"
                                    />
                                }
                                label={
                                    appearance.darkMode
                                        ? t('settings.darkMode')
                                        : t('settings.lightMode')
                                }
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label={t('settings.language')}
                                select
                                fullWidth
                                value={appearance.language}
                                onChange={(e) =>
                                    setAppearance({ ...appearance, language: e.target.value })
                                }
                            >
                                {LANGUAGES.map((lang) => (
                                    <MenuItem key={lang.code} value={lang.code}>
                                        {lang.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label={t('settings.currency')}
                                select
                                fullWidth
                                value={appearance.currency}
                                onChange={(e) =>
                                    setAppearance({
                                        ...appearance,
                                        currency: e.target.value as Currency,
                                    })
                                }
                            >
                                {CURRENCIES.map((c) => (
                                    <MenuItem key={c} value={c}>
                                        {CURRENCY_SYMBOLS[c]} {c}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label={t('settings.timezone')}
                                select
                                fullWidth
                                value={appearance.timezone}
                                onChange={(e) =>
                                    setAppearance({ ...appearance, timezone: e.target.value })
                                }
                            >
                                {TIMEZONES.map((tz) => (
                                    <MenuItem key={tz} value={tz}>
                                        {tz}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                    </Grid>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                        <Button
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={handleSaveAppearance}
                            disabled={saving}
                        >
                            {saving ? t('common.loading') : t('common.save')}
                        </Button>
                    </Box>
                </Paper>
            </TabPanel>
        </Box>
    );
};

export default SettingsPage;
