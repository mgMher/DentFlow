import React, { useEffect, useState } from 'react';
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
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { billingActions, InvoiceStatusFilter } from '../../store/billing';
import { PageHeader, EmptyState, LoadingSpinner } from '../../components/ui';
import InvoiceStatusChip from '../../components/billing/InvoiceStatusChip';
import { usePermission } from '../../hooks';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { patientName } from '../../utils/references';
import { DEFAULT_PAGE_SIZE } from '../../utils/constants';

const STATUS_TABS: Array<InvoiceStatusFilter | 'all'> = ['all', 'draft', 'issued', 'partial', 'overdue', 'paid', 'cancelled'];

/** All invoices; status, search and pages run on the server. */
const BillingListPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const can = usePermission();

    const { items: invoices, total } = useSelector((state: RootState) => state.billing.list);
    const loading = useSelector((state: RootState) => state.http.loading.includes('GET_INVOICES'));
    const loadError = useSelector((state: RootState) => state.http.errors.find((e) => e.type === 'GET_INVOICES'));

    const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter | 'all'>('all');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);

    // Typing waits a moment before searching, so each keystroke is not a request.
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(0);
        }, 350);
        return () => clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        dispatch(
            billingActions.getInvoices({
                search: search || undefined,
                page: page + 1,
                limit: rowsPerPage,
                status: statusFilter === 'all' ? undefined : statusFilter,
            }),
        );
    }, [dispatch, search, page, rowsPerPage, statusFilter]);

    const canCreate = can('manageBilling');
    const filtered = !!search || statusFilter !== 'all';

    if (loading && invoices.length === 0 && !filtered && page === 0) {
        return <LoadingSpinner fullPage />;
    }

    return (
        <Box>
            <PageHeader
                title={t('billing.title')}
                actionLabel={canCreate ? t('billing.createInvoice') : undefined}
                onAction={canCreate ? () => navigate('/billing/new') : undefined}
            />

            <Paper sx={{ mb: 2 }}>
                <Tabs
                    value={STATUS_TABS.indexOf(statusFilter)}
                    onChange={(_, index: number) => {
                        setStatusFilter(STATUS_TABS[index]);
                        setPage(0);
                    }}
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
                >
                    {STATUS_TABS.map((status) => (
                        <Tab key={status} label={status === 'all' ? t('common.all') : t(`billing.${status}`)} />
                    ))}
                </Tabs>
            </Paper>

            <Paper sx={{ mb: 2, p: 2 }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder={t('billing.searchPlaceholder')}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    inputProps={{ maxLength: 100, 'aria-label': t('common.search') }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon color="action" />
                            </InputAdornment>
                        ),
                    }}
                />
            </Paper>

            {loadError && !invoices.length ? (
                <EmptyState title={loadError.error} />
            ) : invoices.length === 0 && !loading ? (
                <EmptyState
                    title={t('billing.noInvoices')}
                    actionLabel={canCreate && !filtered ? t('billing.createInvoice') : undefined}
                    onAction={canCreate && !filtered ? () => navigate('/billing/new') : undefined}
                />
            ) : (
                <Paper>
                    <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('billing.invoiceNumber')}</TableCell>
                                    <TableCell>{t('billing.patient')}</TableCell>
                                    <TableCell>{t('common.date')}</TableCell>
                                    <TableCell>{t('billing.dueDate')}</TableCell>
                                    <TableCell align="right">{t('billing.totalAmount')}</TableCell>
                                    <TableCell align="right">{t('billing.paidAmount')}</TableCell>
                                    <TableCell align="right">{t('billing.balance')}</TableCell>
                                    <TableCell>{t('common.status')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {invoices.map((invoice) => (
                                    <TableRow
                                        key={invoice._id}
                                        hover
                                        sx={{ cursor: 'pointer' }}
                                        onClick={() => navigate(`/billing/${invoice._id}`)}
                                    >
                                        <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{invoice.invoiceNumber}</TableCell>
                                        <TableCell>{patientName(invoice.patientId)}</TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(invoice.createdAt)}</TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                            {invoice.dueDate ? formatDate(invoice.dueDate) : '—'}
                                        </TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                            {formatCurrency(invoice.totalAmount, invoice.currency)}
                                        </TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                            {formatCurrency(invoice.paidAmount, invoice.currency)}
                                        </TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                                            {invoice.status === 'cancelled' ? '—' : formatCurrency(invoice.balance, invoice.currency)}
                                        </TableCell>
                                        <TableCell>
                                            <InvoiceStatusChip invoice={invoice} />
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
                        onPageChange={(_, p) => setPage(p)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(e) => {
                            setRowsPerPage(parseInt(e.target.value, 10));
                            setPage(0);
                        }}
                        rowsPerPageOptions={[10, 20, 50]}
                        labelRowsPerPage={t('common.rowsPerPage')}
                        labelDisplayedRows={({ from, to, count }) => t('common.displayedRows', { from, to, total: count })}
                    />
                </Paper>
            )}
        </Box>
    );
};

export default BillingListPage;
