import React, { useEffect, useState } from 'react';
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
    FormControlLabel,
    FormGroup,
    Grid,
    InputAdornment,
    MenuItem,
    TextField,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { treatmentsActions } from '../../store/treatments';
import { staffActions } from '../../store/staff';
import { ADD_PLAN_ITEM, treatmentPlansActions, UPDATE_PLAN_ITEM } from '../../store/treatment-plans';
import { useHttpState } from '../../hooks';
import { ToothStatus, ToothSurface, Treatment, TreatmentPlan, TreatmentPlanItem } from '../../types';
import { staffRefId } from '../../utils/staff';
import { localizedTreatmentName } from '../../utils/appointments';
import { formatCurrency } from '../../utils/formatters';
import { ALL_TEETH, TOOTH_STATUSES, surfaceKey, surfacesOf, toothStatusKey } from '../../utils/dental';
import { netPrice } from '../../utils/plans';

interface PlanItemDialogProps {
    open: boolean;
    plan: TreatmentPlan;
    /** Edit this item; add a new one when absent. */
    item?: TreatmentPlanItem | null;
    /** Stage a new item starts in (the last one used). */
    defaultStage?: number;
    onClose: () => void;
}

const idOf = (ref: unknown): string | undefined =>
    ref && typeof ref === 'object' ? (ref as { _id: string })._id : (ref as string | undefined);

