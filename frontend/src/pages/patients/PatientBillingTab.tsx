import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Grid,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Typography,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { RootState } from '../../store';
import { billingActions } from '../../store/billing';
import { EmptyState, LoadingSpinner } from '../../components/ui';
import InvoiceStatusChip from '../../components/billing/InvoiceStatusChip';
import { usePermission } from '../../hooks';
import { formatCurrency, formatDate } from '../../utils/formatters';

const PAGE_SIZE = 20;

/**
 * The patient's invoices and what they owe. Drafts and cancelled invoices
 * are not debt (the old tab added cancelled invoices to the balance).
 */
const PatientBillingTab: React.FC<{ patientId: string; billable: boolean }> = ({ patientId, billable }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const can = usePermission();
    const { byPatient } = useSelector((state: RootState) => state.billing);
    const loading = useSelector((state: RootState) => state.http.loading.includes('GET_PATIENT_INVOICES'));
    const [page, setPage] = useState(0);

    useEffect(() => {
        dispatch(billingActions.getPatientInvoices({ patientId, page: page + 1, limit: PAGE_SIZE }));
    }, [dispatch, patientId, page]);

    useEffect(() => {
        dispatch(billingActions.getPatientSummary(patientId));
    }, [dispatch, patientId]);

    const mine = byPatient.query?.patientId === patientId;
    const rows = mine ? byPatient.items : [];
    const summary = byPatient.summary?.patientId === patientId ? byPatient.summary : null;
    const canCreate = can('manageBilling') && billable;

    return (
        <Box>
            {summary && (
                <Grid container spacing={2} sx={{ mb: 2 }}>
                    {summary.byCurrency.map((s) => (
                        <Grid item xs={12} md={6} key={s.currency}>
                            <Card>
                                <CardContent sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">{t('billing.billed')}</Typography>
                                        <Typography fontWeight={600}>{formatCurrency(s.billed, s.currency)}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">{t('billing.paidAmount')}</Typography>
                                        <Typography fontWeight={600} color="success.main">{formatCurrency(s.paid, s.currency)}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">{t('billing.balance')}</Typography>
                                        <Typography fontWeight={700} color={s.balance > 0 ? 'error.main' : 'text.primary'}>
                                            {formatCurrency(s.balance, s.currency)}
                                        </Typography>
                                    </Box>
                                    {s.overdue > 0 && (
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">{t('billing.overdue')}</Typography>
                                            <Typography fontWeight={600} color="error.main">{s.overdue}</Typography>
                                        </Box>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {(canCreate || (summary?.unbilledTreatments ?? 0) > 0) && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
                    {(summary?.unbilledTreatments ?? 0) > 0 && (
                        <Alert severity="info" sx={{ flex: 1, py: 0 }}>
                            {t('billing.unbilledCount', { count: summary!.unbilledTreatments })}
                        </Alert>
                    )}
                    {canCreate && (
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            sx={{ ml: 'auto' }}
                            onClick={() => navigate(`/billing/new?patientId=${patientId}`)}
                        >
                            {t('billing.createInvoice')}
                        </Button>
                    )}
                </Box>
            )}

            {loading && !rows.length ? (
                <LoadingSpinner />
            ) : !rows.length ? (
                <EmptyState title={t('billing.noInvoices')} />
            ) : (
                <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('billing.invoiceNumber')}</TableCell>
                                <TableCell>{t('common.date')}</TableCell>
                                <TableCell align="right">{t('billing.totalAmount')}</TableCell>
                                <TableCell align="right">{t('billing.paidAmount')}</TableCell>
                                <TableCell align="right">{t('billing.balance')}</TableCell>
                                <TableCell>{t('common.status')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((invoice) => (
                                <TableRow
                                    key={invoice._id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/billing/${invoice._id}`)}
                                >
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{invoice.invoiceNumber}</TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(invoice.createdAt)}</TableCell>
                                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                        {formatCurrency(invoice.totalAmount, invoice.currency)}
                                    </TableCell>
                                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                        {formatCurrency(invoice.paidAmount, invoice.currency)}
                                    </TableCell>
                                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                        {['cancelled', 'draft'].includes(invoice.status)
                                            ? '—'
                                            : formatCurrency(invoice.balance, invoice.currency)}
                                    </TableCell>
                                    <TableCell>
                                        <InvoiceStatusChip invoice={invoice} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {byPatient.total > PAGE_SIZE && (
                        <TablePagination
                            component="div"
                            count={byPatient.total}
                            page={page}
                            onPageChange={(_, p) => setPage(p)}
                            rowsPerPage={PAGE_SIZE}
                            rowsPerPageOptions={[PAGE_SIZE]}
                        />
                    )}
                </TableContainer>
            )}
        </Box>
    );
};

export default PatientBillingTab;
