import React, { useEffect, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    MenuItem,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    ArrowBack as BackIcon,
    Print as PrintIcon,
    Payment as PaymentIcon,
    Cancel as CancelIcon,
    Edit as EditIcon,
    Send as IssueIcon,
    Undo as RefundIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { billingActions } from '../../store/billing';
import { ConfirmDialog, EmptyState, LoadingSpinner, PageHeader } from '../../components/ui';
import InvoiceStatusChip from '../../components/billing/InvoiceStatusChip';
import { useHttpState, usePermission } from '../../hooks';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { patientEmail, patientName, patientPhone, staffName } from '../../utils/references';
import { PAYMENT_METHODS, fitsCurrency, minorDigits, paymentMethodKey } from '../../utils/billing';
import { toLocalDateString } from '../../utils/dates';
import { Payment, PaymentMethod, PaymentVoidType } from '../../types';

const SummaryRow: React.FC<{ label: string; value: string; strong?: boolean; color?: string }> = ({
    label,
    value,
    strong,
    color,
}) => (
    <Box sx={{ display: 'flex', gap: 4, width: { xs: '100%', sm: 320 } }}>
        <Typography color={strong ? 'text.primary' : 'text.secondary'} fontWeight={strong ? 700 : 400}>
            {label}
        </Typography>
        <Typography sx={{ ml: 'auto', color }} fontWeight={strong ? 700 : 400}>
            {value}
        </Typography>
    </Box>
);

/**
 * One invoice: lines, totals, payments, and the actions its status and the
 * user's role allow. Prints as a clean invoice with the clinic's details.
 */
const InvoiceDetailPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const can = usePermission();
    const { id } = useParams<{ id: string }>();

    const stored = useSelector((state: RootState) => state.billing.current);
    const storedPayments = useSelector((state: RootState) => state.billing.payments);
    const clinic = useSelector((state: RootState) => state.clinic.clinic);
    const loading = useSelector((state: RootState) => state.http.loading.includes('GET_INVOICE'));
    const loadError = useSelector((state: RootState) => state.http.errors.find((e) => e.type === 'GET_INVOICE'));
    const pay = useHttpState('ADD_PAYMENT');
    const cancel = useHttpState('CANCEL_INVOICE');
    const issue = useHttpState('ISSUE_INVOICE');
    const refund = useHttpState('VOID_PAYMENT');

    // Never show the previously opened invoice under this URL.
    const invoice = stored && stored._id === id ? stored : null;
    const payments = storedPayments.invoiceId === id ? storedPayments.list : [];

    const [paymentOpen, setPaymentOpen] = useState(false);
    const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'cash' as PaymentMethod, date: '', reference: '', notes: '' });
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [refundTarget, setRefundTarget] = useState<Payment | null>(null);
    const [refundType, setRefundType] = useState<PaymentVoidType>('refund');
    const [refundReason, setRefundReason] = useState('');

    useEffect(() => {
        if (id) dispatch(billingActions.getInvoice(id));
    }, [dispatch, id]);

    // Dialogs close only once the server has accepted.
    useEffect(() => {
        if (!pay.success) return;
        pay.clearSuccess();
        setPaymentOpen(false);
    }, [pay.success]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!cancel.success) return;
        cancel.clearSuccess();
        setCancelOpen(false);
        setCancelReason('');
    }, [cancel.success]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!refund.success) return;
        refund.clearSuccess();
        setRefundTarget(null);
        setRefundReason('');
    }, [refund.success]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!invoice) {
        if (loadError && !loading) {
            return (
                <Box>
                    <PageHeader title={t('billing.invoice')}>
                        <Button variant="text" startIcon={<BackIcon />} onClick={() => navigate('/billing')}>
                            {t('common.back')}
                        </Button>
                    </PageHeader>
                    <EmptyState title={t('billing.notFound')} description={loadError.error} />
                </Box>
            );
        }
        return <LoadingSpinner fullPage />;
    }

    const currency = invoice.currency;
    const digits = minorDigits(currency);
    const money = (value: number) => formatCurrency(value, currency);
    const editor = can('manageBilling');
    const admin = can('billingAdmin');
    const isDraft = invoice.status === 'draft';
    const isOpen = invoice.status === 'issued' || invoice.status === 'partial';
    const canCancel =
        (isDraft && editor) || (invoice.status === 'issued' && invoice.paidAmount === 0 && admin);

    const openPayment = () => {
        pay.clearError();
        setPaymentForm({ amount: String(invoice.balance), method: 'cash', date: toLocalDateString(), reference: '', notes: '' });
        setPaymentOpen(true);
    };

    const amount = Number(paymentForm.amount);
    const amountError =
        paymentForm.amount.trim() === '' || !(amount > 0) || !fitsCurrency(amount, digits) || amount > invoice.balance;

    const submitPayment = () => {
        if (amountError) return;
        dispatch(
            billingActions.addPayment({
                invoiceId: invoice._id,
                data: {
                    amount,
                    method: paymentForm.method,
                    date: paymentForm.date || undefined,
                    reference: paymentForm.reference.trim() || undefined,
                    notes: paymentForm.notes.trim() || undefined,
                },
            }),
        );
    };

    const address = clinic
        ? [clinic.address?.street, clinic.address?.city, clinic.address?.country].filter(Boolean).join(', ')
        : '';

    return (
        <Box>
            <Box sx={{ displayPrint: 'none' }}>
                <PageHeader title={`${t('billing.invoice')} ${invoice.invoiceNumber}`}>
                    <Button variant="text" startIcon={<BackIcon />} onClick={() => navigate('/billing')}>
                        {t('common.back')}
                    </Button>
                    <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>
                        {t('billing.printInvoice')}
                    </Button>
                    {isDraft && editor && (
                        <>
                            <Button variant="outlined" startIcon={<EditIcon />} onClick={() => navigate(`/billing/${invoice._id}/edit`)}>
                                {t('common.edit')}
                            </Button>
                            <Button
                                variant="contained"
                                startIcon={<IssueIcon />}
                                disabled={issue.loading || invoice.totalAmount <= 0}
                                onClick={() => dispatch(billingActions.issueInvoice(invoice._id))}
                            >
                                {t('billing.issue')}
                            </Button>
                        </>
                    )}
                    {isOpen && editor && (
                        <Button variant="contained" startIcon={<PaymentIcon />} onClick={openPayment}>
                            {t('billing.addPayment')}
                        </Button>
                    )}
                    {canCancel && (
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<CancelIcon />}
                            onClick={() => {
                                cancel.clearError();
                                setCancelOpen(true);
                            }}
                        >
                            {t('billing.cancelInvoice')}
                        </Button>
                    )}
                </PageHeader>
                {invoice.status === 'issued' && invoice.paidAmount === 0 && editor && !admin && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        {t('billing.cancelIssuedHint')}
                    </Alert>
                )}
                {invoice.paidAmount > 0 && admin && invoice.status !== 'cancelled' && (
                    <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 2 }}>
                        {t('billing.refundBeforeCancel')}
                    </Typography>
                )}
            </Box>

            {/* Clinic letterhead: printed only. */}
            {clinic && (
                <Box sx={{ display: 'none', displayPrint: 'block', mb: 3 }}>
                    <Typography variant="h5" fontWeight={700}>{clinic.name}</Typography>
                    {address && <Typography variant="body2">{address}</Typography>}
                    <Typography variant="body2">{[clinic.phone, clinic.email].filter(Boolean).join(' · ')}</Typography>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6">{t('billing.invoice')} {invoice.invoiceNumber}</Typography>
                </Box>
            )}

            {invoice.status === 'cancelled' && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    {t('billing.cancelledBy', {
                        name: staffName(invoice.cancelledBy),
                        date: invoice.cancelledAt ? formatDate(invoice.cancelledAt) : '',
                    })}
                    {invoice.cancelReason && `: ${invoice.cancelReason}`}
                </Alert>
            )}

            <Paper sx={{ p: 3, mb: 3 }}>
                <Grid container spacing={3}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="subtitle2" color="text.secondary">{t('common.status')}</Typography>
                        <Box sx={{ mt: 0.5 }}>
                            <InvoiceStatusChip invoice={invoice} />
                        </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="subtitle2" color="text.secondary">{t('billing.issuedOn')}</Typography>
                        <Typography>{formatDate(invoice.issuedAt || invoice.createdAt)}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="subtitle2" color="text.secondary">{t('billing.dueDate')}</Typography>
                        <Typography color={invoice.isOverdue ? 'error.main' : undefined}>
                            {invoice.dueDate ? formatDate(invoice.dueDate) : '—'}
                        </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="subtitle2" color="text.secondary">{t('billing.createdBy')}</Typography>
                        <Typography>{staffName(invoice.createdBy)}</Typography>
                    </Grid>
                </Grid>
            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>{t('billing.patient')}</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" color="text.secondary">{t('billing.fullName')}</Typography>
                        <Typography>{patientName(invoice.patientId)}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" color="text.secondary">{t('patients.phone')}</Typography>
                        <Typography>{patientPhone(invoice.patientId)}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" color="text.secondary">{t('patients.email')}</Typography>
                        <Typography sx={{ overflowWrap: 'anywhere' }}>{patientEmail(invoice.patientId)}</Typography>
                    </Grid>
                </Grid>
            </Paper>

            <Paper sx={{ mb: 3 }}>
                <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('treatments.description')}</TableCell>
                                <TableCell align="center">{t('billing.quantity')}</TableCell>
                                <TableCell align="right">{t('billing.unitPrice')}</TableCell>
                                <TableCell align="right">{t('billing.discountPercent')}</TableCell>
                                <TableCell align="right">{t('billing.lineTotal')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {invoice.items.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell sx={{ overflowWrap: 'anywhere' }}>{item.description}</TableCell>
                                    <TableCell align="center">{item.quantity}</TableCell>
                                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(item.unitPrice)}</TableCell>
                                    <TableCell align="right">{item.discount > 0 ? `${item.discount}%` : '—'}</TableCell>
                                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(item.total)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>

                <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                    <SummaryRow label={t('billing.subtotal')} value={money(invoice.subtotal)} />
                    {invoice.discountTotal > 0 && (
                        <SummaryRow label={t('billing.discount')} value={`−${money(invoice.discountTotal)}`} color="error.main" />
                    )}
                    {invoice.taxAmount > 0 && <SummaryRow label={t('billing.tax')} value={money(invoice.taxAmount)} />}
                    <Divider sx={{ width: { xs: '100%', sm: 320 } }} />
                    <SummaryRow label={t('billing.totalAmount')} value={money(invoice.totalAmount)} strong />
                    <SummaryRow label={t('billing.paidAmount')} value={money(invoice.paidAmount)} color="success.main" />
                    {invoice.status !== 'cancelled' && (
                        <SummaryRow
                            label={t('billing.balance')}
                            value={money(invoice.balance)}
                            strong
                            color={invoice.balance > 0 ? 'error.main' : 'success.main'}
                        />
                    )}
                </Box>
                {invoice.notes && (
                    <Box sx={{ px: 3, pb: 3 }}>
                        <Typography variant="subtitle2" color="text.secondary">{t('patients.notes')}</Typography>
                        <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{invoice.notes}</Typography>
                    </Box>
                )}
            </Paper>

            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>{t('billing.payments')}</Typography>
                {payments.length === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                        {t('billing.noPayments')}
                    </Typography>
                ) : (
                    <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('common.date')}</TableCell>
                                    <TableCell align="right">{t('billing.amount')}</TableCell>
                                    <TableCell>{t('billing.paymentMethod')}</TableCell>
                                    <TableCell>{t('billing.reference')}</TableCell>
                                    <TableCell>{t('billing.receivedBy')}</TableCell>
                                    {admin && <TableCell sx={{ displayPrint: 'none' }} />}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {payments.map((payment) => (
                                    <TableRow key={payment._id} sx={payment.voidedAt ? { opacity: 0.6 } : undefined}>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(payment.date)}</TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{ whiteSpace: 'nowrap', textDecoration: payment.voidedAt ? 'line-through' : undefined }}
                                        >
                                            {formatCurrency(payment.amount, payment.currency)}
                                        </TableCell>
                                        <TableCell>{t(paymentMethodKey(payment.method))}</TableCell>
                                        <TableCell sx={{ overflowWrap: 'anywhere' }}>
                                            {payment.reference || '—'}
                                            {payment.notes && (
                                                <Typography variant="caption" color="text.secondary" component="div">
                                                    {payment.notes}
                                                </Typography>
                                            )}
                                            {payment.voidedAt && (
                                                <Box sx={{ mt: 0.5 }}>
                                                    <Chip size="small" color="warning" label={t(`billing.void.${payment.voidType ?? 'mistake'}`)} />
                                                    <Typography variant="caption" color="text.secondary" component="div">
                                                        {staffName(payment.voidedBy)}, {formatDate(payment.voidedAt)}: {payment.voidReason}
                                                    </Typography>
                                                </Box>
                                            )}
                                        </TableCell>
                                        <TableCell>{staffName(payment.receivedBy)}</TableCell>
                                        {admin && (
                                            <TableCell align="right" sx={{ displayPrint: 'none' }}>
                                                {!payment.voidedAt && (
                                                    <Tooltip title={t('billing.refundPayment')}>
                                                        <IconButton
                                                            size="small"
                                                            color="warning"
                                                            aria-label={t('billing.refundPayment')}
                                                            onClick={() => {
                                                                refund.clearError();
                                                                setRefundType('refund');
                                                                setRefundTarget(payment);
                                                            }}
                                                        >
                                                            <RefundIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>

            {/* Add payment */}
            <Dialog open={paymentOpen} onClose={() => !pay.loading && setPaymentOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{t('billing.addPayment')}</DialogTitle>
                <DialogContent>
                    {pay.error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {pay.error}
                        </Alert>
                    )}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label={`${t('billing.amount')} (${currency})`}
                            type="number"
                            fullWidth
                            required
                            autoFocus
                            value={paymentForm.amount}
                            onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                            error={!!paymentForm.amount && amountError}
                            inputProps={{ min: 0, max: invoice.balance, step: digits ? 0.01 : 1 }}
                            helperText={`${t('billing.balance')}: ${money(invoice.balance)}`}
                        />
                        <TextField
                            label={t('billing.paymentMethod')}
                            select
                            fullWidth
                            value={paymentForm.method}
                            onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as PaymentMethod })}
                        >
                            {PAYMENT_METHODS.map((method) => (
                                <MenuItem key={method} value={method}>
                                    {t(paymentMethodKey(method))}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label={t('common.date')}
                            type="date"
                            fullWidth
                            value={paymentForm.date}
                            onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                            inputProps={{ max: toLocalDateString() }}
                            InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                            label={t('billing.reference')}
                            fullWidth
                            value={paymentForm.reference}
                            onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                            helperText={t('billing.referenceHint')}
                            inputProps={{ maxLength: 100 }}
                        />
                        <TextField
                            label={t('patients.notes')}
                            fullWidth
                            multiline
                            rows={2}
                            value={paymentForm.notes}
                            onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                            inputProps={{ maxLength: 1000 }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setPaymentOpen(false)} color="inherit" disabled={pay.loading}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="contained" onClick={submitPayment} disabled={amountError || pay.loading}>
                        {pay.loading ? t('common.loading') : t('billing.addPayment')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Cancel invoice */}
            <ConfirmDialog
                open={cancelOpen}
                title={t('billing.cancelInvoice')}
                message={t('billing.cancelInvoiceMessage', { number: invoice.invoiceNumber })}
                confirmLabel={t('billing.cancelInvoice')}
                variant="danger"
                confirmDisabled={cancelReason.trim().length < 3 || cancel.loading}
                onConfirm={() => dispatch(billingActions.cancelInvoice({ id: invoice._id, reason: cancelReason.trim() }))}
                onCancel={() => setCancelOpen(false)}
            >
                {cancel.error && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                        {cancel.error}
                    </Alert>
                )}
                <TextField
                    autoFocus
                    fullWidth
                    required
                    size="small"
                    label={t('billing.reason')}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    helperText={t('dental.voidReasonHint')}
                    inputProps={{ maxLength: 500 }}
                    sx={{ mt: 2 }}
                />
            </ConfirmDialog>

            {/* Refund / void payment */}
            <ConfirmDialog
                open={!!refundTarget}
                title={t('billing.refundPayment')}
                message={
                    refundTarget
                        ? t('billing.refundMessage', { amount: formatCurrency(refundTarget.amount, refundTarget.currency) })
                        : ''
                }
                confirmLabel={t('billing.refundPayment')}
                variant="danger"
                confirmDisabled={refundReason.trim().length < 3 || refund.loading}
                onConfirm={() =>
                    refundTarget &&
                    dispatch(
                        billingActions.voidPayment({
                            invoiceId: invoice._id,
                            paymentId: refundTarget._id,
                            type: refundType,
                            reason: refundReason.trim(),
                        }),
                    )
                }
                onCancel={() => setRefundTarget(null)}
            >
                {refund.error && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                        {refund.error}
                    </Alert>
                )}
                <ToggleButtonGroup
                    exclusive
                    fullWidth
                    size="small"
                    value={refundType}
                    onChange={(_, value) => value && setRefundType(value)}
                    sx={{ mt: 2 }}
                >
                    <ToggleButton value="refund">{t('billing.void.refund')}</ToggleButton>
                    <ToggleButton value="mistake">{t('billing.void.mistake')}</ToggleButton>
                </ToggleButtonGroup>
                <TextField
                    fullWidth
                    required
                    size="small"
                    label={t('billing.reason')}
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    helperText={t('dental.voidReasonHint')}
                    inputProps={{ maxLength: 500 }}
                    sx={{ mt: 2 }}
                />
            </ConfirmDialog>
        </Box>
    );
};

export default InvoiceDetailPage;
