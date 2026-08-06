import React, { useEffect, useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Avatar,
    Tabs,
    Tab,
    TextField,
    Button,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Switch,
    FormControlLabel,
} from '@mui/material';
import {
    ArrowBack as BackIcon,
    Save as SaveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { staffActions } from '../../store/staff';
import { PageHeader, StatusChip, LoadingSpinner, StatCard } from '../../components/ui';
import { getFullName, getInitials, formatCurrency } from '../../utils/formatters';
import { UserRole } from '../../types';
import { DAYS_OF_WEEK } from '../../utils/constants';

const ROLE_OPTIONS: UserRole[] = ['clinic_admin', 'dentist', 'receptionist', 'assistant'];

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
    if (value !== index) return null;
    return <Box sx={{ py: 3 }}>{children}</Box>;
};

const StaffDetailPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { id } = useParams<{ id: string }>();

    const staff = useSelector((state: RootState) => state.staff.current);
    const loading = useSelector((state: RootState) => state.http.loading.includes('GET_STAFF_MEMBER'));
    const saving = useSelector((state: RootState) => state.http.loading.includes('UPDATE_STAFF'));

    const [activeTab, setActiveTab] = useState(0);
    const [editForm, setEditForm] = useState({
        firstName: '',
        lastName: '',
        patronymic: '',
        email: '',
        phone: '',
        role: 'dentist' as UserRole,
        specialization: '',
        licenseNumber: '',
    });
    const [schedule, setSchedule] = useState(
        DAYS_OF_WEEK.map((day, index) => ({
            dayOfWeek: index,
            day,
            startTime: '09:00',
            endTime: '18:00',
            isOpen: index > 0 && index < 6,
        })),
    );

    useEffect(() => {
        if (id) {
            dispatch(staffActions.getStaffMember(id));
        }
    }, [dispatch, id]);

    useEffect(() => {
        if (staff) {
            setEditForm({
                firstName: staff.firstName || '',
                lastName: staff.lastName || '',
                patronymic: staff.patronymic || '',
                email: staff.email || '',
                phone: staff.phone || '',
                role: staff.role || 'dentist',
                specialization: staff.specialization || '',
                licenseNumber: staff.licenseNumber || '',
            });
            if (staff.schedule && Array.isArray(staff.schedule)) {
                setSchedule(
                    DAYS_OF_WEEK.map((day, index) => {
                        const existing = staff.schedule?.find((s: any) => s.dayOfWeek === index);
                        return {
                            dayOfWeek: index,
                            day,
                            startTime: existing?.startTime || '09:00',
                            endTime: existing?.endTime || '18:00',
                            isOpen: existing?.isOpen ?? (index > 0 && index < 6),
                        };
                    }),
                );
            }
        }
    }, [staff]);

    const getRoleTranslationKey = (role: string): string => {
        const roleMap: Record<string, string> = {
            clinic_admin: 'clinicAdmin',
            dentist: 'dentist',
            receptionist: 'receptionist',
            assistant: 'assistant',
            super_admin: 'clinicAdmin',
        };
        return roleMap[role] || role;
    };

    const handleSaveProfile = () => {
        if (!id) return;
        const data: any = {
            firstName: editForm.firstName,
            lastName: editForm.lastName,
            email: editForm.email,
            phone: editForm.phone || undefined,
            role: editForm.role,
        };
        if (editForm.patronymic) data.patronymic = editForm.patronymic;
        if (editForm.role === 'dentist' && editForm.specialization) {
            data.specialization = editForm.specialization;
        }
        if (editForm.licenseNumber) data.licenseNumber = editForm.licenseNumber;

        dispatch(staffActions.updateStaff({ id, data }));
    };

    const handleSaveSchedule = () => {
        if (!id) return;
        dispatch(
            staffActions.updateStaff({
                id,
                data: { schedule },
            }),
        );
    };

    const handleScheduleChange = (index: number, field: string, value: any) => {
        const updated = [...schedule];
        updated[index] = { ...updated[index], [field]: value };
        setSchedule(updated);
    };

    if (loading || !staff) {
        return <LoadingSpinner fullPage />;
    }

    return (
        <Box>
            <PageHeader title={t('staff.title')}>
                <Button variant="text" startIcon={<BackIcon />} onClick={() => navigate('/staff')}>
                    {t('common.back')}
                </Button>
            </PageHeader>

            {/* Staff Profile Card */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Avatar
                        src={staff.avatar}
                        sx={{ width: 80, height: 80, fontSize: 28, bgcolor: 'primary.main' }}
                    >
                        {getInitials(staff.firstName, staff.lastName)}
                    </Avatar>
                    <Box>
                        <Typography variant="h5" fontWeight={700}>
                            {getFullName(staff.firstName, staff.lastName, staff.patronymic)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <StatusChip
                                status={staff.role === 'dentist' ? 'confirmed' : 'scheduled'}
                                translationPrefix="appointments"
                                label={t(`staff.${getRoleTranslationKey(staff.role)}`)}
                            />
                            <StatusChip
                                status={staff.isActive !== false ? 'active' : 'inactive'}
                                translationPrefix="common"
                            />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {staff.email}
                            {staff.phone ? ` | ${staff.phone}` : ''}
                        </Typography>
                    </Box>
                </Box>
            </Paper>

            {/* Tabs */}
            <Paper sx={{ mb: 3 }}>
                <Tabs
                    value={activeTab}
                    onChange={(_e, v) => setActiveTab(v)}
                    sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
                >
                    <Tab label={t('patients.patientProfile')} />
                    <Tab label={t('staff.schedule')} />
                    <Tab label={t('reports.dentistPerformance')} />
                </Tabs>
            </Paper>

            {/* Profile Tab */}
            <TabPanel value={activeTab} index={0}>
                <Paper sx={{ p: 3 }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label={t('patients.firstName')}
                                fullWidth
                                required
                                value={editForm.firstName}
                                onChange={(e) =>
                                    setEditForm({ ...editForm, firstName: e.target.value })
                                }
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label={t('patients.lastName')}
                                fullWidth
                                required
                                value={editForm.lastName}
                                onChange={(e) =>
                                    setEditForm({ ...editForm, lastName: e.target.value })
                                }
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label={t('patients.patronymic')}
                                fullWidth
                                value={editForm.patronymic}
                                onChange={(e) =>
                                    setEditForm({ ...editForm, patronymic: e.target.value })
                                }
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label={t('patients.email')}
                                fullWidth
                                required
                                type="email"
                                value={editForm.email}
                                onChange={(e) =>
                                    setEditForm({ ...editForm, email: e.target.value })
                                }
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label={t('patients.phone')}
                                fullWidth
                                value={editForm.phone}
                                onChange={(e) =>
                                    setEditForm({ ...editForm, phone: e.target.value })
                                }
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label={t('staff.role')}
                                select
                                fullWidth
                                required
                                value={editForm.role}
                                onChange={(e) =>
                                    setEditForm({ ...editForm, role: e.target.value as UserRole })
                                }
                            >
                                {ROLE_OPTIONS.map((role) => (
                                    <MenuItem key={role} value={role}>
                                        {t(`staff.${getRoleTranslationKey(role)}`)}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                        {editForm.role === 'dentist' && (
                            <Grid item xs={12} md={4}>
                                <TextField
                                    label={t('staff.specialization')}
                                    fullWidth
                                    value={editForm.specialization}
                                    onChange={(e) =>
                                        setEditForm({ ...editForm, specialization: e.target.value })
                                    }
                                />
                            </Grid>
                        )}
                        <Grid item xs={12} md={editForm.role === 'dentist' ? 4 : 8}>
                            <TextField
                                label={t('staff.licenseNumber')}
                                fullWidth
                                value={editForm.licenseNumber}
                                onChange={(e) =>
                                    setEditForm({ ...editForm, licenseNumber: e.target.value })
                                }
                            />
                        </Grid>
                    </Grid>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                        <Button
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={handleSaveProfile}
                            disabled={saving}
                        >
                            {saving ? t('common.loading') : t('common.save')}
                        </Button>
                    </Box>
                </Paper>
            </TabPanel>

            {/* Schedule Tab */}
            <TabPanel value={activeTab} index={1}>
                <Paper>
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
                                {schedule.map((day, index) => (
                                    <TableRow key={day.day}>
                                        <TableCell>
                                            <Typography fontWeight={day.isOpen ? 600 : 400}>
                                                {t(`days.${day.day}`)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                type="time"
                                                size="small"
                                                value={day.startTime}
                                                onChange={(e) =>
                                                    handleScheduleChange(index, 'startTime', e.target.value)
                                                }
                                                disabled={!day.isOpen}
                                                sx={{ width: 140 }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                type="time"
                                                size="small"
                                                value={day.endTime}
                                                onChange={(e) =>
                                                    handleScheduleChange(index, 'endTime', e.target.value)
                                                }
                                                disabled={!day.isOpen}
                                                sx={{ width: 140 }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormControlLabel
                                                control={
                                                    <Switch
                                                        checked={day.isOpen}
                                                        onChange={(e) =>
                                                            handleScheduleChange(
                                                                index,
                                                                'isOpen',
                                                                e.target.checked,
                                                            )
                                                        }
                                                        color="primary"
                                                    />
                                                }
                                                label={
                                                    day.isOpen
                                                        ? t('common.active')
                                                        : t('common.inactive')
                                                }
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
                            onClick={handleSaveSchedule}
                            disabled={saving}
                        >
                            {saving ? t('common.loading') : t('common.save')}
                        </Button>
                    </Box>
                </Paper>
            </TabPanel>

            {/* Performance Tab */}
            <TabPanel value={activeTab} index={2}>
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={4}>
                        <StatCard
                            title={t('reports.appointmentStats')}
                            value={staff.appointmentCount ?? 0}
                            icon={
                                <Box
                                    component="span"
                                    sx={{ fontSize: 24, fontWeight: 700 }}
                                >
                                    #
                                </Box>
                            }
                            color="#3182CE"
                        />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <StatCard
                            title={t('reports.totalRevenue')}
                            value={formatCurrency(staff.revenue ?? 0)}
                            icon={
                                <Box
                                    component="span"
                                    sx={{ fontSize: 24, fontWeight: 700 }}
                                >
                                    $
                                </Box>
                            }
                            color="#38A169"
                        />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <StatCard
                            title={t('reports.completionRate')}
                            value={`${staff.completionRate ?? 0}%`}
                            icon={
                                <Box
                                    component="span"
                                    sx={{ fontSize: 24, fontWeight: 700 }}
                                >
                                    %
                                </Box>
                            }
                            color="#ED8936"
                        />
                    </Grid>
                </Grid>
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                        {t('reports.dentistPerformance')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {t('common.noData')}
                    </Typography>
                </Paper>
            </TabPanel>
        </Box>
    );
};

export default StaffDetailPage;
