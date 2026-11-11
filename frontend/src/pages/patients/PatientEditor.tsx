import React, { useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    CardHeader,
    Grid,
    TextField,
    Button,
    RadioGroup,
    FormControlLabel,
    Radio,
    FormControl,
    FormLabel,
    FormHelperText,
    Typography,
} from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { PageHeader, ChipInput, PhotoUpload, DuplicatePatientWarning } from '../../components/ui';
import { usePermission } from '../../hooks';
import { getInitials } from '../../utils/formatters';
import { EMAIL_PATTERN, isArmenianPhone } from '../../utils/validators';
import { PatientFormData, emptyPatientForm, toPatientPayload } from './patientForm';
import { toLocalDateString } from '../../utils/dates';

export type PatientPayload = ReturnType<typeof toPatientPayload>;

interface PatientFormProps {
    title: string;
    /** Empty for a new patient; the loaded patient when editing. */
    defaultValues?: PatientFormData;
    /** The patient being edited, so the duplicate check doesn't flag itself. */
    patientId?: string;
    saving: boolean;
    onSubmit: (payload: Partial<PatientPayload>) => void;
    onCancel: () => void;
}

/**
 * The patient form, shared by "Add patient" and "Edit patient" — they used to
 * be two ~600-line copies that had already started to drift apart.
 *
 * Medical history is read-only for roles that may not change it (the API
 * refuses it from them), and is then left out of the payload.
 */
