import React, { useEffect, useMemo, useState } from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    Checkbox,
    FormControlLabel,
    FormGroup,
    Grid,
    MenuItem,
    TextField,
    Typography,
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    AddCircleOutline as AddCircleIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { dentalRecordsActions } from '../../store/dental-records';
import { treatmentsActions } from '../../store/treatments';
import { staffActions } from '../../store/staff';
import { useHttpState } from '../../hooks';
import { TOOTH_SURFACES } from '../../utils/constants';
import { Currency, ToothSurface, Treatment } from '../../types';
import { staffRefId } from '../../utils/staff';

const CURRENCIES: Currency[] = ['AMD', 'USD', 'RUB'];

const surfaceTranslationKeys: Record<string, string> = {
    mesial: 'dental.mesial',
    distal: 'dental.distal',
    occlusal: 'dental.occlusal',
    incisal: 'dental.incisal',
    buccal: 'dental.buccal',
    lingual: 'dental.lingual',
    palatal: 'dental.palatal',
    cervical: 'dental.cervical',
};

interface ToothTreatmentFormProps {
    patientId: string;
    toothNumber: number;
    /** Prefills the surface checkboxes from the tooth's current state. */
    defaultSurfaces?: ToothSurface[];
}

const ToothTreatmentForm: React.FC<ToothTreatmentFormProps> = ({
    patientId,
    toothNumber,
    defaultSurfaces = [],
}) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();

    const treatments = useSelector((state: RootState) => state.treatments.list);
    const dentists = useSelector((state: RootState) => state.staff.dentists);
    const clinic = useSelector((state: RootState) => state.clinic.clinic);
    const currentUser = useSelector((state: RootState) => state.auth.user);
    const { loading, success, clearSuccess } = useHttpState('ADD_ENTRY');

    const [expanded, setExpanded] = useState(false);
    const [treatmentId, setTreatmentId] = useState('');
    const [treatmentName, setTreatmentName] = useState('');
    const [dentistId, setDentistId] = useState('');
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [surfaces, setSurfaces] = useState<ToothSurface[]>(defaultSurfaces);
    const [cost, setCost] = useState('');
    const [currency, setCurrency] = useState<Currency>('AMD');
    const [notes, setNotes] = useState('');
    const [nameError, setNameError] = useState(false);

    const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

    // Only fetch the pickers' data once — the drawer remounts on every open.
    useEffect(() => {
        if (treatments.length === 0) dispatch(treatmentsActions.getTreatments({ limit: 100 }));
        if (dentists.length === 0) dispatch(staffActions.getDentists());
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setCurrency((clinic?.currency as Currency) || 'AMD');
    }, [clinic?.currency]);

    // Default to the logged-in dentist when they are one of the clinic's dentists.
    useEffect(() => {
        if (dentistId || dentists.length === 0) return;
        const self = dentists.find(
            (d: any) => d._id === currentUser?._id || staffRefId(d) === currentUser?._id,
        );
        setDentistId(staffRefId(self) || staffRefId(dentists[0]));
    }, [dentists, currentUser?._id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Surfaces follow the tooth the drawer is showing.
    useEffect(() => {
        setSurfaces(defaultSurfaces);
    }, [toothNumber]); // eslint-disable-line react-hooks/exhaustive-deps

    const resetForm = () => {
        setTreatmentId('');
        setTreatmentName('');
        setCost('');
        setNotes('');
        setNameError(false);
        setDate(new Date().toISOString().slice(0, 10));
    };

    useEffect(() => {
        if (success) {
            clearSuccess();
            resetForm();
            setExpanded(false);
        }
    }, [success]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleTreatmentSelect = (value: string) => {
        setTreatmentId(value);

        const picked = treatments.find((tr: Treatment) => tr._id === value);
        if (picked) {
            setTreatmentName(picked.name || picked.nameHy || picked.nameRu || '');
            if (picked.price?.amount !== undefined) {
                setCost(String(picked.price.amount));
            }
            if (picked.price?.currency) {
                setCurrency(picked.price.currency);
            }
            setNameError(false);
        }
    };

    const handleSurfaceToggle = (surface: ToothSurface) => {
        setSurfaces((prev) =>
            prev.includes(surface) ? prev.filter((s) => s !== surface) : [...prev, surface],
        );
    };

    const handleSubmit = () => {
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
                    toothNumber,
                    treatmentName: name,
                    treatmentId: treatmentId || undefined,
                    dentistId: dentistId || undefined,
                    date: date || undefined,
                    surfaces,
                    notes: notes.trim() || undefined,
                    cost: Number.isFinite(parsedCost) ? parsedCost : undefined,
                    currency: parsedCost !== undefined ? currency : undefined,
                } as any,
            }),
        );
    };

    return (
        <Accordion
            expanded={expanded}
            onChange={() => setExpanded(!expanded)}
            disableGutters
            sx={{ boxShadow: 'none', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AddCircleIcon fontSize="small" color="primary" />
                    <Typography variant="subtitle2" fontWeight={600}>
                        {t('dental.recordTreatment')}
                    </Typography>
                </Box>
            </AccordionSummary>
            <AccordionDetails>
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <TextField
                            select
                            fullWidth
                            size="small"
                            label={t('dental.selectTreatment')}
                            value={treatmentId}
                            onChange={(e) => handleTreatmentSelect(e.target.value)}
                        >
                            <MenuItem value="">{t('dental.customTreatment')}</MenuItem>
                            {treatments.map((tr: Treatment) => (
                                <MenuItem key={tr._id} value={tr._id}>
                                    {tr.name || tr.nameHy || tr.nameRu}
                                </MenuItem>
                            ))}
                        </TextField>
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
                        />
                    </Grid>

                    <Grid item xs={12}>
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

                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            size="small"
                            type="date"
                            label={t('dental.treatmentDate')}
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            inputProps={{ max: today }}
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
                        <Typography variant="caption" color="text.secondary">
                            {t('dental.surfaces')}
                        </Typography>
                        <FormGroup row>
                            {TOOTH_SURFACES.map((surface) => (
                                <FormControlLabel
                                    key={surface}
                                    sx={{ minWidth: '45%' }}
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={surfaces.includes(surface)}
                                            onChange={() => handleSurfaceToggle(surface)}
                                        />
                                    }
                                    label={
                                        <Typography variant="body2">
                                            {t(surfaceTranslationKeys[surface])}
                                        </Typography>
                                    }
                                />
                            ))}
                        </FormGroup>
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
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? t('common.loading') : t('dental.recordTreatment')}
                        </Button>
                    </Grid>
                </Grid>
            </AccordionDetails>
        </Accordion>
    );
};

export default ToothTreatmentForm;
