import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import {
    ArrowBack as BackIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    MedicalServices as TreatmentsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../api/axios';
import { RootState } from '../../store';
import { billingActions, InvoiceItemInput } from '../../store/billing';
import { appointmentsActions } from '../../store/appointments';
import { treatmentsActions } from '../../store/treatments';
import { LoadingSpinner, PageHeader, PatientPicker } from '../../components/ui';
import { useHttpState } from '../../hooks';
import { formatCurrency, formatDate, formatTime } from '../../utils/formatters';
import { appointmentLabel, localizedTreatmentName } from '../../utils/appointments';
import { teethLabel } from '../../utils/dental';
import { fitsCurrency, lineTotal, minorDigits } from '../../utils/billing';
import { Currency, Treatment, TreatmentEntry } from '../../types';

interface Line {
    key: number;
    treatmentId?: string;
    treatmentEntryId?: string;
    description: string;
    quantity: string;
    unitPrice: string;
    discount: string;
}

let nextKey = 1;
const emptyLine = (): Line => ({ key: nextKey++, description: '', quantity: '1', unitPrice: '', discount: '0' });

const num = (value: string) => (value.trim() === '' ? NaN : Number(value));

/**
 * New invoice, or edit a draft (`/billing/:id/edit`). The currency is the
 * clinic's (D3). Lines come from the catalogue, from done treatments on the
 * chart (each billed once), or are typed by hand.
 */
const InvoiceEditorPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const editing = !!id;

    const clinicCurrency = (useSelector((state: RootState) => state.clinic.clinic?.currency) as Currency) || 'AMD';
    const appointments = useSelector((state: RootState) => state.appointments.byPatient);
    const { active: catalogue, activeLoaded } = useSelector((state: RootState) => state.treatments);
    const stored = useSelector((state: RootState) => state.billing.current);
    const createdId = useSelector((state: RootState) => state.billing.createdId);
    const create = useHttpState('CREATE_INVOICE');
    const update = useHttpState('UPDATE_INVOICE');
    const save = editing ? update : create;

    const draft = editing && stored?._id === id ? stored : null;
    const currency: Currency = draft?.currency ?? clinicCurrency;
    const digits = minorDigits(currency);

    const [patientId, setPatientId] = useState<string | null>(searchParams.get('patientId'));
    const [appointmentId, setAppointmentId] = useState<string | null>(null);
    const [dueDate, setDueDate] = useState('');
    const [notes, setNotes] = useState('');
    const [lines, setLines] = useState<Line[]>([emptyLine()]);
    const [touched, setTouched] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [unbilled, setUnbilled] = useState<TreatmentEntry[]>([]);
    const [picked, setPicked] = useState<string[]>([]);
    const filled = useRef(false);

    useEffect(() => {
        create.clearError();
        update.clearError();
        if (!activeLoaded) dispatch(treatmentsActions.getActiveTreatments());
        if (editing) dispatch(billingActions.getInvoice(id));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Editing: fill the form once from the loaded draft.
    useEffect(() => {
        if (!draft || filled.current) return;
        filled.current = true;
        setPatientId(typeof draft.patientId === 'string' ? draft.patientId : draft.patientId._id);
        setAppointmentId(
            draft.appointmentId ? (typeof draft.appointmentId === 'string' ? draft.appointmentId : draft.appointmentId._id) : null,
        );
        setDueDate(draft.dueDate ? draft.dueDate.slice(0, 10) : '');
        setNotes(draft.notes || '');
        setLines(
            draft.items.map((item) => ({
                key: nextKey++,
                treatmentId: typeof item.treatmentId === 'string' ? item.treatmentId : item.treatmentId?._id,
                treatmentEntryId: item.treatmentEntryId,
                description: item.description,
                quantity: String(item.quantity),
                unitPrice: String(item.unitPrice),
                discount: String(item.discount),
            })),
        );
    }, [draft]);

    // The chosen patient's appointments and not-yet-billed treatments.
    useEffect(() => {
        if (!patientId) {
            setUnbilled([]);
            return;
        }
        dispatch(appointmentsActions.getPatientAppointments({ patientId, limit: 100 }));
        let cancelled = false;
        api.get(`/billing/patients/${patientId}/unbilled-treatments`)
            .then((res) => !cancelled && setUnbilled(res.data?.data ?? res.data ?? []))
            .catch(() => !cancelled && setUnbilled([]));
        return () => {
            cancelled = true;
        };
    }, [dispatch, patientId]);

    // Created: open it.
    useEffect(() => {
        if (!createdId) return;
        dispatch(billingActions.clearCreated());
        create.clearSuccess();
        navigate(`/billing/${createdId}`, { replace: true });
    }, [createdId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!update.success) return;
        update.clearSuccess();
        navigate(`/billing/${id}`, { replace: true });
    }, [update.success]); // eslint-disable-line react-hooks/exhaustive-deps

    const appointmentOptions = useMemo(
        () =>
            (patientId && appointments.patientId === patientId ? appointments.list : []).map((appt) => ({
                label: `${formatDate(appt.startTime)} ${formatTime(appt.startTime)} — ${appointmentLabel(appt)}`,
                value: appt._id,
            })),
        [appointments, patientId],
    );

    const setLine = (key: number, patch: Partial<Line>) =>
        setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));

    const pickCatalogue = (key: number, treatment: Treatment) =>
        setLine(key, {
            treatmentId: treatment._id,
            description: localizedTreatmentName(treatment),
            // Only a price in the invoice currency can be used as is.
            unitPrice: treatment.price?.currency === currency ? String(treatment.price.amount) : '',
        });

    const billedHere = lines.map((l) => l.treatmentEntryId).filter(Boolean) as string[];
    const available = unbilled.filter((e) => !billedHere.includes(e._id));

    const addFromTreatments = () => {
        const chosen = available.filter((e) => picked.includes(e._id));
        const catalogueOf = (e: TreatmentEntry) => (typeof e.treatmentId === 'object' ? e.treatmentId : undefined);
        const newLines: Line[] = chosen.map((e) => {
            const fromCatalogue = catalogueOf(e);
            const price =
                e.cost != null && (e.currency ?? currency) === currency
                    ? e.cost
                    : fromCatalogue?.price?.currency === currency
                      ? fromCatalogue.price.amount
                      : undefined;
            const teeth = teethLabel(e.teeth);
            return {
                key: nextKey++,
                treatmentEntryId: e._id,
                treatmentId: fromCatalogue?._id,
                description: teeth ? `${e.treatmentName} — ${teeth}` : e.treatmentName,
                quantity: '1',
                unitPrice: price != null ? String(price) : '',
                discount: '0',
            };
        });
        setLines((prev) => [...prev.filter((l) => l.description.trim() || l.unitPrice.trim()), ...newLines]);
        setPicked([]);
        setPickerOpen(false);
    };

    // Same rounding as the server (whole minor units per line).
    const totals = useMemo(() => {
        let subtotal = 0;
        let discount = 0;
        lines.forEach((l) => {
            const t2 = lineTotal(num(l.quantity), num(l.unitPrice), num(l.discount) || 0, digits);
            subtotal += t2.gross;
            discount += t2.discount;
        });
        return { subtotal, discount, total: subtotal - discount };
    }, [lines, digits]);

    const lineError = (l: Line) => {
        const qty = num(l.quantity);
        const price = num(l.unitPrice);
        const disc = num(l.discount);
        return {
            description: !l.description.trim(),
            quantity: !Number.isInteger(qty) || qty < 1,
            unitPrice: !fitsCurrency(price, digits) || price < 0,
            discount: !Number.isFinite(disc) || disc < 0 || disc > 100,
        };
    };
    const valid = !!patientId && lines.length > 0 && lines.every((l) => !Object.values(lineError(l)).some(Boolean));

    const submit = (issue: boolean) => {
        setTouched(true);
        if (!valid || !patientId) return;
        const items: InvoiceItemInput[] = lines.map((l) => ({
            treatmentId: l.treatmentId,
            treatmentEntryId: l.treatmentEntryId,
            description: l.description.trim(),
            quantity: num(l.quantity),
            unitPrice: num(l.unitPrice),
            discount: num(l.discount) || 0,
        }));
        if (editing && id) {
            dispatch(
                billingActions.updateInvoice({ id, data: { items, dueDate: dueDate || '', notes: notes.trim() } }),
            );
        } else {
            dispatch(
                billingActions.createInvoice({
                    patientId,
                    appointmentId: appointmentId || undefined,
                    items,
                    dueDate: dueDate || undefined,
                    notes: notes.trim() || undefined,
                    issue,
                }),
            );
        }
    };

    if (editing && !draft) return <LoadingSpinner fullPage />;
    if (draft && draft.status !== 'draft') {
        return <Alert severity="info">{t('billing.onlyDraftsEditable')}</Alert>;
    }

    const step = digits ? 10 ** -digits : 1;

    return (
        <Box>
            <PageHeader title={editing ? `${t('billing.editInvoice')} ${draft?.invoiceNumber ?? ''}` : t('billing.createInvoice')}>
                <Button variant="text" startIcon={<BackIcon />} onClick={() => navigate(editing ? `/billing/${id}` : '/billing')}>
                    {t('common.back')}
                </Button>
            </PageHeader>

            {save.error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {save.error}
                </Alert>
            )}

            <Paper sx={{ p: 3, mb: 3 }}>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <PatientPicker
                            value={patientId}
                            onChange={(value) => {
                                setPatientId(value);
                                setAppointmentId(null);
                                // Lines billing the previous patient's treatments no longer apply.
                                setLines((prev) => prev.filter((l) => !l.treatmentEntryId));
                            }}
                            label={t('billing.patient')}
                            required
                            disabled={editing}
                            error={touched && !patientId}
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Autocomplete
                            options={appointmentOptions}
                            getOptionLabel={(option) => option.label}
                            value={appointmentOptions.find((o) => o.value === appointmentId) || null}
                            onChange={(_e, value) => setAppointmentId(value?.value || null)}
                            disabled={!patientId || editing}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={t('billing.appointment')}
                                    placeholder={patientId ? '' : t('billing.selectPatientFirst')}
                                />
                            )}
                        />
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <TextField
                            label={t('billing.currency')}
                            fullWidth
                            value={currency}
                            InputProps={{ readOnly: true }}
                            helperText={t('billing.currencyFromClinic')}
                        />
                    </Grid>
                    <Grid item xs={6} md={3}>
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

            <Paper sx={{ mb: 3 }}>
                <Box sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">{t('billing.lines')}</Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                            startIcon={<TreatmentsIcon />}
                            disabled={!available.length}
                            onClick={() => setPickerOpen(true)}
                        >
                            {t('billing.addFromTreatments', { count: available.length })}
                        </Button>
                        <Button startIcon={<AddIcon />} onClick={() => setLines((prev) => [...prev, emptyLine()])}>
                            {t('billing.addLine')}
                        </Button>
                    </Box>
                </Box>
                <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table size="small" sx={{ minWidth: 760 }}>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ minWidth: 260 }}>{t('treatments.description')}</TableCell>
                                <TableCell align="center" sx={{ width: 90 }}>{t('billing.quantity')}</TableCell>
                                <TableCell align="right" sx={{ width: 140 }}>{t('billing.unitPrice')}</TableCell>
                                <TableCell align="right" sx={{ width: 100 }}>{t('billing.discountPercent')}</TableCell>
                                <TableCell align="right" sx={{ width: 130 }}>{t('billing.lineTotal')}</TableCell>
                                <TableCell sx={{ width: 48 }} />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {lines.map((line) => {
                                const err = touched ? lineError(line) : null;
                                const total = lineTotal(num(line.quantity), num(line.unitPrice), num(line.discount) || 0, digits);
                                return (
                                    <TableRow key={line.key}>
                                        <TableCell>
                                            <Autocomplete
                                                freeSolo
                                                options={catalogue}
                                                inputValue={line.description}
                                                onInputChange={(_e, value, reason) => {
                                                    if (reason === 'input') setLine(line.key, { description: value, treatmentId: undefined });
                                                }}
                                                onChange={(_e, value) => {
                                                    if (value && typeof value === 'object') pickCatalogue(line.key, value);
                                                }}
                                                getOptionLabel={(tr) => (typeof tr === 'string' ? tr : localizedTreatmentName(tr))}
                                                renderOption={(props, tr) => (
                                                    <li {...props} key={tr._id}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                                                            <span>{localizedTreatmentName(tr)}</span>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {formatCurrency(tr.price.amount, tr.price.currency)}
                                                            </Typography>
                                                        </Box>
                                                    </li>
                                                )}
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        size="small"
                                                        placeholder={t('billing.lineDescription')}
                                                        error={err?.description}
                                                        helperText={line.treatmentEntryId ? t('billing.fromChart') : undefined}
                                                        inputProps={{ ...params.inputProps, maxLength: 300 }}
                                                    />
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                size="small"
                                                type="number"
                                                value={line.quantity}
                                                onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                                                error={err?.quantity}
                                                inputProps={{ min: 1, step: 1, 'aria-label': t('billing.quantity') }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                size="small"
                                                type="number"
                                                value={line.unitPrice}
                                                onChange={(e) => setLine(line.key, { unitPrice: e.target.value })}
                                                error={err?.unitPrice}
                                                inputProps={{ min: 0, step, 'aria-label': t('billing.unitPrice') }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                size="small"
                                                type="number"
                                                value={line.discount}
                                                onChange={(e) => setLine(line.key, { discount: e.target.value })}
                                                error={err?.discount}
                                                inputProps={{ min: 0, max: 100, step: 1, 'aria-label': t('billing.discountPercent') }}
                                            />
                                        </TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                                            {formatCurrency(total.total, currency)}
                                        </TableCell>
                                        <TableCell>
                                            <IconButton
                                                size="small"
                                                color="error"
                                                aria-label={t('common.delete')}
                                                onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                                                disabled={lines.length <= 1}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>

                <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                    <Box sx={{ display: 'flex', gap: 4, width: { xs: '100%', sm: 300 } }}>
                        <Typography color="text.secondary">{t('billing.subtotal')}</Typography>
                        <Typography sx={{ ml: 'auto' }}>{formatCurrency(totals.subtotal, currency)}</Typography>
                    </Box>
                    {totals.discount > 0 && (
                        <Box sx={{ display: 'flex', gap: 4, width: { xs: '100%', sm: 300 } }}>
                            <Typography color="text.secondary">{t('billing.discount')}</Typography>
                            <Typography sx={{ ml: 'auto', color: 'error.main' }}>
                                −{formatCurrency(totals.discount, currency)}
                            </Typography>
                        </Box>
                    )}
                    <Divider sx={{ width: { xs: '100%', sm: 300 } }} />
                    <Box sx={{ display: 'flex', gap: 4, width: { xs: '100%', sm: 300 } }}>
                        <Typography fontWeight={700}>{t('billing.totalAmount')}</Typography>
                        <Typography sx={{ ml: 'auto' }} fontWeight={700}>
                            {formatCurrency(totals.total, currency)}
                        </Typography>
                    </Box>
                </Box>
            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
                <TextField
                    label={t('patients.notes')}
                    fullWidth
                    multiline
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    inputProps={{ maxLength: 2000 }}
                />
            </Paper>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
                <Button variant="outlined" onClick={() => navigate(editing ? `/billing/${id}` : '/billing')}>
                    {t('common.cancel')}
                </Button>
                {editing ? (
                    <Button variant="contained" onClick={() => submit(false)} disabled={save.loading}>
                        {save.loading ? t('common.loading') : t('common.save')}
                    </Button>
                ) : (
                    <>
                        <Button variant="outlined" onClick={() => submit(false)} disabled={save.loading}>
                            {t('billing.saveDraft')}
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => submit(true)}
                            disabled={save.loading || totals.total <= 0}
                        >
                            {save.loading ? t('common.loading') : t('billing.createAndIssue')}
                        </Button>
                    </>
                )}
            </Box>

            <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{t('billing.unbilledTreatments')}</DialogTitle>
                <DialogContent dividers>
                    <List dense disablePadding>
                        {available.map((e) => {
                            const checked = picked.includes(e._id);
                            return (
                                <ListItemButton
                                    key={e._id}
                                    onClick={() =>
                                        setPicked((prev) => (checked ? prev.filter((x) => x !== e._id) : [...prev, e._id]))
                                    }
                                >
                                    <ListItemIcon sx={{ minWidth: 36 }}>
                                        <Checkbox edge="start" checked={checked} tabIndex={-1} disableRipple />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={`${e.treatmentName}${e.teeth.length ? ` — ${teethLabel(e.teeth)}` : ''}`}
                                        secondary={`${formatDate(e.date)}${
                                            e.cost != null ? ` · ${formatCurrency(e.cost, e.currency ?? currency)}` : ''
                                        }`}
                                    />
                                </ListItemButton>
                            );
                        })}
                    </List>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button color="inherit" onClick={() => setPickerOpen(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="contained" disabled={!picked.length} onClick={addFromTreatments}>
                        {t('billing.addSelected', { count: picked.length })}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default InvoiceEditorPage;
