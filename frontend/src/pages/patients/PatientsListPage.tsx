import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
    Box,
    TextField,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Paper,
    IconButton,
    Tooltip,
    InputAdornment,
    Avatar,
    MenuItem,
    Typography,
    Menu,
    ListItemIcon,
    ListItemText,
    Grid,
} from '@mui/material';
import {
    Search as SearchIcon,
    Visibility as ViewIcon,
    Edit as EditIcon,
    MoreVert as MoreIcon,
    ToggleOn as ActivateIcon,
    ToggleOff as DeactivateIcon,
    People as PeopleIcon,
    CheckCircle as CheckIcon,
    PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { patientsActions } from '../../store/patients';
import {
    PageHeader,
    StatusChip,
    EmptyState,
    LoadingSpinner,
    ConfirmDialog,
    StatCard,
} from '../../components/ui';
import { formatDate, getFullName, getInitials } from '../../utils/formatters';
import { formatArmenianPhone } from '../../utils/validators';
import { DEFAULT_PAGE_SIZE } from '../../utils/constants';
import { PATIENT_STATUSES, Patient, PatientStatus } from '../../types';

const PatientsListPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { list: patients, total, stats } = useSelector((state: RootState) => state.patients);
    const loading = useSelector((state: RootState) => state.http.loading.includes('GET_PATIENTS'));

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<PatientStatus | 'all'>('all');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const [menuPatient, setMenuPatient] = useState<Patient | null>(null);
    const [pendingStatus, setPendingStatus] = useState<{
        patient: Patient;
        status: PatientStatus;
    } | null>(null);
    const [statusReason, setStatusReason] = useState('');

    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchPatients = useCallback(
        (searchValue: string, pageNum: number, limit: number, status: PatientStatus | 'all') => {
            dispatch(
                patientsActions.getPatients({
                    search: searchValue.trim() || undefined,
                    status: status === 'all' ? undefined : status,
                    page: pageNum + 1,
                    limit,
                }),
            );
        },
        [dispatch],
    );

    useEffect(() => {
        fetchPatients(search, page, rowsPerPage, statusFilter);
    }, [page, rowsPerPage, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        dispatch(patientsActions.getPatientStats());
    }, [dispatch]);

    // Clear the pending debounce when leaving the page.
    useEffect(() => () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearch(value);

        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(() => {
            setPage(0);
            fetchPatients(value, 0, rowsPerPage, statusFilter);
        }, 400);
    };

    const handleChangePage = (_event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const openMenu = (event: React.MouseEvent<HTMLElement>, patient: Patient) => {
        event.stopPropagation();
        setMenuAnchor(event.currentTarget);
        setMenuPatient(patient);
    };

    const closeMenu = () => {
        setMenuAnchor(null);
        setMenuPatient(null);
    };

    const requestStatusChange = (patient: Patient, status: PatientStatus) => {
        closeMenu();
        setStatusReason('');
        setPendingStatus({ patient, status });
    };

    const confirmStatusChange = () => {
        if (!pendingStatus) return;
        dispatch(
            patientsActions.updatePatientStatus({
                id: pendingStatus.patient._id,
                status: pendingStatus.status,
                reason: statusReason.trim() || undefined,
            }),
        );
        setPendingStatus(null);
        setStatusReason('');
    };

    const cancelStatusChange = () => {
        setPendingStatus(null);
        setStatusReason('');
    };

    const isFiltered = search.trim() !== '' || statusFilter !== 'all';

    const clearFilters = () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        setSearch('');
        setStatusFilter('all');
        setPage(0);
        fetchPatients('', 0, rowsPerPage, 'all');
    };

    const statusOptions = useMemo(
        () => [
            { value: 'all' as const, label: t('patients.allStatuses') },
            ...PATIENT_STATUSES.map((status) => ({
                value: status,
                label: t(`patients.${status}`),
            })),
        ],
        [t],
    );

    if (loading && patients.length === 0) {
        return <LoadingSpinner fullPage />;
    }

    return (
        <Box>
            <PageHeader
                title={t('patients.title')}
                subtitle={`${t('patients.totalPatients')}: ${total}`}
                actionLabel={t('patients.addPatient')}
                onAction={() => navigate('/patients/new')}
            />

            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={4}>
                    <StatCard
                        title={t('patients.totalPatients')}
                        value={stats?.totalPatients ?? total}
                        icon={<PeopleIcon />}
                    />
                </Grid>
                <Grid item xs={12} sm={4}>
                    <StatCard
                        title={t('patients.active')}
                        value={stats?.activePatients ?? 0}
                        icon={<CheckIcon />}
                        color="#38A169"
                    />
                </Grid>
                <Grid item xs={12} sm={4}>
                    <StatCard
                        title={t('patients.newThisMonth')}
                        value={stats?.newPatientsThisMonth ?? 0}
                        icon={<PersonAddIcon />}
                        color="#3182CE"
                    />
                </Grid>
            </Grid>

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
                        label={t('patients.status')}
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value as PatientStatus | 'all');
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

            {patients.length === 0 && !loading ? (
                isFiltered ? (
                    <EmptyState
                        title={t('patients.noMatches')}
                        description={t('patients.tryDifferentFilters')}
                        actionLabel={t('common.reset')}
                        onAction={clearFilters}
                    />
                ) : (
                    <EmptyState
                        title={t('patients.noPatients')}
                        description={t('patients.addPatient')}
                        actionLabel={t('patients.addPatient')}
                        onAction={() => navigate('/patients/new')}
                    />
                )
            ) : (
                <Paper>
                    <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('patients.fullName')}</TableCell>
                                    <TableCell>{t('patients.phone')}</TableCell>
                                    <TableCell>{t('patients.email')}</TableCell>
                                    <TableCell>{t('patients.gender')}</TableCell>
                                    <TableCell>{t('patients.lastVisit')}</TableCell>
                                    <TableCell>{t('common.status')}</TableCell>
                                    <TableCell align="right">{t('common.actions')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {patients.map((patient) => (
                                    <TableRow
                                        key={patient._id}
                                        hover
                                        sx={{ cursor: 'pointer' }}
                                        onClick={() => navigate(`/patients/${patient._id}`)}
                                    >
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Avatar
                                                    src={patient.photo || undefined}
                                                    sx={{
                                                        width: 36,
                                                        height: 36,
                                                        fontSize: 14,
                                                        bgcolor: 'primary.main',
                                                    }}
                                                >
                                                    {getInitials(patient.firstName, patient.lastName)}
                                                </Avatar>
                                                <Typography variant="body2">
                                                    {getFullName(
                                                        patient.firstName,
                                                        patient.lastName,
                                                        patient.patronymic,
                                                    )}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                            {patient.phone ? formatArmenianPhone(patient.phone) : '-'}
                                        </TableCell>
                                        <TableCell>{patient.email || '-'}</TableCell>
                                        <TableCell>
                                            {patient.gender ? t(`patients.${patient.gender}`) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {patient.lastVisit ? formatDate(patient.lastVisit) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <StatusChip
                                                status={
                                                    patient.status ||
                                                    (patient.isActive ? 'active' : 'inactive')
                                                }
                                                translationPrefix="patients"
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Box
                                                sx={{ display: 'flex', justifyContent: 'flex-end' }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Tooltip title={t('common.view')}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() =>
                                                            navigate(`/patients/${patient._id}`)
                                                        }
                                                    >
                                                        <ViewIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title={t('common.edit')}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() =>
                                                            navigate(`/patients/${patient._id}/edit`)
                                                        }
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title={t('patients.changeStatus')}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => openMenu(e, patient)}
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
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={[10, 20, 50, 100]}
                        labelRowsPerPage={t('common.rowsPerPage')}
                        labelDisplayedRows={({ from, to, count }) =>
                            t('common.displayedRows', { from, to, total: count })
                        }
                    />
                </Paper>
            )}

            <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeMenu}>
                {PATIENT_STATUSES.filter((status) => status !== menuPatient?.status).map((status) => (
                    <MenuItem
                        key={status}
                        onClick={() => menuPatient && requestStatusChange(menuPatient, status)}
                    >
                        <ListItemIcon>
                            {status === 'active' ? (
                                <ActivateIcon fontSize="small" color="success" />
                            ) : (
                                <DeactivateIcon fontSize="small" color="action" />
                            )}
                        </ListItemIcon>
                        <ListItemText>{t(`patients.${status}`)}</ListItemText>
                    </MenuItem>
                ))}
            </Menu>

            <ConfirmDialog
                open={!!pendingStatus}
                title={t('patients.changeStatus')}
                message={
                    pendingStatus
                        ? t('patients.confirmStatusChange', {
                              status: t(`patients.${pendingStatus.status}`),
                          })
                        : ''
                }
                variant={pendingStatus?.status === 'active' ? 'default' : 'danger'}
                onConfirm={confirmStatusChange}
                onCancel={cancelStatusChange}
            >
                <TextField
                    fullWidth
                    size="small"
                    label={t('patients.statusReason')}
                    placeholder={t('patients.statusReasonHint')}
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    multiline
                    rows={2}
                    sx={{ mt: 2 }}
                />
            </ConfirmDialog>
        </Box>
    );
};

export default PatientsListPage;
