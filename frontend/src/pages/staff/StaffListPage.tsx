import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Avatar,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    IconButton,
    InputAdornment,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Tabs,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    Edit as EditIcon,
    MoreVert as MoreIcon,
    Search as SearchIcon,
    ToggleOff as DeactivateIcon,
    ToggleOn as ActivateIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Controller, useForm } from 'react-hook-form';
import { RootState } from '../../store';
import { staffActions } from '../../store/staff';
import {
    ConfirmDialog,
    EmptyState,
    LoadingSpinner,
    PageHeader,
    StatusChip,
} from '../../components/ui';
import { useHttpState } from '../../hooks';
import { getFullName, getInitials } from '../../utils/formatters';
import { DEFAULT_PAGE_SIZE } from '../../utils/constants';
import { EMAIL_PATTERN, formatArmenianPhone, isArmenianPhone } from '../../utils/validators';
import {
    DENTIST_SPECIALIZATIONS,
    STAFF_ROLES,
    StaffMember,
    StaffRole,
} from '../../types';
import {
    MIN_PASSWORD_LENGTH,
    StaffCreateFormData,
    emptyStaffCreateForm,
    roleTranslationKey,
    toStaffCreatePayload,
} from './staffForm';

type RoleFilter = StaffRole | 'all';
type StatusFilter = 'active' | 'inactive' | 'all';

const ROLE_TABS: RoleFilter[] = ['all', ...STAFF_ROLES];
const STATUS_FILTERS: StatusFilter[] = ['active', 'inactive', 'all'];

const StaffListPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { list: staffList, total } = useSelector((state: RootState) => state.staff);
    const loading = useSelector((state: RootState) => state.http.loading.includes('GET_STAFF'));
    const listError = useSelector(
        (state: RootState) => state.http.errors.find((e) => e.type === 'GET_STAFF')?.error,
    );
    const {
        loading: creating,
        error: createError,
        success: createSuccess,
        clearError: clearCreateError,
        clearSuccess: clearCreateSuccess,
    } = useHttpState('CREATE_STAFF');
    const {
        error: statusError,
        success: statusSuccess,
        clearError: clearStatusError,
        clearSuccess: clearStatusSuccess,
    } = useHttpState('UPDATE_STAFF_STATUS');

    const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const [menuMember, setMenuMember] = useState<StaffMember | null>(null);
    const [pendingStatus, setPendingStatus] = useState<{
        member: StaffMember;
        isActive: boolean;
    } | null>(null);

    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const {
        control,
        handleSubmit,
        watch,
        reset,
        formState: { errors },
    } = useForm<StaffCreateFormData>({ defaultValues: emptyStaffCreateForm, mode: 'onBlur' });

    const selectedRole = watch('role');
    const password = watch('password');

    const fetchStaff = useCallback(
        (
            searchValue: string,
            pageNum: number,
            limit: number,
            role: RoleFilter,
            status: StatusFilter,
        ) => {
            dispatch(
                staffActions.getStaff({
                    search: searchValue.trim() || undefined,
                    role: role === 'all' ? undefined : role,
                    status,
                    page: pageNum + 1,
                    limit,
                }),
            );
        },
        [dispatch],
    );

    useEffect(() => {
        fetchStaff(search, page, rowsPerPage, roleFilter, statusFilter);
    }, [page, rowsPerPage, roleFilter, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    // Clear the pending debounce when leaving the page.
    useEffect(() => () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
    }, []);

    // The refreshed list is the visible feedback; drop the flag so it does not
    // pile up across changes.
    useEffect(() => {
        if (statusSuccess) clearStatusSuccess();
    }, [statusSuccess, clearStatusSuccess]);

    useEffect(() => {
        if (createSuccess) {
            clearCreateSuccess();
            setDialogOpen(false);
            reset(emptyStaffCreateForm);
        }
    }, [createSuccess, clearCreateSuccess, reset]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearch(value);

        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(() => {
            setPage(0);
            fetchStaff(value, 0, rowsPerPage, roleFilter, statusFilter);
        }, 400);
    };

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setRoleFilter(ROLE_TABS[newValue]);
        setPage(0);
    };

    const openDialog = () => {
        clearCreateError();
        reset(emptyStaffCreateForm);
        setDialogOpen(true);
    };

    const closeDialog = () => {
        clearCreateError();
        setDialogOpen(false);
    };

    const onCreate = (data: StaffCreateFormData) => {
        dispatch(staffActions.createStaff(toStaffCreatePayload(data)));
    };

    const openMenu = (event: React.MouseEvent<HTMLElement>, member: StaffMember) => {
        event.stopPropagation();
        setMenuAnchor(event.currentTarget);
        setMenuMember(member);
    };

    const closeMenu = () => {
        setMenuAnchor(null);
        setMenuMember(null);
    };

    const requestStatusChange = (member: StaffMember, isActive: boolean) => {
        closeMenu();
        clearStatusError();
        setPendingStatus({ member, isActive });
    };

    const confirmStatusChange = () => {
        if (!pendingStatus) return;
        dispatch(
            staffActions.updateStaffStatus({
                id: pendingStatus.member._id,
                isActive: pendingStatus.isActive,
            }),
        );
        setPendingStatus(null);
    };

    const isFiltered = search.trim() !== '' || roleFilter !== 'all' || statusFilter !== 'active';

    const clearFilters = () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        setSearch('');
        setRoleFilter('all');
        setStatusFilter('active');
        setPage(0);
        fetchStaff('', 0, rowsPerPage, 'all', 'active');
    };

    const statusOptions = useMemo(
        () =>
            STATUS_FILTERS.map((value) => ({
                value,
                label: value === 'all' ? t('common.all') : t(`common.${value}`),
            })),
        [t],
    );

    if (loading && staffList.length === 0) {
        return <LoadingSpinner fullPage />;
    }

    return (
        <Box>
            <PageHeader
                title={t('staff.title')}
                subtitle={`${t('staff.totalStaff')}: ${total}`}
                actionLabel={t('staff.addStaff')}
                onAction={openDialog}
            />

            <Paper sx={{ mb: 2 }}>
                <Tabs
                    value={ROLE_TABS.indexOf(roleFilter)}
                    onChange={handleTabChange}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
                >
                    {ROLE_TABS.map((role) => (
                        <Tab
                            key={role}
                            label={
                                role === 'all'
                                    ? t('common.all')
                                    : t(`staff.${roleTranslationKey(role)}`)
                            }
                        />
                    ))}
                </Tabs>
            </Paper>

            <Paper sx={{ mb: 2, p: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <TextField
                        sx={{ flex: '1 1 260px' }}
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
                    <TextField
                        select
                        size="small"
                        label={t('common.status')}
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value as StatusFilter);
                            setPage(0);
                        }}
                        sx={{ minWidth: 180 }}
                    >
                        {statusOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </TextField>
                </Box>
            </Paper>

            {listError && (
                <Typography color="error" sx={{ mb: 2 }}>
                    {listError}
                </Typography>
            )}
            {statusError && (
                <Typography color="error" sx={{ mb: 2 }}>
                    {statusError}
                </Typography>
            )}

            {staffList.length === 0 && !loading ? (
                isFiltered ? (
                    <EmptyState
                        title={t('staff.noMatches')}
                        description={t('staff.tryDifferentFilters')}
                        actionLabel={t('common.reset')}
                        onAction={clearFilters}
                    />
                ) : (
                    <EmptyState
                        title={t('staff.noStaff')}
                        actionLabel={t('staff.addStaff')}
                        onAction={openDialog}
                    />
                )
            ) : (
                <Paper>
                    <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('patients.fullName')}</TableCell>
                                    <TableCell>{t('staff.role')}</TableCell>
                                    <TableCell>{t('patients.email')}</TableCell>
                                    <TableCell>{t('patients.phone')}</TableCell>
                                    <TableCell>{t('staff.specialization')}</TableCell>
                                    <TableCell>{t('common.status')}</TableCell>
                                    <TableCell align="right">{t('common.actions')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {staffList.map((member) => (
                                    <TableRow
                                        key={member._id}
                                        hover
                                        sx={{ cursor: 'pointer' }}
                                        onClick={() => navigate(`/staff/${member._id}`)}
                                    >
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Avatar
                                                    src={member.avatar || undefined}
                                                    sx={{
                                                        width: 36,
                                                        height: 36,
                                                        fontSize: 14,
                                                        bgcolor: 'primary.main',
                                                    }}
                                                >
                                                    {getInitials(member.firstName, member.lastName)}
                                                </Avatar>
                                                <Typography variant="body2">
                                                    {getFullName(
                                                        member.firstName,
                                                        member.lastName,
                                                        member.patronymic,
                                                    )}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <StatusChip
                                                status={member.role === 'dentist' ? 'confirmed' : 'scheduled'}
                                                translationPrefix="staff"
                                                label={t(`staff.${roleTranslationKey(member.role)}`)}
                                            />
                                        </TableCell>
                                        <TableCell>{member.email || '-'}</TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                            {member.phone ? formatArmenianPhone(member.phone) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {member.specialization
                                                ? t(
                                                      `staff.specializations.${member.specialization}`,
                                                      member.specialization,
                                                  )
                                                : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <StatusChip
                                                status={member.isActive === false ? 'inactive' : 'active'}
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
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title={t('staff.changeStatus')}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => openMenu(e, member)}
                                                    >
                                                        <MoreIcon fontSize="small" />
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
                        onPageChange={(_e, newPage) => setPage(newPage)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(e) => {
                            setRowsPerPage(parseInt(e.target.value, 10));
                            setPage(0);
                        }}
                        rowsPerPageOptions={[10, 20, 50, 100]}
                        labelRowsPerPage={t('common.rowsPerPage')}
                        labelDisplayedRows={({ from, to, count }) =>
                            t('common.displayedRows', { from, to, total: count })
                        }
                    />
                </Paper>
            )}

            <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeMenu}>
                <MenuItem
                    disabled={menuMember?.isActive !== false}
                    onClick={() => menuMember && requestStatusChange(menuMember, true)}
                >
                    <ListItemIcon>
                        <ActivateIcon fontSize="small" color="success" />
                    </ListItemIcon>
                    <ListItemText>{t('common.activate')}</ListItemText>
                </MenuItem>
                <MenuItem
                    disabled={menuMember?.isActive === false}
                    onClick={() => menuMember && requestStatusChange(menuMember, false)}
                >
                    <ListItemIcon>
                        <DeactivateIcon fontSize="small" color="action" />
                    </ListItemIcon>
                    <ListItemText>{t('common.deactivate')}</ListItemText>
                </MenuItem>
            </Menu>

            <ConfirmDialog
                open={!!pendingStatus}
                title={t('staff.changeStatus')}
                message={
                    pendingStatus
                        ? t('staff.confirmStatusChange', {
                              name: getFullName(
                                  pendingStatus.member.firstName,
                                  pendingStatus.member.lastName,
                              ),
                              status: pendingStatus.isActive
                                  ? t('common.active')
                                  : t('common.inactive'),
                          })
                        : ''
                }
                variant={pendingStatus?.isActive ? 'default' : 'danger'}
                onConfirm={confirmStatusChange}
                onCancel={() => setPendingStatus(null)}
            />

            {/* Add Staff Dialog */}
            <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
                <Box component="form" onSubmit={handleSubmit(onCreate)} noValidate>
                    <DialogTitle>{t('staff.addStaff')}</DialogTitle>
                    <DialogContent>
                        {createError && (
                            <Typography color="error" variant="body2" sx={{ mb: 1 }}>
                                {createError}
                            </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                            {t('common.requiredFieldsHint')}
                        </Typography>
                        <Grid container spacing={2} sx={{ mt: 0.5 }}>
                            <Grid item xs={12} md={4}>
                                <Controller
                                    name="firstName"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            required
                                            fullWidth
                                            size="small"
                                            label={t('patients.firstName')}
                                            error={!!errors.firstName}
                                            helperText={errors.firstName?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Controller
                                    name="lastName"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            required
                                            fullWidth
                                            size="small"
                                            label={t('patients.lastName')}
                                            error={!!errors.lastName}
                                            helperText={errors.lastName?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Controller
                                    name="patronymic"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.patronymic')}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Controller
                                    name="email"
                                    control={control}
                                    rules={{
                                        required: t('validation.required'),
                                        pattern: {
                                            value: EMAIL_PATTERN,
                                            message: t('validation.invalidEmail'),
                                        },
                                    }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            required
                                            fullWidth
                                            size="small"
                                            type="email"
                                            label={t('patients.email')}
                                            error={!!errors.email}
                                            helperText={
                                                errors.email?.message || t('staff.emailIsLogin')
                                            }
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Controller
                                    name="phone"
                                    control={control}
                                    rules={{
                                        validate: (value) =>
                                            !value.trim() ||
                                            isArmenianPhone(value) ||
                                            t('validation.invalidArmenianPhone'),
                                    }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.phone')}
                                            placeholder="+374 93 123456"
                                            error={!!errors.phone}
                                            helperText={
                                                errors.phone?.message ||
                                                t('validation.invalidArmenianPhone')
                                            }
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Controller
                                    name="password"
                                    control={control}
                                    rules={{
                                        required: t('validation.required'),
                                        minLength: {
                                            value: MIN_PASSWORD_LENGTH,
                                            message: t('validation.passwordMin'),
                                        },
                                    }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            required
                                            fullWidth
                                            size="small"
                                            type="password"
                                            autoComplete="new-password"
                                            label={t('auth.password')}
                                            error={!!errors.password}
                                            helperText={
                                                errors.password?.message ||
                                                t('validation.passwordMin')
                                            }
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Controller
                                    name="confirmPassword"
                                    control={control}
                                    rules={{
                                        required: t('validation.required'),
                                        validate: (value) =>
                                            value === password || t('validation.passwordMatch'),
                                    }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            required
                                            fullWidth
                                            size="small"
                                            type="password"
                                            autoComplete="new-password"
                                            label={t('auth.confirmPassword')}
                                            error={!!errors.confirmPassword}
                                            helperText={errors.confirmPassword?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Controller
                                    name="role"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            select
                                            required
                                            fullWidth
                                            size="small"
                                            label={t('staff.role')}
                                            error={!!errors.role}
                                            helperText={errors.role?.message}
                                        >
                                            {STAFF_ROLES.map((role) => (
                                                <MenuItem key={role} value={role}>
                                                    {t(`staff.${roleTranslationKey(role)}`)}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    )}
                                />
                            </Grid>
                            {selectedRole === 'dentist' && (
                                <Grid item xs={12} md={6}>
                                    <Controller
                                        name="specialization"
                                        control={control}
                                        rules={{ required: t('validation.required') }}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                select
                                                required
                                                fullWidth
                                                size="small"
                                                label={t('staff.specialization')}
                                                error={!!errors.specialization}
                                                helperText={errors.specialization?.message}
                                            >
                                                {DENTIST_SPECIALIZATIONS.map((spec) => (
                                                    <MenuItem key={spec} value={spec}>
                                                        {t(`staff.specializations.${spec}`)}
                                                    </MenuItem>
                                                ))}
                                            </TextField>
                                        )}
                                    />
                                </Grid>
                            )}
                            <Grid item xs={12} md={selectedRole === 'dentist' ? 12 : 6}>
                                <Controller
                                    name="licenseNumber"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('staff.licenseNumber')}
                                        />
                                    )}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2 }}>
                        <Button onClick={closeDialog} color="inherit">
                            {t('common.cancel')}
                        </Button>
                        <Button type="submit" variant="contained" disabled={creating}>
                            {creating ? t('common.loading') : t('common.save')}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Box>
    );
};

export default StaffListPage;
