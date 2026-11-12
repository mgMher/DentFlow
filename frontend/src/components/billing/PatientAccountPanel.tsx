import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Collapse,
    Divider,
    Link,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { Payments as PaymentIcon, ExpandMore as MoreIcon, ExpandLess as LessIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { ConfirmDialog } from '../ui';
import { usePermission } from '../../hooks';
import { PatientAccount, StatementLine } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import { paymentMethodKey } from '../../utils/billing';
import { formatCurrency, formatDate } from '../../utils/formatters';
import TakePaymentDialog from './TakePaymentDialog';

const unwrap = (res: { data: any }) => res.data?.data ?? res.data;

/**
 * F4 on the patient's Billing tab: what they owe across invoices, money they
 * have on account, taking one payment over several invoices, refunding
 * credit, and the full statement with a running balance.
 */
const PatientAccountPanel: React.FC<{ patientId: string; onChange?: () => void }> = ({ patientId, onChange }) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const can = usePermission();
    const [account, setAccount] = useState<PatientAccount | null>(null);
    const [statement, setStatement] = useState<StatementLine[] | null>(null);
    const [showStatement, setShowStatement] = useState(false);
    const [paying, setPaying] = useState(false);
    const [refund, setRefund] = useState<PatientAccount['credits'][number] | null>(null);
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const [a, s] = await Promise.all([
                api.get(`/billing/patients/${patientId}/account`),
                api.get(`/billing/patients/${patientId}/statement`),
            ]);
            setAccount(unwrap(a));
            setStatement(unwrap(s).lines);
        } catch (err) {
            setError(apiErrorMessage(err));
        }
    }, [patientId]);

    useEffect(() => {
        load();
    }, [load]);

    if (!account) return error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null;

    const money = (n: number) => formatCurrency(n, account.currency);
    const changed = async () => {
        await load();
        onChange?.();
    };
    const lineLabel = (l: StatementLine) => {
        const number = l.invoiceNumber ?? '';
        switch (l.type) {
            case 'invoice':
                return t('account.lines.invoice', { number });
            case 'invoice_cancelled':
                return t('account.lines.invoiceCancelled', { number });
            case 'payment':
                return l.onAccount
                    ? t('account.lines.onAccount', { method: l.method ? t(paymentMethodKey(l.method)) : '' })
                    : t(l.fromCredit ? 'account.lines.fromCredit' : 'account.lines.payment', {
                          number,
                          method: l.method ? t(paymentMethodKey(l.method)) : '',
                      });
            default:
                return t('account.lines.voided', { number: number || t('account.creditShort') });
        }
    };

    return (
        <Card sx={{ mb: 2 }}>
            <CardContent>
                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
                <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Box>
                        <Typography variant="caption" color="text.secondary">{t('account.outstanding')}</Typography>
                        <Typography fontWeight={600}>{money(account.outstanding)}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">{t('account.credit')}</Typography>
                        <Typography fontWeight={600} color={account.credit > 0 ? 'success.main' : undefined}>{money(account.credit)}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">
                            {account.balance < 0 ? t('account.inCredit') : t('account.owes')}
                        </Typography>
                        <Typography fontWeight={700} color={account.balance > 0 ? 'error.main' : 'success.main'}>
                            {money(Math.abs(account.balance))}
                        </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }} />
                    {can('manageBilling') && (
                        <Button variant="contained" startIcon={<PaymentIcon />} onClick={() => setPaying(true)}>
                            {account.openInvoices.length ? t('account.takePayment') : t('account.advancePayment')}
                        </Button>
                    )}
                </Box>

                {account.credits.length > 0 && (
                    <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" gutterBottom>{t('account.creditsTitle')}</Typography>
                        {account.credits.map((c) => (
                            <Box key={c._id} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 0.5, flexWrap: 'wrap' }}>
                                <Typography variant="body2" sx={{ minWidth: 90 }}>{formatDate(c.date, 'dd.MM.yyyy', i18n.language)}</Typography>
                                <Typography variant="body2" fontWeight={600} sx={{ minWidth: 100 }}>{money(c.amount)}</Typography>
                                <Typography variant="body2" color="text.secondary">{t(paymentMethodKey(c.method))}</Typography>
                                <Box sx={{ flex: 1 }} />
                                {can('billingAdmin') && (
                                    <Button size="small" color="error" onClick={() => { setReason(''); setRefund(c); }}>
                                        {t('account.refund')}
                                    </Button>
                                )}
                            </Box>
                        ))}
                        <Typography variant="caption" color="text.secondary">{t('account.creditHint')}</Typography>
                    </>
                )}

                {statement && statement.length > 0 && (
                    <>
                        <Divider sx={{ my: 2 }} />
                        <Button size="small" onClick={() => setShowStatement((v) => !v)} endIcon={showStatement ? <LessIcon /> : <MoreIcon />}>
                            {t('account.statement')}
                        </Button>
                        <Collapse in={showStatement}>
                            <TableContainer sx={{ overflowX: 'auto', mt: 1 }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>{t('common.date')}</TableCell>
                                            <TableCell>{t('account.description')}</TableCell>
                                            <TableCell align="right">{t('account.charge')}</TableCell>
                                            <TableCell align="right">{t('account.paymentCol')}</TableCell>
                                            <TableCell align="right">{t('billing.balance')}</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {statement.map((l, index) => (
                                            <TableRow key={index}>
                                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(l.date, 'dd.MM.yyyy', i18n.language)}</TableCell>
                                                <TableCell>
                                                    {l.invoiceId ? (
                                                        <Link component="button" variant="body2" onClick={() => navigate(`/billing/${l.invoiceId}`)}>
                                                            {lineLabel(l)}
                                                        </Link>
                                                    ) : (
                                                        lineLabel(l)
                                                    )}
                                                    {l.reason && (
                                                        <Typography variant="caption" color="text.secondary" component="div">{l.reason}</Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{l.charge ? money(l.charge) : ''}</TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{l.payment ? money(l.payment) : ''}</TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{money(l.balance)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Collapse>
                    </>
                )}
            </CardContent>

            <TakePaymentDialog
                open={paying}
                patientId={patientId}
                account={account}
                onClose={() => setPaying(false)}
                onDone={() => {
                    setPaying(false);
                    toast.success(t('toast.saveSuccess'));
                    changed();
                }}
            />

            <ConfirmDialog
                open={!!refund}
                title={t('account.refundTitle')}
                message={refund ? t('account.refundMessage', { amount: money(refund.amount) }) : ''}
                variant="danger"
                confirmLabel={t('account.refund')}
                confirmDisabled={reason.trim().length < 3}
                onConfirm={async () => {
                    if (!refund) return;
                    try {
                        await api.patch(`/billing/patients/${patientId}/credits/${refund._id}/void`, { type: 'refund', reason: reason.trim() });
                        toast.success(t('toast.updateSuccess'));
                        setRefund(null);
                        changed();
                    } catch (err) {
                        setError(apiErrorMessage(err));
                        setRefund(null);
                    }
                }}
                onCancel={() => setRefund(null)}
            >
                <TextField
                    autoFocus
                    fullWidth
                    required
                    size="small"
                    label={t('plans.reason')}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    inputProps={{ maxLength: 500 }}
                    sx={{ mt: 2 }}
                />
            </ConfirmDialog>
        </Card>
    );
};

export default PatientAccountPanel;
