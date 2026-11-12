import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    InputAdornment,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import api from '../../api/axios';
import { PatientAccount, PaymentMethod } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import { fitsCurrency, minorDigits, PAYMENT_METHODS, paymentMethodKey } from '../../utils/billing';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toLocalDateString } from '../../utils/dates';

interface TakePaymentDialogProps {
    open: boolean;
    patientId: string;
    account: PatientAccount;
    onClose: () => void;
    onDone: () => void;
}

/** Fill the open invoices oldest first, in whole minor units. */
const oldestFirst = (account: PatientAccount, amount: number) => {
    const scale = 10 ** minorDigits(account.currency);
    let left = Math.round(amount * scale);
    const out: Record<string, string> = {};
    for (const invoice of account.openInvoices) {
        const take = Math.max(0, Math.min(left, Math.round(invoice.balance * scale)));
        out[invoice._id] = take ? String(take / scale) : '';
        left -= take;
    }
    return out;
};

/**
 * Money from the patient: one amount spread over their open invoices
 * (oldest first, changeable per invoice); what is not on an invoice becomes
 * their credit. With no open invoices it is simply an advance payment.
 */
const TakePaymentDialog: React.FC<TakePaymentDialogProps> = ({ open, patientId, account, onClose, onDone }) => {
    const { t, i18n } = useTranslation();
    const digits = minorDigits(account.currency);
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState<PaymentMethod>('cash');
    const [date, setDate] = useState(toLocalDateString());
    const [reference, setReference] = useState('');
    const [parts, setParts] = useState<Record<string, string>>({});
    const [edited, setEdited] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setAmount(account.outstanding > 0 ? String(account.outstanding) : '');
        setMethod('cash');
        setDate(toLocalDateString());
        setReference('');
        setParts(oldestFirst(account, account.outstanding));
        setEdited(false);
        setError(null);
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const value = amount.trim() === '' ? NaN : Number(amount);
    const amountOk = Number.isFinite(value) && value > 0 && fitsCurrency(value, digits);
    // Until a part is changed by hand, the parts follow the amount.
    useEffect(() => {
        if (!edited) setParts(oldestFirst(account, amountOk ? value : 0));
    }, [amount]); // eslint-disable-line react-hooks/exhaustive-deps

    const scale = 10 ** digits;
    const rows = account.openInvoices.map((invoice) => {
        const raw = parts[invoice._id] ?? '';
        const part = raw.trim() === '' ? 0 : Number(raw);
        const ok = Number.isFinite(part) && part >= 0 && fitsCurrency(part, digits) && part <= invoice.balance + 1e-9;
        return { invoice, raw, part: ok ? part : 0, ok };
    });
    const onInvoices = Math.round(rows.reduce((s, r) => s + r.part * scale, 0)) / scale;
    const toCredit = amountOk ? Math.round((value - onInvoices) * scale) / scale : 0;
    const valid = amountOk && rows.every((r) => r.ok) && toCredit >= 0;
    const money = (n: number) => formatCurrency(n, account.currency);
    const cashCount = useMemo(() => rows.filter((r) => r.part > 0).length, [rows]);

    const submit = async () => {
        if (!valid) return;
        setSaving(true);
        setError(null);
        try {
            await api.post(`/billing/patients/${patientId}/payments`, {
                amount: value,
                method,
                // Today: let the server stamp the actual time, so the statement keeps payments after the invoices they pay.
                ...(date !== toLocalDateString() ? { date } : {}),
                reference: reference.trim() || undefined,
                allocations: rows.filter((r) => r.part > 0).map((r) => ({ invoiceId: r.invoice._id, amount: r.part })),
            });
            onDone();
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{t('account.takePayment')}</DialogTitle>
            <DialogContent>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Grid container spacing={2} sx={{ pt: 1 }}>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            autoFocus
                            fullWidth
                            required
                            type="number"
                            label={t('billing.amount')}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            error={amount !== '' && !amountOk}
                            InputProps={{ endAdornment: <InputAdornment position="end">{account.currency}</InputAdornment> }}
                            inputProps={{ min: 0, step: digits ? 0.01 : 1 }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField select fullWidth label={t('billing.paymentMethod')} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                            {PAYMENT_METHODS.map((m) => (
                                <MenuItem key={m} value={m}>
                                    {t(paymentMethodKey(m))}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            type="date"
                            label={t('common.date')}
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ max: toLocalDateString() }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField fullWidth label={t('billing.reference')} value={reference} onChange={(e) => setReference(e.target.value)} inputProps={{ maxLength: 100 }} />
                    </Grid>
                </Grid>

                {account.openInvoices.length > 0 ? (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                            {t('account.spreadOver')}
                        </Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('billing.invoiceNumber')}</TableCell>
                                    <TableCell align="right">{t('billing.balance')}</TableCell>
                                    <TableCell align="right" sx={{ width: 150 }}>{t('account.pay')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {rows.map(({ invoice, raw, ok }) => (
                                    <TableRow key={invoice._id}>
                                        <TableCell>
                                            {invoice.invoiceNumber}
                                            {invoice.issuedAt && (
                                                <Typography variant="caption" color="text.secondary" component="div">
                                                    {formatDate(invoice.issuedAt, 'dd.MM.yyyy', i18n.language)}
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(invoice.balance)}</TableCell>
                                        <TableCell align="right">
                                            <TextField
                                                size="small"
                                                type="number"
                                                value={raw}
                                                error={!ok}
                                                onChange={(e) => {
                                                    setEdited(true);
                                                    setParts((p) => ({ ...p, [invoice._id]: e.target.value }));
                                                }}
                                                inputProps={{ min: 0, max: invoice.balance, step: digits ? 0.01 : 1, 'aria-label': invoice.invoiceNumber }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Box>
                ) : (
                    <Alert severity="info" sx={{ mt: 2 }}>{t('account.noOpenInvoices')}</Alert>
                )}

                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                    <Typography variant="body2">
                        {t('account.onInvoices', { count: cashCount })}: <strong>{money(onInvoices)}</strong>
                    </Typography>
                    <Typography variant="body2" color={toCredit < 0 ? 'error.main' : 'text.primary'}>
                        {t('account.toCredit')}: <strong>{money(Math.max(0, toCredit))}</strong>
                    </Typography>
                    {toCredit < 0 && <Typography variant="caption" color="error">{t('account.partsTooHigh')}</Typography>}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
                <Button variant="contained" onClick={submit} disabled={!valid || saving}>
                    {saving ? t('common.loading') : t('account.record')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default TakePaymentDialog;
