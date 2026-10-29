import React, { useEffect, useState, useMemo } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Avatar,
    Tabs,
    Tab,
    Button,
    Chip,
    Paper,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Stack,
    Alert,
    AlertTitle,
} from '@mui/material';
import {
    ArrowBack as BackIcon,
    Edit as EditIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    CalendarMonth as CalendarIcon,
    WarningAmber as WarningIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { patientsActions } from '../../store/patients';
import {
    PageHeader,
    StatusChip,
    EmptyState,
    LoadingSpinner,
} from '../../components/ui';
import {
    formatDate,
    getFullName,
    getInitials,
} from '../../utils/formatters';
import { formatArmenianPhone } from '../../utils/validators';
import { usePermission } from '../../hooks';
import PatientProfileTab from './PatientProfileTab';
import PatientAppointmentsTab from './PatientAppointmentsTab';
import PatientChartTab from './PatientChartTab';
import PatientTreatmentsTab from './PatientTreatmentsTab';
import PatientBillingTab from './PatientBillingTab';
import PatientStatusDialog from './PatientStatusDialog';
import { ChartType, PATIENT_STATUSES, PatientStatus } from '../../types';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

const TABS = { profile: 0, chart: 1, treatments: 2, appointments: 3, billing: 4 } as const;

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
    if (value !== index) return null;
    return <Box sx={{ py: 3 }}>{children}</Box>;
};

const ageFromDateOfBirth = (dateOfBirth: string): number => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

// ── Main Component ──────────────────────────────────────────────────────────

const PatientDetailPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { id } = useParams<{ id: string }>();

    const storedPatient = useSelector((state: RootState) => state.patients.current);
    const loading = useSelector((state: RootState) => state.http.loading.includes('GET_PATIENT'));
    const loadError = useSelector(
        (state: RootState) => state.http.errors.find((e) => e.type === 'GET_PATIENT')?.error,
    );

    // Never render the previously-viewed patient under this URL: switching
    // patients would otherwise flash the wrong person's data (allergies
    // included) for a frame before the fetch starts.
    const patient = storedPatient && storedPatient._id === id ? storedPatient : null;
    const statusLoading = useSelector((state: RootState) =>
        state.http.loading.includes('UPDATE_PATIENT_STATUS'),
    );

    const [tabValue, setTabValue] = useState(0);
    const [pendingStatus, setPendingStatus] = useState<PatientStatus | null>(null);
    const can = usePermission();

    // Primary teeth are normally gone by ~13, so that is the default for a new
    // chart. It is only a starting point — the type can be switched by hand.
    const suggestedChartType: ChartType = useMemo(() => {
        if (!storedPatient?.dateOfBirth) return 'adult';
        return ageFromDateOfBirth(storedPatient.dateOfBirth) < 13 ? 'pediatric' : 'adult';
    }, [storedPatient?.dateOfBirth]);

    useEffect(() => {
        if (id) {
            dispatch(patientsActions.getPatient(id));
        }
    }, [id, dispatch]);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };


    if (!patient) {
        if (loadError && !loading) {
            return (
                <Box>
                    <PageHeader title={t('patients.patientProfile')}>
                        <Button
                            variant="outlined"
                            startIcon={<BackIcon />}
                            onClick={() => navigate('/patients')}
                        >
                            {t('common.back')}
                        </Button>
                    </PageHeader>
                    <EmptyState title={t('patients.notFound')} description={loadError} />
                </Box>
            );
        }
        return <LoadingSpinner fullPage />;
    }


    const currentStatus: PatientStatus =
        patient.status || (patient.isActive ? 'active' : 'inactive');

    return (
        <Box sx={{ maxWidth: '100%', overflowX: 'hidden' }}>
            <PageHeader title={t('patients.patientProfile')}>
                <Button
                    variant="outlined"
                    startIcon={<BackIcon />}
                    onClick={() => navigate('/patients')}
                >
                    {t('common.back')}
                </Button>
            </PageHeader>

            {/* Patient Info Header Card */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: { xs: 'flex-start', md: 'center' },
                            flexDirection: { xs: 'column', md: 'row' },
                            gap: 3,
                        }}
                    >
                        <Avatar
                            src={patient.photo || undefined}
                            sx={{
                                width: 72,
                                height: 72,
                                fontSize: 28,
                                bgcolor: 'primary.main',
                                fontWeight: 700,
                            }}
                        >
                            {getInitials(patient.firstName, patient.lastName)}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
                                <Typography variant="h5" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
                                    {getFullName(patient.firstName, patient.lastName, patient.patronymic)}
                                </Typography>
                                <StatusChip status={currentStatus} translationPrefix="patients" />
                            </Box>
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    gap: 3,
                                    color: 'text.secondary',
                                }}
                            >
                                {patient.dateOfBirth && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <CalendarIcon fontSize="small" />
                                        <Typography variant="body2">
                                            {formatDate(patient.dateOfBirth)} · {t('patients.age')}{' '}
                                            {ageFromDateOfBirth(patient.dateOfBirth)}
                                        </Typography>
                                    </Box>
                                )}
                                {patient.phone && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <PhoneIcon fontSize="small" />
                                        <Typography variant="body2">
                                            {formatArmenianPhone(patient.phone)}
                                        </Typography>
                                    </Box>
                                )}
                                {patient.email && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                                        <EmailIcon fontSize="small" />
                                        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                                            {patient.email}
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
                            {can('editClinicalRecords') && (
                            <FormControl size="small" sx={{ minWidth: 160 }}>
                                <InputLabel>{t('patients.status')}</InputLabel>
                                <Select
                                    value={currentStatus}
                                    label={t('patients.status')}
                                    disabled={statusLoading}
                                    onChange={(e) =>
                                        setPendingStatus(e.target.value as PatientStatus)
                                    }
                                >
                                    {PATIENT_STATUSES.map((status) => (
                                        <MenuItem key={status} value={status}>
                                            {t(`patients.${status}`)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            )}
                            {can('editPatients') && (
                                <Button
                                    variant="outlined"
                                    startIcon={<EditIcon />}
                                    onClick={() => navigate(`/patients/${id}/edit`)}
                                >
                                    {t('common.edit')}
                                </Button>
                            )}
                        </Stack>
                    </Box>
                </CardContent>
            </Card>

            {/* Allergies must be impossible to miss before any treatment. */}
            {!!patient.medicalHistory?.allergies?.length && (
                <Alert
                    severity="error"
                    icon={<WarningIcon />}
                    sx={{ mb: 3, alignItems: 'center' }}
                >
                    <AlertTitle sx={{ mb: 0.5 }}>{t('patients.allergies')}</AlertTitle>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {patient.medicalHistory.allergies.map((allergy) => (
                            <Chip
                                key={allergy}
                                label={allergy}
                                size="small"
                                color="error"
                                sx={{
                                    fontWeight: 600,
                                    maxWidth: '100%',
                                    height: 'auto',
                                    py: 0.25,
                                    '& .MuiChip-label': {
                                        whiteSpace: 'normal',
                                        overflowWrap: 'anywhere',
                                    },
                                }}
                            />
                        ))}
                    </Box>
                </Alert>
            )}

            {/* Tabs */}
            <Paper sx={{ mb: 2 }}>
                <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                >
                    <Tab label={t('patients.patientProfile')} />
                    <Tab label={t('dental.odontogram')} />
                    <Tab label={t('dental.treatmentsTab')} />
                    <Tab label={t('patients.appointmentHistory')} />
                    {can('viewBilling') && <Tab label={t('patients.billingHistory')} />}
                </Tabs>
            </Paper>

            {/* Profile Tab */}
            <TabPanel value={tabValue} index={TABS.profile}>
                <PatientProfileTab patient={patient} />
            </TabPanel>

            <TabPanel value={tabValue} index={TABS.chart}>
                <PatientChartTab patientId={patient._id} suggestedChartType={suggestedChartType} />
            </TabPanel>

            <TabPanel value={tabValue} index={TABS.treatments}>
                <PatientTreatmentsTab patientId={patient._id} />
            </TabPanel>

            {/* Appointments Tab */}
            <TabPanel value={tabValue} index={TABS.appointments}>
                <PatientAppointmentsTab
                    patientId={patient._id}
                    bookable={!['archived', 'deceased'].includes(currentStatus)}
                />
            </TabPanel>

            {can('viewBilling') && (
                <TabPanel value={tabValue} index={TABS.billing}>
                    <PatientBillingTab
                        patientId={patient._id}
                        billable={!['archived', 'deceased'].includes(currentStatus)}
                    />
                </TabPanel>
            )}

            <PatientStatusDialog
                patientId={pendingStatus ? patient._id : null}
                patientName={getFullName(patient.firstName, patient.lastName, patient.patronymic)}
                status={pendingStatus}
                onClose={() => setPendingStatus(null)}
            />
        </Box>
    );
};

export default PatientDetailPage;
