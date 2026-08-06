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
    Chip,
    Typography,
} from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import { RootState } from '../../store';
import { patientsActions } from '../../store/patients';
import { PageHeader, LoadingSpinner } from '../../components/ui';
import { useHttpState } from '../../hooks';

interface PatientFormData {
    firstName: string;
    lastName: string;
    patronymic: string;
    dateOfBirth: string;
    gender: 'male' | 'female' | 'other';
    phone: string;
    email: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    emergencyName: string;
    emergencyRelationship: string;
    emergencyPhone: string;
    conditions: string[];
    allergies: string[];
    medications: string[];
    medicalNotes: string;
    insuranceProvider: string;
    policyNumber: string;
    groupNumber: string;
    expirationDate: string;
}

const ChipInput: React.FC<{
    value: string[];
    onChange: (val: string[]) => void;
    label: string;
    placeholder?: string;
}> = ({ value, onChange, label, placeholder }) => {
    const [inputValue, setInputValue] = React.useState('');

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inputValue.trim()) {
            e.preventDefault();
            if (!value.includes(inputValue.trim())) {
                onChange([...value, inputValue.trim()]);
            }
            setInputValue('');
        }
    };

    const handleDelete = (chipToDelete: string) => {
        onChange(value.filter((chip) => chip !== chipToDelete));
    };

    return (
        <Box>
            <TextField
                fullWidth
                size="small"
                label={label}
                placeholder={placeholder || label}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                helperText="Press Enter to add"
            />
            {value.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                    {value.map((chip) => (
                        <Chip
                            key={chip}
                            label={chip}
                            size="small"
                            onDelete={() => handleDelete(chip)}
                        />
                    ))}
                </Box>
            )}
        </Box>
    );
};

const PatientEditPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { id } = useParams<{ id: string }>();

    const patient = useSelector((state: RootState) => state.patients.current);
    const patientLoading = useSelector((state: RootState) => state.http.loading.includes('GET_PATIENT'));
    const { loading, success } = useHttpState('UPDATE_PATIENT');

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<PatientFormData>();

    useEffect(() => {
        if (id) {
            dispatch(patientsActions.getPatient(id));
        }
    }, [id, dispatch]);

    useEffect(() => {
        if (patient) {
            reset({
                firstName: patient.firstName || '',
                lastName: patient.lastName || '',
                patronymic: patient.patronymic || '',
                dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.substring(0, 10) : '',
                gender: patient.gender || 'male',
                phone: patient.phone || '',
                email: patient.email || '',
                street: patient.address?.street || '',
                city: patient.address?.city || '',
                state: patient.address?.state || '',
                zipCode: patient.address?.zipCode || '',
                country: patient.address?.country || '',
                emergencyName: patient.emergencyContact?.name || '',
                emergencyRelationship: patient.emergencyContact?.relationship || '',
                emergencyPhone: patient.emergencyContact?.phone || '',
                conditions: patient.medicalHistory?.conditions || [],
                allergies: patient.medicalHistory?.allergies || [],
                medications: patient.medicalHistory?.medications || [],
                medicalNotes: patient.medicalHistory?.notes || '',
                insuranceProvider: patient.insurance?.provider || '',
                policyNumber: patient.insurance?.policyNumber || '',
                groupNumber: patient.insurance?.groupNumber || '',
                expirationDate: patient.insurance?.expirationDate
                    ? patient.insurance.expirationDate.substring(0, 10)
                    : '',
            });
        }
    }, [patient, reset]);

    useEffect(() => {
        if (success) {
            navigate(`/patients/${id}`);
        }
    }, [success, id, navigate]);

    const onSubmit = (data: PatientFormData) => {
        if (!id) return;
        dispatch(
            patientsActions.updatePatient({
                id,
                data: {
                    firstName: data.firstName,
                    lastName: data.lastName,
                    patronymic: data.patronymic || undefined,
                    dateOfBirth: data.dateOfBirth,
                    gender: data.gender,
                    phone: data.phone,
                    email: data.email || undefined,
                    address: {
                        street: data.street || undefined,
                        city: data.city || undefined,
                        state: data.state || undefined,
                        zipCode: data.zipCode || undefined,
                        country: data.country || undefined,
                    },
                    emergencyContact: data.emergencyName
                        ? {
                              name: data.emergencyName,
                              relationship: data.emergencyRelationship,
                              phone: data.emergencyPhone,
                          }
                        : undefined,
                    medicalHistory: {
                        conditions: data.conditions,
                        allergies: data.allergies,
                        medications: data.medications,
                        notes: data.medicalNotes || undefined,
                    },
                    insurance: data.insuranceProvider
                        ? {
                              provider: data.insuranceProvider,
                              policyNumber: data.policyNumber,
                              groupNumber: data.groupNumber || undefined,
                              expirationDate: data.expirationDate || undefined,
                          }
                        : undefined,
                },
            }),
        );
    };

    if (patientLoading || !patient) {
        return <LoadingSpinner fullPage />;
    }

    return (
        <Box>
            <PageHeader title={`${t('common.edit')} - ${patient.firstName} ${patient.lastName}`}>
                <Button
                    variant="outlined"
                    startIcon={<BackIcon />}
                    onClick={() => navigate(`/patients/${id}`)}
                >
                    {t('common.back')}
                </Button>
            </PageHeader>

            <Box component="form" onSubmit={handleSubmit(onSubmit)}>
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
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="firstName"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
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
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.dateOfBirth')}
                                            type="date"
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
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.phone')}
                                            error={!!errors.phone}
                                            helperText={errors.phone?.message}
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
                                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
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
                                            <FormLabel>{t('patients.gender')}</FormLabel>
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
                                            label={t('patients.address')}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="city"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField {...field} fullWidth size="small" label="City" />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="state"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField {...field} fullWidth size="small" label="State / Province" />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="zipCode"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField {...field} fullWidth size="small" label="Zip Code" />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="country"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField {...field} fullWidth size="small" label="Country" />
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
                                            label={t('patients.firstName')}
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
                                            label="Relationship"
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="emergencyPhone"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            size="small"
                                            label={t('patients.phone')}
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
                                            label={t('patients.medicalHistory')}
                                            placeholder="Conditions"
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
                                            label={t('patients.notes')}
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
                                            label="Provider"
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
                                            label="Policy Number"
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
                                            label="Group Number"
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
                                            label="Expiration Date"
                                            type="date"
                                            InputLabelProps={{ shrink: true }}
                                        />
                                    )}
                                />
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                {/* Submit */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                    <Button variant="outlined" onClick={() => navigate(`/patients/${id}`)}>
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

export default PatientEditPage;
