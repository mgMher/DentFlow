import React, { useEffect, useMemo, useState } from 'react';
import {
    Autocomplete,
    Box,
    Button,
    Checkbox,
    FormControlLabel,
    FormGroup,
    Grid,
    MenuItem,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { dentalRecordsActions } from '../../store/dental-records';
import { treatmentsActions } from '../../store/treatments';
import { staffActions } from '../../store/staff';
import { useHttpState } from '../../hooks';
import { Currency, ToothStatus, ToothSurface, Treatment, TreatmentEntryStatus } from '../../types';
import { staffRefId } from '../../utils/staff';
import { toLocalDateString } from '../../utils/dates';
import { localizedTreatmentName } from '../../utils/appointments';
import { ALL_TEETH, TOOTH_STATUSES, surfaceKey, surfacesOf, toothStatusKey } from '../../utils/dental';

const CURRENCIES: Currency[] = ['AMD', 'USD', 'RUB'];

interface TreatmentEntryFormProps {
    patientId: string;
    /** Teeth the form starts with (the tooth whose drawer is open); more can be added for a bridge. */
    initialTeeth?: number[];
    /** Prefills the surfaces when the form is opened from a tooth. */
    defaultSurfaces?: ToothSurface[];
    onSaved?: () => void;
}

/**
 * Records a treatment — done (updates the chart) or planned (a treatment plan
 * item). Works on no tooth (exam, X-ray, cleaning), one, or several (bridge).
 * Picking a catalogue item fills the name, price and what the tooth becomes.
 */
const TreatmentEntryForm: React.FC<TreatmentEntryFormProps> = ({
    patientId,
    initialTeeth = [],
    defaultSurfaces = [],
    onSaved,
}) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();

    const { active: catalogue, activeLoaded } = useSelector((state: RootState) => state.treatments);
    const dentists = useSelector((state: RootState) => state.staff.dentists);
    const clinic = useSelector((state: RootState) => state.clinic.clinic);
    const currentUser = useSelector((state: RootState) => state.auth.user);
    const { loading, success, clearSuccess } = useHttpState('ADD_ENTRY');

    const clinicCurrency = (clinic?.currency as Currency) || 'AMD';
    const today = useMemo(() => toLocalDateString(), []);

    const [picked, setPicked] = useState<Treatment | null>(null);
    const [treatmentName, setTreatmentName] = useState('');
    const [status, setStatus] = useState<TreatmentEntryStatus>('done');
    const [teeth, setTeeth] = useState<number[]>(initialTeeth);
    const [surfaces, setSurfaces] = useState<ToothSurface[]>(defaultSurfaces);
    const [resultStatus, setResultStatus] = useState<ToothStatus | ''>('');
    const [dentistId, setDentistId] = useState('');
    const [date, setDate] = useState(today);
    const [cost, setCost] = useState('');
    const [currency, setCurrency] = useState<Currency>(clinicCurrency);
    const [notes, setNotes] = useState('');
    const [nameError, setNameError] = useState(false);

    useEffect(() => {
        if (!activeLoaded) dispatch(treatmentsActions.getActiveTreatments());
        if (dentists.length === 0) dispatch(staffActions.getDentists());
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Default to the logged-in dentist when they are one of the clinic's dentists.
    useEffect(() => {
        if (dentistId || dentists.length === 0) return;
        const self = dentists.find((d: any) => staffRefId(d) === currentUser?._id || d._id === currentUser?._id);
        setDentistId(staffRefId(self) || staffRefId(dentists[0]));
    }, [dentists, currentUser?._id]); // eslint-disable-line react-hooks/exhaustive-deps

    const reset = () => {
        setPicked(null);
        setTreatmentName('');
        setStatus('done');
        setTeeth(initialTeeth);
        setSurfaces(defaultSurfaces);
        setResultStatus('');
        setDate(today);
        setCost('');
        setCurrency(clinicCurrency);
        setNotes('');
        setNameError(false);
    };

    // The form follows the tooth the drawer is showing.
    useEffect(reset, [initialTeeth.join()]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!success) return;
        clearSuccess();
        reset();
        onSaved?.();
    }, [success]); // eslint-disable-line react-hooks/exhaustive-deps

    const pick = (treatment: Treatment | null) => {
        setPicked(treatment);
        if (!treatment) return;
        setTreatmentName(localizedTreatmentName(treatment));
        setCost(String(treatment.price?.amount ?? ''));
        setCurrency(treatment.price?.currency || clinicCurrency);
        setResultStatus(treatment.toothStatus || '');
        setNameError(false);
    };

    // Surfaces only make sense on a single tooth.
    const surfaceOptions = teeth.length === 1 ? surfacesOf(teeth[0]) : [];

    const submit = () => {
        const name = treatmentName.trim();
        if (!name) {
            setNameError(true);
            return;
        }
        const parsedCost = cost.trim() === '' ? undefined : Number(cost);
        dispatch(
            dentalRecordsActions.addEntry({
                patientId,
                data: {
                    teeth,
                    treatmentName: name,
                    treatmentId: picked?._id,
                    status,
                    resultStatus: teeth.length && resultStatus ? resultStatus : undefined,
                    dentistId: dentistId || undefined,
                    date: date || undefined,
                    surfaces: surfaceOptions.length ? surfaces.filter((s) => surfaceOptions.includes(s)) : [],
                    notes: notes.trim() || undefined,
                    cost: Number.isFinite(parsedCost) ? parsedCost : undefined,
                    currency: parsedCost !== undefined ? currency : undefined,
                },
            }),
        );
    };

    return (
        <Grid container spacing={2}>
            <Grid item xs={12}>
                <ToggleButtonGroup
                    exclusive
                    fullWidth
                    size="small"
                    value={status}
                    onChange={(_, value) => value && setStatus(value)}
                >
                    <ToggleButton value="done">{t('dental.done')}</ToggleButton>
                    <ToggleButton value="planned">{t('dental.planned')}</ToggleButton>
                </ToggleButtonGroup>
            </Grid>

            <Grid item xs={12}>
                <Autocomplete
                    options={catalogue}
                    value={picked}
                    onChange={(_, value) => pick(value)}
                    getOptionLabel={(tr) => localizedTreatmentName(tr)}
                    isOptionEqualToValue={(a, b) => a._id === b._id}
                    renderOption={(props, tr) => (
                        <li {...props} key={tr._id}>
                            <Box>
                                <Typography variant="body2">{localizedTreatmentName(tr)}</Typography>
                                {tr.code && (
                                    <Typography variant="caption" color="text.secondary">
                                        {tr.code}
                                    </Typography>
                                )}
                            </Box>
                        </li>
                    )}
                    renderInput={(params) => (
                        <TextField {...params} size="small" label={t('dental.selectTreatment')} />
                    )}
                />
            </Grid>

            <Grid item xs={12}>
                <TextField
                    required
                    fullWidth
                    size="small"
                    label={t('dental.treatmentName')}
                    value={treatmentName}
                    onChange={(e) => {
                        setTreatmentName(e.target.value);
                        setNameError(false);
                    }}
                    error={nameError}
                    helperText={nameError ? t('validation.required') : undefined}
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
                                                prev.includes(surface)
                                                    ? prev.filter((s) => s !== surface)
                                                    : [...prev, surface],
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
                        helperText={status === 'planned' ? t('dental.resultStatusPlannedHint') : undefined}
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

            <Grid item xs={12} sm={6}>
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

            <Grid item xs={12} sm={6}>
                <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label={status === 'planned' ? t('dental.plannedDate') : t('dental.treatmentDate')}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    inputProps={status === 'done' ? { max: today } : undefined}
                    InputLabelProps={{ shrink: true }}
                />
            </Grid>

            <Grid item xs={7}>
                <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label={t('dental.cost')}
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    inputProps={{ min: 0, step: 'any' }}
                />
            </Grid>
            <Grid item xs={5}>
                <TextField
                    select
                    fullWidth
                    size="small"
                    label={t('billing.currency')}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Currency)}
                >
                    {CURRENCIES.map((code) => (
                        <MenuItem key={code} value={code}>
                            {code}
                        </MenuItem>
                    ))}
                </TextField>
            </Grid>

            <Grid item xs={12}>
                <TextField
                    fullWidth
                    size="small"
                    label={t('patients.notes')}
                    multiline
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    inputProps={{ maxLength: 2000 }}
                />
            </Grid>

            <Grid item xs={12}>
                <Button fullWidth variant="contained" onClick={submit} disabled={loading}>
                    {loading ? t('common.loading') : status === 'planned' ? t('dental.addToPlan') : t('dental.recordTreatment')}
                </Button>
            </Grid>
        </Grid>
    );
};

export default TreatmentEntryForm;
