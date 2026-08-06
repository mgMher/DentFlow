import React, { useEffect, useState, useCallback } from 'react';
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
} from '@mui/material';
import {
    Search as SearchIcon,
    Visibility as ViewIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { patientsActions } from '../../store/patients';
import { PageHeader, StatusChip, EmptyState, LoadingSpinner } from '../../components/ui';
import { formatDate, getFullName, getInitials } from '../../utils/formatters';
import { DEFAULT_PAGE_SIZE } from '../../utils/constants';

const PatientsListPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { list: patients, total } = useSelector((state: RootState) => state.patients);
    const loading = useSelector((state: RootState) => state.http.loading.includes('GET_PATIENTS'));

    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
    const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    const fetchPatients = useCallback(
        (searchValue: string, pageNum: number, limit: number) => {
            dispatch(
                patientsActions.getPatients({
                    search: searchValue || undefined,
                    page: pageNum + 1,
                    limit,
                }),
            );
        },
        [dispatch],
    );

    useEffect(() => {
        fetchPatients(search, page, rowsPerPage);
    }, [page, rowsPerPage]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearch(value);

        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        const timer = setTimeout(() => {
            setPage(0);
            fetchPatients(value, 0, rowsPerPage);
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

    const handleChangePage = (_event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newLimit = parseInt(event.target.value, 10);
        setRowsPerPage(newLimit);
        setPage(0);
    };

    const handleRowClick = (patientId: string) => {
        navigate(`/patients/${patientId}`);
    };

    const handleAddPatient = () => {
        navigate('/patients/new');
    };

    if (loading && patients.length === 0) {
        return <LoadingSpinner fullPage />;
    }

    return (
        <Box>
            <PageHeader
                title={t('patients.title')}
                actionLabel={t('patients.addPatient')}
                onAction={handleAddPatient}
            />

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

            {patients.length === 0 && !loading ? (
                <EmptyState
                    title={t('patients.noPatients')}
                    description={search ? undefined : t('patients.addPatient')}
                    actionLabel={search ? undefined : t('patients.addPatient')}
                    onAction={search ? undefined : handleAddPatient}
                />
            ) : (
                <Paper>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('patients.firstName')}</TableCell>
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
                                        onClick={() => handleRowClick(patient._id)}
                                    >
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Avatar
                                                    sx={{
                                                        width: 36,
                                                        height: 36,
                                                        fontSize: 14,
                                                        bgcolor: 'primary.main',
                                                    }}
                                                >
                                                    {getInitials(patient.firstName, patient.lastName)}
                                                </Avatar>
                                                {getFullName(patient.firstName, patient.lastName, patient.patronymic)}
                                            </Box>
                                        </TableCell>
                                        <TableCell>{patient.phone || '-'}</TableCell>
                                        <TableCell>{patient.email || '-'}</TableCell>
                                        <TableCell>
                                            {patient.gender
                                                ? t(`patients.${patient.gender}`)
                                                : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {patient.lastVisit
                                                ? formatDate(patient.lastVisit)
                                                : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <StatusChip
                                                status={patient.isActive ? 'active' : 'inactive'}
                                                translationPrefix="common"
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Box
                                                sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Tooltip title={t('common.edit')}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => navigate(`/patients/${patient._id}`)}
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
        </Box>
    );
};

export default PatientsListPage;
