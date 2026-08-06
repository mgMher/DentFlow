import React, { useEffect, useState, useCallback } from 'react';
import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Tabs,
    Tab,
    TextField,
    InputAdornment,
    IconButton,
    Tooltip,
    Avatar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Grid,
    MenuItem,
} from '@mui/material';
import {
    Search as SearchIcon,
    Visibility as ViewIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { staffActions } from '../../store/staff';
import { PageHeader, StatusChip, EmptyState, LoadingSpinner } from '../../components/ui';
import { getFullName, getInitials } from '../../utils/formatters';
import { DEFAULT_PAGE_SIZE } from '../../utils/constants';
import { UserRole } from '../../types';

const ROLE_TABS: Array<UserRole | 'all'> = ['all', 'dentist', 'clinic_admin', 'receptionist', 'assistant'];

const ROLE_OPTIONS: UserRole[] = ['clinic_admin', 'dentist', 'receptionist', 'assistant'];

const SPECIALIZATIONS = [
    'general_dentistry',
    'orthodontics',
    'periodontics',
    'endodontics',
    'prosthodontics',
    'pediatric_dentistry',
    'oral_surgery',
    'cosmetic_dentistry',
];

interface StaffFormData {
    firstName: string;
    lastName: string;
    patronymic: string;
    email: string;
    password: string;
    phone: string;
    role: UserRole;
    specialization: string;
    licenseNumber: string;
}

const EMPTY_FORM: StaffFormData = {
    firstName: '',
    lastName: '',
    patronymic: '',
    email: '',
    password: '',
    phone: '',
    role: 'dentist',
    specialization: '',
    licenseNumber: '',
};

const StaffListPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { list: staffList, total } = useSelector((state: RootState) => state.staff);
    const loading = useSelector((state: RootState) => state.http.loading.includes('GET_STAFF'));
    const createSuccess = useSelector((state: RootState) => state.http.successes.includes('CREATE_STAFF'));

    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
    const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState<StaffFormData>({ ...EMPTY_FORM });

    const fetchStaff = useCallback(
        (searchValue: string, pageNum: number, limit: number, role: UserRole | 'all') => {
            dispatch(
                staffActions.getStaff({
                    search: searchValue || undefined,
                    page: pageNum + 1,
                    limit,
                    role: role === 'all' ? undefined : role,
                }),
            );
        },
        [dispatch],
    );

    useEffect(() => {
        fetchStaff(search, page, rowsPerPage, roleFilter);
    }, [page, rowsPerPage, roleFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (createSuccess) {
            setDialogOpen(false);
            setForm({ ...EMPTY_FORM });
        }
    }, [createSuccess]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearch(value);

        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        const timer = setTimeout(() => {
            setPage(0);
            fetchStaff(value, 0, rowsPerPage, roleFilter);
        }, 400);

        setDebounceTimer(timer);
    };

    useEffect(() => {
        return () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
        };
    }, [debounceTimer]);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setRoleFilter(ROLE_TABS[newValue]);
        setPage(0);
    };

    const handleChangePage = (_event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newLimit = parseInt(event.target.value, 10);
        setRowsPerPage(newLimit);
        setPage(0);
    };

    const handleRowClick = (staffId: string) => {
        navigate(`/staff/${staffId}`);
    };

    const handleFormChange = (field: keyof StaffFormData, value: string) => {
        setForm({ ...form, [field]: value });
    };

    const handleCreateStaff = () => {
        const payload: any = {
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            password: form.password,
            phone: form.phone || undefined,
            role: form.role,
        };
        if (form.patronymic) payload.patronymic = form.patronymic;
        if (form.role === 'dentist' && form.specialization) payload.specialization = form.specialization;
        if (form.licenseNumber) payload.licenseNumber = form.licenseNumber;

        dispatch(staffActions.createStaff(payload));
    };

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

    const isFormValid = form.firstName.trim() && form.lastName.trim() && form.email.trim() && form.password.length >= 6 && form.role;

    if (loading && staffList.length === 0) {
        return <LoadingSpinner fullPage />;
    }

    return (
        <Box>
            <PageHeader
                title={t('staff.title')}
                actionLabel={t('staff.addStaff')}
                onAction={() => setDialogOpen(true)}
            />

            <Paper sx={{ mb: 2 }}>
                <Tabs
                    value={ROLE_TABS.indexOf(roleFilter)}
                    onChange={handleTabChange}
                    sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
                >
                    <Tab label={t('common.all')} />
                    <Tab label={t('staff.dentist')} />
                    <Tab label={t('staff.clinicAdmin')} />
                    <Tab label={t('staff.receptionist')} />
                    <Tab label={t('staff.assistant')} />
                </Tabs>
            </Paper>

            <Paper sx={{ mb: 2, p: 2 }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder={`${t('common.search')}...`}
                    value={search}
                    onChange={handleSearchChange}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon color="action" />
                            </InputAdornment>
                        ),
                    }}
                />
            </Paper>

            {staffList.length === 0 && !loading ? (
                <EmptyState
                    title={t('staff.noStaff')}
                    actionLabel={t('staff.addStaff')}
                    onAction={() => setDialogOpen(true)}
                />
            ) : (
                <Paper>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('patients.firstName')}</TableCell>
                                    <TableCell>{t('staff.role')}</TableCell>
                                    <TableCell>{t('patients.email')}</TableCell>
                                    <TableCell>{t('patients.phone')}</TableCell>
                                    <TableCell>{t('staff.specialization')}</TableCell>
                                    <TableCell>{t('common.status')}</TableCell>
                                    <TableCell align="right">{t('common.actions')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {staffList.map((member: any) => (
                                    <TableRow
                                        key={member._id}
                                        hover
                                        sx={{ cursor: 'pointer' }}
                                        onClick={() => handleRowClick(member._id)}
                                    >
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Avatar
                                                    src={member.avatar}
                                                    sx={{
                                                        width: 36,
                                                        height: 36,
                                                        fontSize: 14,
                                                        bgcolor: 'primary.main',
                                                    }}
                                                >
                                                    {getInitials(member.firstName, member.lastName)}
                                                </Avatar>
                                                {getFullName(member.firstName, member.lastName, member.patronymic)}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <StatusChip
                                                status={member.role === 'dentist' ? 'confirmed' : 'scheduled'}
                                                translationPrefix="appointments"
                                                label={t(`staff.${getRoleTranslationKey(member.role)}`)}
                                            />
                                        </TableCell>
                                        <TableCell>{member.email || '-'}</TableCell>
                                        <TableCell>{member.phone || '-'}</TableCell>
                                        <TableCell>{member.specialization || '-'}</TableCell>
                                        <TableCell>
                                            <StatusChip
                                                status={member.isActive !== false ? 'active' : 'inactive'}
                                                translationPrefix="common"
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Box
                                                sx={{ display: 'flex', justifyContent: 'flex-end' }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Tooltip title={t('common.edit')}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => navigate(`/staff/${member._id}`)}
                                                    >
                                                        <ViewIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        component="div"
                        count={total}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={[10, 20, 50]}
                    />
                </Paper>
            )}

            {/* Add Staff Dialog */}
            <Dialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>{t('staff.addStaff')}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label={t('patients.firstName')}
                                fullWidth
                                required
                                value={form.firstName}
                                onChange={(e) => handleFormChange('firstName', e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label={t('patients.lastName')}
                                fullWidth
                                required
                                value={form.lastName}
                                onChange={(e) => handleFormChange('lastName', e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label={t('patients.patronymic')}
                                fullWidth
                                value={form.patronymic}
                                onChange={(e) => handleFormChange('patronymic', e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label={t('patients.email')}
                                fullWidth
                                required
                                type="email"
                                value={form.email}
                                onChange={(e) => handleFormChange('email', e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label={t('auth.password')}
                                fullWidth
                                required
                                type="password"
                                value={form.password}
                                onChange={(e) => handleFormChange('password', e.target.value)}
                                inputProps={{ minLength: 6 }}
                                helperText={form.password && form.password.length < 6 ? t('validation.required') : ''}
                                error={!!form.password && form.password.length < 6}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label={t('patients.phone')}
                                fullWidth
                                value={form.phone}
                                onChange={(e) => handleFormChange('phone', e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label={t('staff.role')}
                                select
                                fullWidth
                                required
                                value={form.role}
                                onChange={(e) => handleFormChange('role', e.target.value)}
                            >
                                {ROLE_OPTIONS.map((role) => (
                                    <MenuItem key={role} value={role}>
                                        {t(`staff.${getRoleTranslationKey(role)}`)}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                        {form.role === 'dentist' && (
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label={t('staff.specialization')}
                                    select
                                    fullWidth
                                    value={form.specialization}
                                    onChange={(e) => handleFormChange('specialization', e.target.value)}
                                >
                                    {SPECIALIZATIONS.map((spec) => (
                                        <MenuItem key={spec} value={spec}>
                                            {spec.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                        )}
                        <Grid item xs={12} md={form.role === 'dentist' ? 12 : 6}>
                            <TextField
                                label={t('staff.licenseNumber')}
                                fullWidth
                                value={form.licenseNumber}
                                onChange={(e) => handleFormChange('licenseNumber', e.target.value)}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDialogOpen(false)} color="inherit">
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateStaff}
                        disabled={!isFormValid}
                    >
                        {t('common.save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default StaffListPage;