/** Add or change one treatment on a draft plan: what, which teeth, price and discount, stage. */
const PlanItemDialog: React.FC<PlanItemDialogProps> = ({ open, plan, item, defaultStage = 1, onClose }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { active: catalogue, activeLoaded } = useSelector((state: RootState) => state.treatments);
    const dentists = useSelector((state: RootState) => state.staff.dentists);
    const http = useHttpState(item ? UPDATE_PLAN_ITEM : ADD_PLAN_ITEM);

    const [picked, setPicked] = useState<Treatment | null>(null);
    const [treatmentName, setTreatmentName] = useState('');
    const [teeth, setTeeth] = useState<number[]>([]);
    const [surfaces, setSurfaces] = useState<ToothSurface[]>([]);
    const [resultStatus, setResultStatus] = useState<ToothStatus | ''>('');
    const [dentistId, setDentistId] = useState('');
    const [cost, setCost] = useState('');
    const [discount, setDiscount] = useState('0');
    const [stage, setStage] = useState(String(defaultStage));
    const [notes, setNotes] = useState('');
    const [touched, setTouched] = useState(false);

    useEffect(() => {
        if (!activeLoaded) dispatch(treatmentsActions.getActiveTreatments());
        if (dentists.length === 0) dispatch(staffActions.getDentists());
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Fill the form each time it opens.
    useEffect(() => {
        if (!open) return;
        http.clearError();
        setTouched(false);
        setPicked(item ? catalogue.find((c) => c._id === idOf(item.treatmentId)) ?? null : null);
        setTreatmentName(item?.treatmentName ?? '');
        setTeeth(item?.teeth ?? []);
        setSurfaces(item?.surfaces ?? []);
        setResultStatus(item?.resultStatus ?? '');
        setDentistId(idOf(item?.dentistId) ?? idOf(plan.dentistId) ?? '');
        setCost(item?.cost != null ? String(item.cost) : '');
        setDiscount(String(item?.discount ?? 0));
        setStage(String(item?.stage ?? defaultStage));
        setNotes(item?.notes ?? '');
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!http.success) return;
        http.clearSuccess();
        onClose();
    }, [http.success]); // eslint-disable-line react-hooks/exhaustive-deps

    const pick = (treatment: Treatment | null) => {
        setPicked(treatment);
        if (!treatment) return;
        setTreatmentName(localizedTreatmentName(treatment));
        if (treatment.price?.amount != null) setCost(String(treatment.price.amount));
        setResultStatus(treatment.toothStatus || '');
    };

    const costValue = cost.trim() === '' ? NaN : Number(cost);
    const discountValue = discount.trim() === '' ? 0 : Number(discount);
    const stageValue = Number(stage);
    const nameOk = treatmentName.trim().length > 0;
    const costOk = Number.isFinite(costValue) && costValue >= 0;
    const discountOk = Number.isFinite(discountValue) && discountValue >= 0 && discountValue <= 100;
    const stageOk = Number.isInteger(stageValue) && stageValue >= 1 && stageValue <= 20;
    const valid = nameOk && costOk && discountOk && stageOk;
    const net = costOk && discountOk ? netPrice(costValue, discountValue, plan.currency) : 0;
    const surfaceOptions = teeth.length === 1 ? surfacesOf(teeth[0]) : [];

    const submit = () => {
        setTouched(true);
        if (!valid) return;
        const data = {
            teeth,
            treatmentId: picked?._id,
            treatmentName: treatmentName.trim(),
            surfaces: surfaceOptions.length ? surfaces.filter((s) => surfaceOptions.includes(s)) : [],
            resultStatus: teeth.length && resultStatus ? resultStatus : undefined,
            dentistId: dentistId || undefined,
            cost: costValue,
            discount: discountValue,
            stage: stageValue,
            notes: notes.trim() || undefined,
        };
        dispatch(
            item
                ? treatmentPlansActions.updateItem({ planId: plan._id, itemId: item._id, data })
                : treatmentPlansActions.addItem({ planId: plan._id, data }),
        );
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{item ? t('plans.editItem') : t('plans.addItem')}</DialogTitle>
            <DialogContent>
                {http.error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {http.error}
                    </Alert>
                )}
                <Grid container spacing={2} sx={{ pt: 1 }}>
                    <Grid item xs={12}>
                        <Autocomplete
                            options={catalogue}
                            value={picked}
                            onChange={(_, value) => pick(value)}
                            getOptionLabel={(tr) => localizedTreatmentName(tr)}
                            isOptionEqualToValue={(a, b) => a._id === b._id}
                            renderOption={(props, tr) => (
                                <li {...props} key={tr._id}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                                        <Typography variant="body2">{localizedTreatmentName(tr)}</Typography>
                                        {tr.price?.amount != null && (
                                            <Typography variant="body2" color="text.secondary">
                                                {formatCurrency(tr.price.amount, tr.price.currency)}
                                            </Typography>
                                        )}
                                    </Box>
                                </li>
                            )}
                            renderInput={(params) => <TextField {...params} size="small" label={t('dental.selectTreatment')} />}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            required
                            fullWidth
                            size="small"
                            label={t('dental.treatmentName')}
                            value={treatmentName}
                            onChange={(e) => setTreatmentName(e.target.value)}
                            error={touched && !nameOk}
                            helperText={touched && !nameOk ? t('validation.required') : undefined}
                            inputProps={{ maxLength: 200 }}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <Autocomplete
                            multiple
                            options={ALL_TEETH}
                            value={teeth}
                            onChange={(_, value) => setTeeth([...value].sort((a, b) => a - b))}
                            getOptionLabel={(n) => String(n)}
                            filterSelectedOptions
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    size="small"
                                    label={t('dental.teeth')}
                                    helperText={teeth.length ? undefined : t('dental.teethHelper')}
                                />
                            )}
                        />
                    </Grid>
                    {surfaceOptions.length > 0 && (
                        <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                                {t('dental.surfaces')}
                            </Typography>
                            <FormGroup row>
                                {surfaceOptions.map((surface) => (
                                    <FormControlLabel
                                        key={surface}
                                        sx={{ minWidth: '45%' }}
                                        control={
                                            <Checkbox
                                                size="small"
                                                checked={surfaces.includes(surface)}
                                                onChange={() =>
                                                    setSurfaces((prev) =>
                                                        prev.includes(surface) ? prev.filter((s) => s !== surface) : [...prev, surface],
                                                    )
                                                }
                                            />
                                        }
                                        label={<Typography variant="body2">{t(surfaceKey(surface))}</Typography>}
                                    />
                                ))}
                            </FormGroup>
                        </Grid>
                    )}
                    {teeth.length > 0 && (
                        <Grid item xs={12}>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label={t('dental.resultStatus')}
                                value={resultStatus}
                                onChange={(e) => setResultStatus(e.target.value as ToothStatus | '')}
                                helperText={t('dental.resultStatusPlannedHint')}
                            >
                                <MenuItem value="">{t('dental.noChartChange')}</MenuItem>
                                {TOOTH_STATUSES.map((s) => (
                                    <MenuItem key={s} value={s}>
                                        {t(toothStatusKey(s))}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                    )}
                    <Grid item xs={12} sm={8}>
                        <TextField
                            select
                            fullWidth
                            size="small"
                            label={t('appointments.dentist')}
                            value={dentistId}
                            onChange={(e) => setDentistId(e.target.value)}
                        >
                            {dentists.map((d: any) => (
                                <MenuItem key={d._id} value={staffRefId(d)}>
                                    {d.lastName} {d.firstName}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label={t('plans.stage')}
                            value={stage}
                            onChange={(e) => setStage(e.target.value)}
                            error={touched && !stageOk}
                            helperText={t('plans.stageHint')}
                            inputProps={{ min: 1, max: 20, step: 1 }}
                        />
                    </Grid>
                    <Grid item xs={7}>
                        <TextField
                            required
                            fullWidth
                            size="small"
                            type="number"
                            label={t('plans.price')}
                            value={cost}
                            onChange={(e) => setCost(e.target.value)}
                            error={touched && !costOk}
                            inputProps={{ min: 0, step: 'any' }}
                            InputProps={{ endAdornment: <InputAdornment position="end">{plan.currency}</InputAdornment> }}
                        />
                    </Grid>
                    <Grid item xs={5}>
                        <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label={t('billing.discount')}
                            value={discount}
                            onChange={(e) => setDiscount(e.target.value)}
                            error={touched && !discountOk}
                            inputProps={{ min: 0, max: 100, step: 'any' }}
                            InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            size="small"
                            multiline
                            rows={2}
                            label={t('patients.notes')}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            inputProps={{ maxLength: 2000 }}
                        />
                    </Grid>
                    {costOk && (
                        <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary" textAlign="right">
                                {t('plans.lineTotal')}: <strong>{formatCurrency(net, plan.currency)}</strong>
                            </Typography>
                        </Grid>
                    )}
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('common.cancel')}</Button>
                <Button variant="contained" onClick={submit} disabled={http.loading}>
                    {http.loading ? t('common.loading') : t('common.save')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default PlanItemDialog;
