import React, { useEffect, useState, useMemo } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    TextField,
    Button,
    MenuItem,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Divider,
    Autocomplete,
} from '@mui/material';
import {
    ArrowBack as BackIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { billingActions } from '../../store/billing';
import { patientsActions } from '../../store/patients';
import { PageHeader } from '../../components/ui';
import { formatCurrency } from '../../utils/formatters';
import { CURRENCY_SYMBOLS } from '../../utils/constants';
import { Currency, InvoiceItem } from '../../types';

interface LineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
}

const EMPTY_LINE_ITEM: LineItem = {
    description: '',
    quantity: 1,
    unitPrice: 0,
    discount: 0,
};

const CURRENCIES: Currency[] = ['AMD', 'USD', 'RUB'];

const InvoiceCreatePage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { list: patients } = useSelector((state: RootState) => state.patients);
    const loading = useSelector((state: RootState) => state.http.loading.includes('CREATE_INVOICE'));
    const success = useSelector((state: RootState) => state.http.successes.includes('CREATE_INVOICE'));

    const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
    const [currency, setCurrency] = useState<Currency>('AMD');
    const [dueDate, setDueDate] = useState('');
    const [notes, setNotes] = useState('');
    const [lineItems, setLineItems] = useState<LineItem[]>([{ ...EMPTY_LINE_ITEM }]);

    useEffect(() => {
        dispatch(patientsActions.getPatients({ limit: 1000 }));
    }, [dispatch]);

    useEffect(() => {
        if (success) {
            navigate('/billing');
        }
    }, [success, navigate]);

    const handleAddLineItem = () => {
        setLineItems([...lineItems, { ...EMPTY_LINE_ITEM }]);
    };

    const handleRemoveLineItem = (index: number) => {
        if (lineItems.length <= 1) return;
        setLineItems(lineItems.filter((_, i) => i !== index));
    };

    const handleLineItemChange = (index: number, field: keyof LineItem, value: string | number) => {
        const updated = [...lineItems];
        if (field === 'description') {
            updated[index] = { ...updated[index], [field]: value as string };
        } else {
            updated[index] = { ...updated[index], [field]: parseFloat(String(value)) || 0 };
        }
        setLineItems(updated);
    };

    const getLineTotal = (item: LineItem): number => {
        return item.quantity * item.unitPrice - item.discount;
    };

    const calculations = useMemo(() => {
        const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        const discountTotal = lineItems.reduce((sum, item) => sum + item.discount, 0);
        const total = subtotal - discountTotal;
        return { subtotal, discountTotal, total };
    }, [lineItems]);

    const handleSubmit = () => {
        if (!selectedPatient || lineItems.length === 0) return;

        const items: InvoiceItem[] = lineItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            total: getLineTotal(item),
        }));

        dispatch(
            billingActions.createInvoice({
                patientId: selectedPatient,
                items,
                subtotal: calculations.subtotal,
                discountTotal: calculations.discountTotal,
                taxAmount: 0,
                totalAmount: calculations.total,
                paidAmount: 0,
                currency,
                status: 'pending',
                dueDate: dueDate || undefined,
                notes: notes || undefined,
            }),
        );
    };

    const isFormValid =
        selectedPatient &&
        lineItems.length > 0 &&
        lineItems.every((item) => item.description.trim() && item.quantity > 0 && item.unitPrice > 0);

    const patientOptions = patients.map((p) => ({
        label: `${p.lastName} ${p.firstName}${p.patronymic ? ' ' + p.patronymic : ''} - ${p.phone || ''}`,
        value: p._id,
    }));

    return (
        <Box>
            <PageHeader title={t('billing.createInvoice')}>
                <Button variant="text" startIcon={<BackIcon />} onClick={() => navigate('/billing')}>
                    {t('common.back')}
                </Button>
            </PageHeader>

            {/* Patient & Invoice Settings */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <Autocomplete
                            options={patientOptions}
                            getOptionLabel={(option) => option.label}
                            onChange={(_event, newValue) => {
                                setSelectedPatient(newValue?.value || null);
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={t('billing.patient')}
                                    required
                                    fullWidth
                                />
                            )}
                        />
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <TextField
                            label={t('billing.currency')}
                            select
                            fullWidth
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value as Currency)}
                        >
                            {CURRENCIES.map((c) => (
                                <MenuItem key={c} value={c}>
                                    {CURRENCY_SYMBOLS[c]} {c}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <TextField
                            label={t('billing.dueDate')}
                            type="date"
                            fullWidth
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>
                </Grid>
            </Paper>

            {/* Line Items */}
            <Paper sx={{ mb: 3 }}>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">{t('billing.invoices')}</Typography>
                    <Button startIcon={<AddIcon />} onClick={handleAddLineItem}>
                        {t('common.add')}
                    </Button>
                </Box>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: '40%' }}>{t('treatments.description')}</TableCell>
                                <TableCell align="center" sx={{ width: '12%' }}>
                                    {t('billing.quantity')}
                                </TableCell>
                                <TableCell align="right" sx={{ width: '18%' }}>
                                    {t('treatments.price')}
                                </TableCell>
                                <TableCell align="right" sx={{ width: '15%' }}>
                                    {t('billing.discount')}
                                </TableCell>
                                <TableCell align="right" sx={{ width: '12%' }}>
                                    {t('billing.totalAmount')}
                                </TableCell>
                                <TableCell align="center" sx={{ width: '3%' }} />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {lineItems.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            value={item.description}
                                            onChange={(e) =>
                                                handleLineItemChange(index, 'description', e.target.value)
                                            }
                                            placeholder={t('treatments.description')}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) =>
                                                handleLineItemChange(index, 'quantity', e.target.value)
                                            }
                                            inputProps={{ min: 1 }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            type="number"
                                            value={item.unitPrice}
                                            onChange={(e) =>
                                                handleLineItemChange(index, 'unitPrice', e.target.value)
                                            }
                                            inputProps={{ min: 0, step: 0.01 }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            type="number"
                                            value={item.discount}
                                            onChange={(e) =>
                                                handleLineItemChange(index, 'discount', e.target.value)
                                            }
                                            inputProps={{ min: 0, step: 0.01 }}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="body2" fontWeight={600}>
                                            {formatCurrency(getLineTotal(item), currency)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => handleRemoveLineItem(index)}
                                            disabled={lineItems.length <= 1}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
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
                                {formatCurrency(calculations.subtotal, currency)}
                            </Typography>
                        </Box>
                        {calculations.discountTotal > 0 && (
                            <Box sx={{ display: 'flex', gap: 4, minWidth: 300 }}>
                                <Typography color="text.secondary">{t('billing.discount')}:</Typography>
                                <Typography sx={{ ml: 'auto', color: 'error.main' }}>
                                    -{formatCurrency(calculations.discountTotal, currency)}
                                </Typography>
                            </Box>
                        )}
                        <Divider sx={{ width: 300 }} />
                        <Box sx={{ display: 'flex', gap: 4, minWidth: 300 }}>
                            <Typography fontWeight={700}>{t('billing.totalAmount')}:</Typography>
                            <Typography sx={{ ml: 'auto' }} fontWeight={700}>
                                {formatCurrency(calculations.total, currency)}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            </Paper>

            {/* Notes */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <TextField
                    label={t('patients.notes')}
                    fullWidth
                    multiline
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />
            </Paper>

            {/* Submit */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button variant="outlined" onClick={() => navigate('/billing')}>
                    {t('common.cancel')}
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={!isFormValid || loading}
                >
                    {loading ? t('common.loading') : t('billing.createInvoice')}
                </Button>
            </Box>
        </Box>
    );
};

export default InvoiceCreatePage;
