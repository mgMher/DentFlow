import React, { useEffect, useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    MenuItem,
} from '@mui/material';
import {
    ArrowBack as BackIcon,
    Print as PrintIcon,
    Payment as PaymentIcon,
    Cancel as CancelIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { billingActions } from '../../store/billing';
import { PageHeader, StatusChip, LoadingSpinner, ConfirmDialog } from '../../components/ui';
import { formatDate, formatCurrency, formatDateTime, getFullName } from '../../utils/formatters';
import { Patient, PaymentMethod } from '../../types';

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'bank_transfer'];

const InvoiceDetailPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { id } = useParams<{ id: string }>();

    const invoice = useSelector((state: RootState) => state.billing.currentInvoice);
    const payments = useSelector((state: RootState) => state.billing.payments);
    const loading = useSelector((state: RootState) => state.http.loading.includes('GET_INVOICE'));

    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [paymentForm, setPaymentForm] = useState({
        amount: '',
        method: 'cash' as PaymentMethod,
        reference: '',
        notes: '',
    });

    useEffect(() => {
        if (id) {
            dispatch(billingActions.getInvoice(id));
            dispatch(billingActions.getPayments(id));
        }
    }, [dispatch, id]);

    const getPatientInfo = (patientId: string | Patient) => {
        if (typeof patientId === 'string') {
            return { name: patientId, phone: '-', email: '-' };
        }
        return {
            name: getFullName(patientId.firstName, patientId.lastName, patientId.patronymic),
            phone: patientId.phone || '-',
            email: patientId.email || '-',
        };
    };

    const handleAddPayment = () => {
        if (!id || !paymentForm.amount) return;

        dispatch(
            billingActions.addPayment({
                invoiceId: id,
                data: {
                    amount: parseFloat(paymentForm.amount),
                    method: paymentForm.method,
                    reference: paymentForm.reference || undefined,
                    notes: paymentForm.notes || undefined,
                },
            }),
        );
        setPaymentDialogOpen(false);
        setPaymentForm({ amount: '', method: 'cash', reference: '', notes: '' });
    };

    const handleCancelInvoice = () => {
        if (!id) return;
        dispatch(billingActions.cancelInvoice(id));
        setCancelDialogOpen(false);
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading || !invoice) {
        return <LoadingSpinner fullPage />;
    }

    const balance = invoice.totalAmount - invoice.paidAmount;
    const patientInfo = getPatientInfo(invoice.patientId);
    const canCancel = invoice.status === 'draft' || invoice.status === 'pending';
    const canAddPayment = invoice.status !== 'cancelled' && invoice.status !== 'paid';

    return (
        <Box>
            <PageHeader title={`${t('billing.invoiceNumber')}: ${invoice.invoiceNumber}`}>
                <Button
                    variant="text"
                    startIcon={<BackIcon />}
                    onClick={() => navigate('/billing')}
                    sx={{ mr: 1 }}
                >
                    {t('common.back')}
                </Button>
                <Button
                    variant="outlined"
                    startIcon={<PrintIcon />}
                    onClick={handlePrint}
                    sx={{ mr: 1 }}
                >
                    {t('billing.printInvoice')}
                </Button>
                {canAddPayment && (
                    <Button
                        variant="contained"
                        startIcon={<PaymentIcon />}
                        onClick={() => setPaymentDialogOpen(true)}
                        sx={{ mr: 1 }}
                    >
                        {t('billing.addPayment')}
                    </Button>
                )}
                {canCancel && (
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<CancelIcon />}
                        onClick={() => setCancelDialogOpen(true)}
                    >
                        {t('common.cancel')}
                    </Button>
                )}
            </PageHeader>

            {/* Invoice Header */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                            {t('common.status')}
                        </Typography>
                        <Box sx={{ mt: 0.5 }}>
                            <StatusChip status={invoice.status} translationPrefix="billing" />
                        </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                            {t('common.date')}
                        </Typography>
                        <Typography>{formatDate(invoice.createdAt)}</Typography>
                        {invoice.dueDate && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {t('billing.dueDate')}: {formatDate(invoice.dueDate)}
                            </Typography>
                        )}
                    </Grid>
                </Grid>
            </Paper>

            {/* Patient Info */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    {t('billing.patient')}
                </Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" color="text.secondary">
                            {t('patients.firstName')}
                        </Typography>
                        <Typography>{patientInfo.name}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" color="text.secondary">
                            {t('patients.phone')}
                        </Typography>
                        <Typography>{patientInfo.phone}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" color="text.secondary">
                            {t('patients.email')}
                        </Typography>
                        <Typography>{patientInfo.email}</Typography>
                    </Grid>
                </Grid>
            </Paper>

            {/* Invoice Items */}
            <Paper sx={{ mb: 3 }}>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('treatments.description')}</TableCell>
                                <TableCell align="center">{t('billing.quantity')}</TableCell>
                                <TableCell align="right">{t('treatments.price')}</TableCell>
                                <TableCell align="right">{t('billing.discount')}</TableCell>
                                <TableCell align="right">{t('billing.totalAmount')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {invoice.items.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell>{item.description}</TableCell>
                                    <TableCell align="center">{item.quantity}</TableCell>
                                    <TableCell align="right">
                                        {formatCurrency(item.unitPrice, invoice.currency)}
                                    </TableCell>
                                    <TableCell align="right">
                                        {item.discount > 0
                                            ? formatCurrency(item.discount, invoice.currency)
                                            : '-'}
                                    </TableCell>
                                    <TableCell align="right">
                                        {formatCurrency(item.total, invoice.currency)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>

                {/* Totals */}
                <Box sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                        <Box sx={{ display: 'flex', gap: 4, minWidth: 300 }}>
                            <Typography color="text.secondary">{t('billing.subtotal')}:</Typography>
                            <Typography sx={{ ml: 'auto' }}>
                                {formatCurrency(invoice.subtotal, invoice.currency)}
                            </Typography>
                        </Box>
                        {invoice.discountTotal > 0 && (
                            <Box sx={{ display: 'flex', gap: 4, minWidth: 300 }}>
                                <Typography color="text.secondary">{t('billing.discount')}:</Typography>
                                <Typography sx={{ ml: 'auto', color: 'error.main' }}>
                                    -{formatCurrency(invoice.discountTotal, invoice.currency)}
                                </Typography>
                            </Box>
                        )}
                        {invoice.taxAmount > 0 && (
                            <Box sx={{ display: 'flex', gap: 4, minWidth: 300 }}>
                                <Typography color="text.secondary">{t('billing.tax')}:</Typography>
                                <Typography sx={{ ml: 'auto' }}>
                                    {formatCurrency(invoice.taxAmount, invoice.currency)}
                                </Typography>
                            </Box>
                        )}
                        <Divider sx={{ width: 300 }} />
                        <Box sx={{ display: 'flex', gap: 4, minWidth: 300 }}>
                            <Typography fontWeight={700}>{t('billing.totalAmount')}:</Typography>
                            <Typography sx={{ ml: 'auto' }} fontWeight={700}>
                                {formatCurrency(invoice.totalAmount, invoice.currency)}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 4, minWidth: 300 }}>
                            <Typography color="text.secondary">{t('billing.paidAmount')}:</Typography>
                            <Typography sx={{ ml: 'auto', color: 'success.main' }}>
                                {formatCurrency(invoice.paidAmount, invoice.currency)}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 4, minWidth: 300 }}>
                            <Typography fontWeight={700}>{t('billing.balance')}:</Typography>
                            <Typography
                                sx={{ ml: 'auto', color: balance > 0 ? 'error.main' : 'success.main' }}
                                fontWeight={700}
                            >
                                {formatCurrency(balance, invoice.currency)}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            </Paper>

            {/* Payments History */}
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                    {t('billing.addPayment')} - {t('reports.title')}
                </Typography>
                {payments.length === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                        {t('common.noData')}
                    </Typography>
                ) : (
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('common.date')}</TableCell>
                                    <TableCell align="right">{t('billing.amount')}</TableCell>
                                    <TableCell>{t('billing.paymentMethod')}</TableCell>
                                    <TableCell>{t('patients.notes')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {payments.map((payment) => (
                                    <TableRow key={payment._id}>
                                        <TableCell>{formatDateTime(payment.date)}</TableCell>
                                        <TableCell align="right">
                                            {formatCurrency(payment.amount, payment.currency)}
                                        </TableCell>
                                        <TableCell>
                                            {t(`billing.${payment.method === 'bank_transfer' ? 'bankTransfer' : payment.method}`)}
                                        </TableCell>
                                        <TableCell>{payment.notes || payment.reference || '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>

            {/* Add Payment Dialog */}
            <Dialog
                open={paymentDialogOpen}
                onClose={() => setPaymentDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>{t('billing.addPayment')}</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label={t('billing.amount')}
                            type="number"
                            fullWidth
                            value={paymentForm.amount}
                            onChange={(e) =>
                                setPaymentForm({ ...paymentForm, amount: e.target.value })
                            }
                            inputProps={{ min: 0, max: balance, step: 0.01 }}
                            helperText={`${t('billing.balance')}: ${formatCurrency(balance, invoice.currency)}`}
                        />
                        <TextField
                            label={t('billing.paymentMethod')}
                            select
                            fullWidth
                            value={paymentForm.method}
                            onChange={(e) =>
                                setPaymentForm({
                                    ...paymentForm,
                                    method: e.target.value as PaymentMethod,
                                })
                            }
                        >
                            {PAYMENT_METHODS.map((method) => (
                                <MenuItem key={method} value={method}>
                                    {t(`billing.${method === 'bank_transfer' ? 'bankTransfer' : method}`)}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label={t('billing.amount') + ' #'}
                            fullWidth
                            value={paymentForm.reference}
                            onChange={(e) =>
                                setPaymentForm({ ...paymentForm, reference: e.target.value })
                            }
                            placeholder="Reference number"
                        />
                        <TextField
                            label={t('patients.notes')}
                            fullWidth
                            multiline
                            rows={2}
                            value={paymentForm.notes}
                            onChange={(e) =>
                                setPaymentForm({ ...paymentForm, notes: e.target.value })
                            }
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setPaymentDialogOpen(false)} color="inherit">
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleAddPayment}
                        disabled={!paymentForm.amount || parseFloat(paymentForm.amount) <= 0}
                    >
                        {t('billing.addPayment')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Cancel Invoice Dialog */}
            <ConfirmDialog
                open={cancelDialogOpen}
                title={t('common.confirm')}
                message={t('billing.cancelled')}
                confirmLabel={t('common.confirm')}
                onConfirm={handleCancelInvoice}
                onCancel={() => setCancelDialogOpen(false)}
                variant="danger"
            />
        </Box>
    );
};

export default InvoiceDetailPage;
