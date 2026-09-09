import React, { useEffect, useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Chip,
    MenuItem,
    Alert,
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    MeetingRoom as RoomIcon,
    Block as BlockIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { scheduleActions } from '../../store/schedule';
import { staffActions } from '../../store/staff';
import { httpActions } from '../../store/http';
import { PageHeader, EmptyState, LoadingSpinner } from '../../components/ui';
import { formatDate, getFullName } from '../../utils/formatters';
import { staffRefId } from '../../utils/staff';
import { BLOCKED_TIME_REASONS, BlockedTimeReason, UserProfile } from '../../types';

/** `BlockedTime.dentistId` comes back populated, so resolve it before rendering. */
const blockedDentistName = (dentist: string | UserProfile): string => {
    if (!dentist || typeof dentist === 'string') return '-';
    return getFullName(dentist.firstName || '', dentist.lastName || '') || '-';
};

const SchedulePage: React.FC = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();

    const rooms = useSelector((state: RootState) => state.schedule.rooms);
    const dentists = useSelector((state: RootState) => state.staff.dentists);
    const blockedTimes = useSelector((state: RootState) => state.schedule.blockedTimes);
    const loading = useSelector((state: RootState) =>
        state.http.loading.includes('GET_ROOMS') || state.http.loading.includes('GET_BLOCKED'),
    );
    const roomCreateSuccess = useSelector((state: RootState) =>
        state.http.successes.includes('CREATE_ROOM'),
    );
    const blockedCreateSuccess = useSelector((state: RootState) =>
        state.http.successes.includes('CREATE_BLOCKED'),
    );

    const [roomDialogOpen, setRoomDialogOpen] = useState(false);
    const [blockedDialogOpen, setBlockedDialogOpen] = useState(false);
    const [newRoom, setNewRoom] = useState({ name: '', description: '' });
    const [newBlocked, setNewBlocked] = useState<{
        dentistId: string;
        startTime: string;
        endTime: string;
        reason: BlockedTimeReason;
        title: string;
    }>({
        dentistId: '',
        startTime: '',
        endTime: '',
        reason: 'break',
        title: '',
    });
    const [blockedError, setBlockedError] = useState<string | null>(null);

    useEffect(() => {
        dispatch(scheduleActions.getRooms());
        dispatch(scheduleActions.getBlocked());
        dispatch(staffActions.getDentists());
    }, [dispatch]);

    // Preselect the first dentist once the list arrives.
    useEffect(() => {
        if (!newBlocked.dentistId && dentists.length > 0) {
            setNewBlocked((prev) => ({ ...prev, dentistId: staffRefId(dentists[0]) }));
        }
    }, [dentists]); // eslint-disable-line react-hooks/exhaustive-deps

    // Close room dialog on success
    useEffect(() => {
        if (roomCreateSuccess) {
            setRoomDialogOpen(false);
            setNewRoom({ name: '', description: '' });
            dispatch(httpActions.removeSuccess('CREATE_ROOM'));
        }
    }, [roomCreateSuccess, dispatch]);

    // Close blocked time dialog on success
    useEffect(() => {
        if (blockedCreateSuccess) {
            setBlockedDialogOpen(false);
            setBlockedError(null);
            // Keep the dentist selected so several blocks can be added in a row.
            setNewBlocked((prev) => ({
                ...prev,
                startTime: '',
                endTime: '',
                reason: 'break',
                title: '',
            }));
            dispatch(httpActions.removeSuccess('CREATE_BLOCKED'));
        }
    }, [blockedCreateSuccess, dispatch]);

    const handleCreateRoom = () => {
        if (newRoom.name.trim()) {
            dispatch(scheduleActions.createRoom(newRoom));
        }
    };

    const handleCreateBlocked = () => {
        if (!newBlocked.dentistId) {
            setBlockedError(t('schedule.selectDentist'));
            return;
        }
        if (!newBlocked.startTime || !newBlocked.endTime) {
            setBlockedError(t('validation.required'));
            return;
        }
        if (new Date(newBlocked.endTime) <= new Date(newBlocked.startTime)) {
            setBlockedError(t('schedule.endAfterStart'));
            return;
        }

        setBlockedError(null);
        dispatch(
            scheduleActions.createBlocked({
                dentistId: newBlocked.dentistId,
                // datetime-local has no timezone; send an absolute instant.
                startTime: new Date(newBlocked.startTime).toISOString(),
                endTime: new Date(newBlocked.endTime).toISOString(),
                reason: newBlocked.reason,
                title: newBlocked.title.trim() || undefined,
            }),
        );
    };

    const handleDeleteBlocked = (id: string) => {
        dispatch(scheduleActions.deleteBlocked(id));
    };

    if (loading && rooms.length === 0) {
        return <LoadingSpinner fullPage />;
    }

    return (
        <Box>
            <PageHeader title={t('nav.schedule')} />

            <Grid container spacing={3}>
                {/* Treatment Rooms */}
                <Grid item xs={12} md={6}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <RoomIcon color="primary" />
                                    <Typography variant="h6" fontWeight={600}>
                                        {t('settings.rooms')}
                                    </Typography>
                                </Box>
                                <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={() => setRoomDialogOpen(true)}
                                >
                                    {t('common.add')}
                                </Button>
                            </Box>

                            {rooms.length === 0 ? (
                                <EmptyState title={t('common.noData')} />
                            ) : (
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>{t('treatments.name')}</TableCell>
                                                <TableCell>{t('common.status')}</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {rooms.map((room) => (
                                                <TableRow key={room._id}>
                                                    <TableCell>{room.name}</TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={room.isActive ? t('common.active') : t('common.inactive')}
                                                            color={room.isActive ? 'success' : 'default'}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* Blocked Times */}
                <Grid item xs={12} md={6}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <BlockIcon color="error" />
                                    <Typography variant="h6" fontWeight={600}>
                                        {t('schedule.blockedTimes')}
                                    </Typography>
                                </Box>
                                <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={() => setBlockedDialogOpen(true)}
                                >
                                    {t('common.add')}
                                </Button>
                            </Box>

                            {blockedTimes.length === 0 ? (
                                <EmptyState title={t('schedule.noBlockedTimes')} />
                            ) : (
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>{t('appointments.dentist')}</TableCell>
                                                <TableCell>{t('appointments.startTime')}</TableCell>
                                                <TableCell>{t('appointments.endTime')}</TableCell>
                                                <TableCell>{t('schedule.reason')}</TableCell>
                                                <TableCell align="right">{t('common.actions')}</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {blockedTimes.map((bt) => (
                                                <TableRow key={bt._id}>
                                                    <TableCell>{blockedDentistName(bt.dentistId)}</TableCell>
                                                    <TableCell>{formatDate(bt.startTime, 'dd.MM.yyyy HH:mm')}</TableCell>
                                                    <TableCell>{formatDate(bt.endTime, 'dd.MM.yyyy HH:mm')}</TableCell>
                                                    <TableCell>
                                                        {bt.reason ? t(`schedule.${bt.reason}`) : '-'}
                                                        {bt.title && (
                                                            <Typography
                                                                variant="caption"
                                                                color="text.secondary"
                                                                sx={{ display: 'block' }}
                                                            >
                                                                {bt.title}
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => handleDeleteBlocked(bt._id)}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Add Room Dialog */}
            <Dialog open={roomDialogOpen} onClose={() => setRoomDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{t('common.add')} - {t('settings.rooms')}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label={t('treatments.name')}
                        value={newRoom.name}
                        onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                        sx={{ mt: 1, mb: 2 }}
                    />
                    <TextField
                        fullWidth
                        label={t('treatments.description')}
                        value={newRoom.description}
                        onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                        multiline
                        rows={2}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRoomDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button variant="contained" onClick={handleCreateRoom}>{t('common.save')}</Button>
                </DialogActions>
            </Dialog>

            {/* Add Blocked Time Dialog */}
            <Dialog open={blockedDialogOpen} onClose={() => setBlockedDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{t('schedule.addBlockedTime')}</DialogTitle>
                <DialogContent>
                    {blockedError && (
                        <Alert severity="error" sx={{ mt: 1, mb: 2 }}>
                            {blockedError}
                        </Alert>
                    )}
                    {dentists.length === 0 ? (
                        <Alert severity="info" sx={{ mt: 1 }}>
                            {t('schedule.noDentists')}
                        </Alert>
                    ) : (
                        <TextField
                            select
                            required
                            fullWidth
                            label={t('appointments.dentist')}
                            value={newBlocked.dentistId}
                            onChange={(e) =>
                                setNewBlocked({ ...newBlocked, dentistId: e.target.value })
                            }
                            sx={{ mt: 1, mb: 2 }}
                        >
                            {dentists.map((d: any) => (
                                <MenuItem key={d._id} value={staffRefId(d)}>
                                    {d.lastName} {d.firstName}
                                </MenuItem>
                            ))}
                        </TextField>
                    )}
                    <TextField
                        required
                        fullWidth
                        type="datetime-local"
                        label={t('appointments.startTime')}
                        value={newBlocked.startTime}
                        onChange={(e) => setNewBlocked({ ...newBlocked, startTime: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ mt: 1, mb: 2 }}
                    />
                    <TextField
                        required
                        fullWidth
                        type="datetime-local"
                        label={t('appointments.endTime')}
                        value={newBlocked.endTime}
                        onChange={(e) => setNewBlocked({ ...newBlocked, endTime: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        select
                        required
                        fullWidth
                        label={t('schedule.reason')}
                        value={newBlocked.reason}
                        onChange={(e) =>
                            setNewBlocked({
                                ...newBlocked,
                                reason: e.target.value as BlockedTimeReason,
                            })
                        }
                        sx={{ mb: 2 }}
                    >
                        {BLOCKED_TIME_REASONS.map((reason) => (
                            <MenuItem key={reason} value={reason}>
                                {t(`schedule.${reason}`)}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        fullWidth
                        label={t('schedule.note')}
                        value={newBlocked.title}
                        onChange={(e) => setNewBlocked({ ...newBlocked, title: e.target.value })}
                        multiline
                        rows={2}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBlockedDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateBlocked}
                        disabled={dentists.length === 0}
                    >
                        {t('common.save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default SchedulePage;