const PatientEditor: React.FC<PatientFormProps> = ({
    title,
    defaultValues = emptyPatientForm,
    patientId,
    saving,
    onSubmit,
    onCancel,
}) => {
    const { t } = useTranslation();
    const can = usePermission();
    const canEditClinical = can('editClinicalRecords');

    const {
        control,
        handleSubmit,
        watch,
        reset,
        formState: { errors },
    } = useForm<PatientFormData>({ defaultValues });

    // Edit mode receives the patient after the first render.
    useEffect(() => {
        reset(defaultValues);
    }, [defaultValues, reset]);

    const firstName = watch('firstName');
    const lastName = watch('lastName');
    const dateOfBirth = watch('dateOfBirth');
    const phone = watch('phone');
    const email = watch('email');
    const emergencyPhone = watch('emergencyPhone');
    const emergencyRelationship = watch('emergencyRelationship');
    const insuranceDetailsFilled = !!(watch('policyNumber') || watch('groupNumber') || watch('expirationDate'));

    const submit = (data: PatientFormData) => {
        const { medicalHistory, ...rest } = toPatientPayload(data);
        onSubmit(canEditClinical ? { ...rest, medicalHistory } : rest);
    };

    const today = toLocalDateString();

    return (
        <Box sx={{ maxWidth: '100%', overflowX: 'hidden' }}>
            <PageHeader title={title} subtitle={t('common.requiredFieldsHint')}>
                <Button variant="outlined" startIcon={<BackIcon />} onClick={onCancel}>
                    {t('common.back')}
                </Button>
            </PageHeader>

            <Box component="form" onSubmit={handleSubmit(submit)} noValidate>
                <DuplicatePatientWarning
                    firstName={firstName}
                    lastName={lastName}
                    dateOfBirth={dateOfBirth}
                    phone={phone}
                    email={email}
                    excludeId={patientId}
                />

                {/* Personal Information */}
                <Card sx={{ mb: 3 }}>
                    <CardHeader
                        title={
                            <Typography variant="h6" fontWeight={600}>
                                {t('patients.patientProfile')}
                            </Typography>
                        }
                    />
                    <CardContent>
                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <Controller
                                    name="photo"
                                    control={control}
                                    render={({ field }) => (
                                        <PhotoUpload
                                            value={field.value}
                                            onChange={field.onChange}
                                            initials={getInitials(firstName, lastName)}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="firstName"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            required
                                            fullWidth
                                            size="small"
                                            label={t('patients.firstName')}
                                            error={!!errors.firstName}
                                            helperText={errors.firstName?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="lastName"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            required
                                            fullWidth
                                            size="small"
                                            label={t('patients.lastName')}
                                            error={!!errors.lastName}
                                            helperText={errors.lastName?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="patronymic"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.patronymic')}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="dateOfBirth"
                                    control={control}
                                    rules={{
                                        required: t('validation.required'),
                                        validate: (value) =>
                                            !value || value <= today || t('validation.futureDate'),
                                    }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            required
                                            fullWidth
                                            size="small"
                                            label={t('patients.dateOfBirth')}
                                            type="date"
                                            inputProps={{ max: today }}
                                            InputLabelProps={{ shrink: true }}
                                            error={!!errors.dateOfBirth}
                                            helperText={errors.dateOfBirth?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="phone"
                                    control={control}
                                    rules={{
                                        required: t('validation.required'),
                                        validate: (value) =>
                                            isArmenianPhone(value) ||
                                            t('validation.invalidArmenianPhone'),
                                    }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            required
                                            fullWidth
                                            size="small"
                                            label={t('patients.phone')}
                                            placeholder="+374 93 123456"
                                            error={!!errors.phone}
                                            helperText={
                                                errors.phone?.message ||
                                                t('validation.invalidArmenianPhone')
                                            }
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="email"
                                    control={control}
                                    rules={{
                                        pattern: {
                                            value: EMAIL_PATTERN,
                                            message: t('validation.invalidEmail'),
                                        },
                                    }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.email')}
                                            type="email"
                                            error={!!errors.email}
                                            helperText={errors.email?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Controller
                                    name="gender"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <FormControl error={!!errors.gender}>
                                            <FormLabel required>{t('patients.gender')}</FormLabel>
                                            <RadioGroup row {...field}>
                                                <FormControlLabel
                                                    value="male"
                                                    control={<Radio size="small" />}
                                                    label={t('patients.male')}
                                                />
                                                <FormControlLabel
                                                    value="female"
                                                    control={<Radio size="small" />}
                                                    label={t('patients.female')}
                                                />
                                                <FormControlLabel
                                                    value="other"
                                                    control={<Radio size="small" />}
                                                    label={t('patients.other')}
                                                />
                                            </RadioGroup>
                                            {errors.gender && (
                                                <FormHelperText>{errors.gender.message}</FormHelperText>
                                            )}
                                        </FormControl>
                                    )}
                                />
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                {/* Address */}
                <Card sx={{ mb: 3 }}>
                    <CardHeader
                        title={
                            <Typography variant="h6" fontWeight={600}>
                                {t('patients.address')}
                            </Typography>
                        }
                    />
                    <CardContent>
                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <Controller
                                    name="street"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.street')}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                                <Controller
                                    name="city"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.city')}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                                <Controller
                                    name="state"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.state')}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                                <Controller
                                    name="zipCode"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.zipCode')}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                                <Controller
                                    name="country"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.country')}
                                        />
                                    )}
                                />
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                {/* Emergency Contact */}
                <Card sx={{ mb: 3 }}>
                    <CardHeader
                        title={
                            <Typography variant="h6" fontWeight={600}>
                                {t('patients.emergencyContact')}
                            </Typography>
                        }
                    />
                    <CardContent>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="emergencyName"
                                    control={control}
                                    // Without a name the contact is not saved, so a typed phone would be lost silently.
                                    rules={{
                                        validate: (value) =>
                                            !!value?.trim() ||
                                            !(emergencyPhone?.trim() || emergencyRelationship?.trim()) ||
                                            t('validation.emergencyNameRequired'),
                                    }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.contactName')}
                                            error={!!errors.emergencyName}
                                            helperText={errors.emergencyName?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="emergencyRelationship"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.relationship')}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="emergencyPhone"
                                    control={control}
                                    rules={{
                                        validate: (value) =>
                                            !value ||
                                            isArmenianPhone(value) ||
                                            t('validation.invalidArmenianPhone'),
                                    }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.phone')}
                                            placeholder="+374 93 123456"
                                            error={!!errors.emergencyPhone}
                                            helperText={errors.emergencyPhone?.message}
                                        />
                                    )}
                                />
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                {/* Medical History */}
                <Card sx={{ mb: 3 }}>
                    <CardHeader
                        title={
                            <Typography variant="h6" fontWeight={600}>
                                {t('patients.medicalHistory')}
                            </Typography>
                        }
                        subheader={canEditClinical ? undefined : t('patients.medicalHistoryReadOnly')}
                    />
                    <CardContent>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="conditions"
                                    control={control}
                                    render={({ field }) => (
                                        <ChipInput
                                            value={field.value}
                                            onChange={field.onChange}
                                            label={t('patients.conditions')}
                                            disabled={!canEditClinical}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="allergies"
                                    control={control}
                                    render={({ field }) => (
                                        <ChipInput
                                            value={field.value}
                                            onChange={field.onChange}
                                            label={t('patients.allergies')}
                                            disabled={!canEditClinical}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="medications"
                                    control={control}
                                    render={({ field }) => (
                                        <ChipInput
                                            value={field.value}
                                            onChange={field.onChange}
                                            label={t('patients.medications')}
                                            disabled={!canEditClinical}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Controller
                                    name="medicalNotes"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.medicalNotes')}
                                            multiline
                                            rows={3}
                                            disabled={!canEditClinical}
                                        />
                                    )}
                                />
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                {/* Insurance */}
                <Card sx={{ mb: 3 }}>
                    <CardHeader
                        title={
                            <Typography variant="h6" fontWeight={600}>
                                {t('patients.insurance')}
                            </Typography>
                        }
                    />
                    <CardContent>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="insuranceProvider"
                                    control={control}
                                    // Insurance is saved only with a provider; don't drop a typed policy number.
                                    rules={{
                                        validate: (value) =>
                                            !!value?.trim() || !insuranceDetailsFilled || t('validation.insuranceProviderRequired'),
                                    }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.insuranceProvider')}
                                            error={!!errors.insuranceProvider}
                                            helperText={errors.insuranceProvider?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="policyNumber"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.policyNumber')}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="groupNumber"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.groupNumber')}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="expirationDate"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.expirationDate')}
                                            type="date"
                                            InputLabelProps={{ shrink: true }}
                                        />
                                    )}
                                />
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                {/* Internal notes */}
                <Card sx={{ mb: 3 }}>
                    <CardHeader
                        title={
                            <Typography variant="h6" fontWeight={600}>
                                {t('patients.internalNotes')}
                            </Typography>
                        }
                        subheader={t('patients.internalNotesHint')}
                    />
                    <CardContent>
                        <Controller
                            name="notes"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    fullWidth
                                    size="small"
                                    label={t('patients.notes')}
                                    multiline
                                    rows={3}
                                />
                            )}
                        />
                    </CardContent>
                </Card>

                {/* Submit */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                    <Button variant="outlined" onClick={onCancel}>
                        {t('common.cancel')}
                    </Button>
                    <Button type="submit" variant="contained" disabled={saving}>
                        {saving ? t('common.loading') : t('common.save')}
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default PatientEditor;
