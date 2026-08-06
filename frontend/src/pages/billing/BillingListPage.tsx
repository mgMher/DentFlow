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
} from '@mui/material';
import {
    Search as SearchIcon,
    Visibility as ViewIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { billingActions } from '../../store/billing';
import { PageHeader, StatusChip, EmptyState, LoadingSpinner } from '../../components/ui';
import { formatDate, formatCurrency, getFullName } from '../../utils/formatters';
import { DEFAULT_PAGE_SIZE } from '../../utils/constants';
import { InvoiceStatus, Patient } from '../../types';

const STATUS_TABS: Array<InvoiceStatus | 'all'> = ['all', 'pending', 'partial', 'paid', 'overdue'];

const BillingListPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { invoices, total } = useSelector((state: RootState) => state.billing);
    const loading = useSelector((state: RootState) => state.http.loading.includes('GET_INVOICES'));

    const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
    const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    const fetchInvoices = useCallback(
        (searchValue: string, pageNum: number, limit: number, status: InvoiceStatus | 'all') => {
            dispatch(
                billingActions.getInvoices({
                    search: searchValue || undefined,
                    page: pageNum + 1,
                    limit,
                    status: status === 'all' ? undefined : status,
                }),
            );
        },
        [dispatch],
    );

    useEffect(() => {
        fetchInvoices(search, page, rowsPerPage, statusFilter);
    }, [page, rowsPerPage, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearch(value);

        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        const timer = setTimeout(() => {
            setPage(0);
            fetchInvoices(value, 0, rowsPerPage, statusFilter);
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
        setStatusFilter(STATUS_TABS[newValue]);
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

    const handleRowClick = (invoiceId: string) => {
        navigate(`/billing/${invoiceId}`);
    };

    const handleCreateInvoice = () => {
        navigate('/billing/new');
    };

    const getPatientName = (patientId: string | Patient): string => {
        if (typeof patientId === 'string') {
            return patientId;
        }
        return getFullName(patientId.firstName, patientId.lastName, patientId.patronymic);
    };

    if (loading && invoices.length === 0) {
        return <LoadingSpinner fullPage />;
    }

    return (
        <Box>
            <PageHeader
                title={t('billing.title')}
                actionLabel={t('billing.createInvoice')}
                onAction={handleCreateInvoice}
            />

            <Paper sx={{ mb: 2 }}>
                <Tabs
                    value={STATUS_TABS.indexOf(statusFilter)}
                    onChange={handleTabChange}
                    sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
                >
                    <Tab label={t('common.all')} />
                    <Tab label={t('billing.pending')} />
                    <Tab label={t('billing.partial')} />
                    <Tab label={t('billing.paid')} />
                    <Tab label={t('billing.overdue')} />
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

            {invoices.length === 0 && !loading ? (
                <EmptyState
                    title={t('billing.noInvoices')}
                    actionLabel={t('billing.createInvoice')}
                    onAction={handleCreateInvoice}
                />
            ) : (
                <Paper>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('billing.invoiceNumber')}</TableCell>
                                    <TableCell>{t('billing.patient')}</TableCell>
                                    <TableCell>{t('common.date')}</TableCell>
                                    <TableCell align="right">{t('billing.totalAmount')}</TableCell>
                                    <TableCell align="right">{t('billing.paidAmount')}</TableCell>
                                    <TableCell align="right">{t('billing.balance')}</TableCell>
                                    <TableCell>{t('common.status')}</TableCell>
                                    <TableCell align="right">{t('common.actions')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {invoices.map((invoice) => {
                                    const balance = invoice.totalAmount - invoice.paidAmount;
                                    return (
                                        <TableRow
                                            key={invoice._id}
                                            hover
                                            sx={{ cursor: 'pointer' }}
                                            onClick={() => handleRowClick(invoice._id)}
                                        >
                                            <TableCell sx={{ fontWeight: 600 }}>
                                                {invoice.invoiceNumber}
                                            </TableCell>
                                            <TableCell>
                                                {getPatientName(invoice.patientId)}
                                            </TableCell>
                                            <TableCell>
                                                {formatDate(invoice.createdAt)}
                                            </TableCell>
                                            <TableCell align="right">
                                                {formatCurrency(invoice.totalAmount, invoice.currency)}
                                            </TableCell>
                                            <TableCell align="right">
                                                {formatCurrency(invoice.paidAmount, invoice.currency)}
                                            </TableCell>
                                            <TableCell align="right">
                                                {formatCurrency(balance, invoice.currency)}
                                            </TableCell>
                                            <TableCell>
                                                <StatusChip
                                                    status={invoice.status}
                                                    translationPrefix="billing"
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
                                                            onClick={() => navigate(`/billing/${invoice._id}`)}
                                                        >
                                                            <ViewIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
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

export default BillingListPage;
