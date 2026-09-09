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
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import { patientsActions } from '../../store/patients';
import {
    PageHeader,
    ChipInput,
    PhotoUpload,
    DuplicatePatientWarning,
} from '../../components/ui';
import { useHttpState } from '../../hooks';
import { getInitials } from '../../utils/formatters';
import { EMAIL_PATTERN, isArmenianPhone } from '../../utils/validators';
import { PatientFormData, emptyPatientForm, toPatientPayload } from './patientForm';

const PatientCreatePage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { loading, success, clearSuccess } = useHttpState('CREATE_PATIENT');

    const {
        control,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<PatientFormData>({ defaultValues: emptyPatientForm });

    const firstName = watch('firstName');
    const lastName = watch('lastName');
    const dateOfBirth = watch('dateOfBirth');

    useEffect(() => {
        if (success) {
            clearSuccess();
            navigate('/patients');
        }
    }, [success, navigate, clearSuccess]);

    const onSubmit = (data: PatientFormData) => {
        dispatch(patientsActions.createPatient(toPatientPayload(data) as any));
    };

    const today = new Date().toISOString().slice(0, 10);

    return (
        <Box sx={{ maxWidth: '100%', overflowX: 'hidden' }}>
            <PageHeader
                title={t('patients.addPatient')}
                subtitle={t('common.requiredFieldsHint')}
            >
                <Button
                    variant="outlined"
                    startIcon={<BackIcon />}
                    onClick={() => navigate('/patients')}
                >
                    {t('common.back')}
                </Button>
            </PageHeader>

            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                <DuplicatePatientWarning
                    firstName={firstName}
                    lastName={lastName}
                    dateOfBirth={dateOfBirth}
                    onOpen={(patientId) => navigate(`/patients/${patientId}`)}
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
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.contactName')}
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
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.insuranceProvider')}
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
                    <Button variant="outlined" onClick={() => navigate('/patients')}>
                        {t('common.cancel')}
                    </Button>
                    <Button type="submit" variant="contained" disabled={loading}>
                        {loading ? t('common.loading') : t('common.save')}
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default PatientCreatePage;
