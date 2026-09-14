import React, { useEffect, useState, useMemo } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Avatar,
    Tabs,
    Tab,
    Grid,
    Divider,
    Button,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Drawer,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormGroup,
    FormControlLabel,
    Checkbox,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Stack,
    Alert,
    AlertTitle,
    ToggleButton,
    ToggleButtonGroup,
} from '@mui/material';
import {
    ArrowBack as BackIcon,
    Edit as EditIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    CalendarMonth as CalendarIcon,
    Close as CloseIcon,
    Save as SaveIcon,
    History as HistoryIcon,
    WarningAmber as WarningIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { patientsActions } from '../../store/patients';
import { dentalRecordsActions } from '../../store/dental-records';
import { appointmentsActions } from '../../store/appointments';
import { billingActions } from '../../store/billing';
import {
    PageHeader,
    StatusChip,
    EmptyState,
    LoadingSpinner,
    ConfirmDialog,
    ToothTreatmentForm,
    Odontogram,
} from '../../components/ui';
import {
    formatDate,
    formatDateTime,
    formatCurrency,
    getFullName,
    getInitials,
} from '../../utils/formatters';
import { formatArmenianPhone } from '../../utils/validators';
import { TOOTH_STATUS_COLORS, TOOTH_SURFACES } from '../../utils/constants';
import {
    PATIENT_STATUSES,
    PatientStatus,
    ToothStatus,
    ToothSurface,
} from '../../types';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
    if (value !== index) return null;
    return <Box sx={{ py: 3 }}>{children}</Box>;
};

// ── Odontogram constants ───────────────────────────────────────────────────

const ALL_TOOTH_STATUSES: ToothStatus[] = [
    'healthy', 'filled', 'crown', 'missing', 'implant',
    'needs_treatment', 'root_canal', 'decayed', 'bridge', 'veneer',
];

const SURFACE_OPTIONS: ToothSurface[] = [...TOOTH_SURFACES];

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

const entryDentistName = (dentist?: string | { firstName?: string; lastName?: string }): string => {
    if (!dentist || typeof dentist === 'string') return '';
    return getFullName(dentist.firstName || '', dentist.lastName || '');
};

const statusTranslationMap: Record<string, string> = {
    healthy: 'dental.healthy', filled: 'dental.filled', crown: 'dental.crown',
    missing: 'dental.missing', implant: 'dental.implant', needs_treatment: 'dental.needsTreatment',
    root_canal: 'dental.rootCanal', decayed: 'dental.decayed', bridge: 'dental.bridge', veneer: 'dental.veneer',
};

const surfaceTranslationMap: Record<string, string> = {
    mesial: 'dental.mesial', distal: 'dental.distal', occlusal: 'dental.occlusal',
    incisal: 'dental.incisal', buccal: 'dental.buccal', lingual: 'dental.lingual',
    palatal: 'dental.palatal', cervical: 'dental.cervical',
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
    const appointments = useSelector((state: RootState) => state.appointments.list);
    const invoices = useSelector((state: RootState) => state.billing.invoices);
    const chart = useSelector((state: RootState) => state.dentalRecords.chart);
    const toothHistory = useSelector((state: RootState) => state.dentalRecords.toothHistory);
    const appointmentsLoading = useSelector((state: RootState) =>
        state.http.loading.includes('GET_APPOINTMENTS'),
    );
    const invoicesLoading = useSelector((state: RootState) =>
        state.http.loading.includes('GET_INVOICES'),
    );
    const updateToothLoading = useSelector((state: RootState) => state.http.loading.includes('UPDATE_TOOTH'));
    const statusLoading = useSelector((state: RootState) =>
        state.http.loading.includes('UPDATE_PATIENT_STATUS'),
    );

    const [tabValue, setTabValue] = useState(0);
    const [pendingStatus, setPendingStatus] = useState<PatientStatus | null>(null);
    const [statusReason, setStatusReason] = useState('');
    const [pendingChartType, setPendingChartType] = useState<'adult' | 'pediatric' | null>(null);

    // Primary teeth are normally gone by ~13, so that is the default for a new
    // chart. It is only a starting point — the type can be switched by hand.
    const suggestedChartType: 'adult' | 'pediatric' = useMemo(() => {
        if (!storedPatient?.dateOfBirth) return 'adult';
        return ageFromDateOfBirth(storedPatient.dateOfBirth) < 13 ? 'pediatric' : 'adult';
    }, [storedPatient?.dateOfBirth]);

    // Dental chart state
    const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editStatus, setEditStatus] = useState<ToothStatus>('healthy');
    const [editSurfaces, setEditSurfaces] = useState<ToothSurface[]>([]);
    const [editNotes, setEditNotes] = useState('');

    useEffect(() => {
        if (id) {
            dispatch(patientsActions.getPatient(id));
        }
    }, [id, dispatch]);

    // Each tab loads its own data — otherwise the history tables stay empty.
    useEffect(() => {
        if (!id) return;

        if (tabValue === 1) {
            // The chartType hint only applies when the chart is first created;
            // an existing chart keeps whatever type it already has.
            dispatch(
                dentalRecordsActions.getChart({
                    patientId: id,
                    chartType: suggestedChartType,
                }),
            );
        }
        if (tabValue === 2) {
            dispatch(appointmentsActions.getAppointments({ patientId: id, limit: 100 }));
        }
        if (tabValue === 3) {
            dispatch(billingActions.getInvoices({ patientId: id, limit: 100 }));
        }
    }, [tabValue, id, suggestedChartType, dispatch]);

    const teeth = chart?.teeth || [];
    const chartType = (chart?.chartType as 'adult' | 'pediatric') || 'adult';

    const handleToothClick = (toothNumber: number) => {
        setSelectedTooth(toothNumber);
        const toothRecord = teeth.find((tooth) => tooth.toothNumber === toothNumber);
        setEditStatus(toothRecord?.status || 'healthy');
        setEditSurfaces(toothRecord?.surfaces || []);
        setEditNotes(toothRecord?.notes || '');
        if (id) {
            dispatch(dentalRecordsActions.getToothHistory({ patientId: id, toothNumber }));
        }
        setDrawerOpen(true);
    };

    const handleSurfaceToggle = (surface: ToothSurface) => {
        setEditSurfaces((prev) =>
            prev.includes(surface) ? prev.filter((s) => s !== surface) : [...prev, surface],
        );
    };

    const handleSaveTooth = () => {
        if (!id || selectedTooth === null) return;
        dispatch(dentalRecordsActions.updateTooth({
            patientId: id,
            data: { toothNumber: selectedTooth, status: editStatus, surfaces: editSurfaces, notes: editNotes },
        }));
    };

    const handleCloseDrawer = () => {
        setDrawerOpen(false);
        setSelectedTooth(null);
        dispatch(dentalRecordsActions.clearToothHistory());
    };

    // The store only ever holds the selected tooth's timeline, but guard anyway
    // so a stale response can never be shown under the wrong tooth.
    const activeToothHistory =
        toothHistory && toothHistory.toothNumber === selectedTooth ? toothHistory : null;

    const confirmChartTypeChange = () => {
        if (!id || !pendingChartType) return;
        dispatch(dentalRecordsActions.setChartType({ patientId: id, chartType: pendingChartType }));
        setPendingChartType(null);
        setSelectedTooth(null);
        setDrawerOpen(false);
    };

    const confirmStatusChange = () => {
        if (!id || !pendingStatus) return;
        dispatch(
            patientsActions.updatePatientStatus({
                id,
                status: pendingStatus,
                reason: statusReason.trim() || undefined,
            }),
        );
        setPendingStatus(null);
        setStatusReason('');
    };

    const cancelStatusChange = () => {
        setPendingStatus(null);
        setStatusReason('');
    };

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

    const patientAppointments = appointments
        .filter((a) => {
            const patientId = typeof a.patientId === 'string' ? a.patientId : a.patientId?._id;
            return patientId === id;
        })
        .slice()
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    const patientInvoices = invoices.filter((inv) => {
        const patientId = typeof inv.patientId === 'string' ? inv.patientId : inv.patientId?._id;
        return patientId === id;
    });

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
                            <Button
                                variant="outlined"
                                startIcon={<EditIcon />}
                                onClick={() => navigate(`/patients/${id}/edit`)}
                            >
                                {t('common.edit')}
                            </Button>
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
                    <Tab label={t('patients.appointmentHistory')} />
                    <Tab label={t('patients.billingHistory')} />
                </Tabs>
            </Paper>

            {/* Profile Tab */}
            <TabPanel value={tabValue} index={0}>
                <Grid container spacing={3}>
                    {/* Personal Info */}
                    <Grid item xs={12} md={6}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" fontWeight={600} gutterBottom>
                                    {t('patients.patientProfile')}
                                </Typography>
                                <Divider sx={{ mb: 2 }} />
                                <Grid container spacing={1.5}>
                                    <Grid item xs={4}>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('patients.firstName')}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={8}>
                                        <Typography variant="body2">{patient.firstName}</Typography>
                                    </Grid>
                                    <Grid item xs={4}>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('patients.lastName')}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={8}>
                                        <Typography variant="body2">{patient.lastName}</Typography>
                                    </Grid>
                                    {patient.patronymic && (
                                        <>
                                            <Grid item xs={4}>
                                                <Typography variant="body2" color="text.secondary">
                                                    {t('patients.patronymic')}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={8}>
                                                <Typography variant="body2">{patient.patronymic}</Typography>
                                            </Grid>
                                        </>
                                    )}
                                    <Grid item xs={4}>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('patients.dateOfBirth')}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={8}>
                                        <Typography variant="body2">
                                            {formatDate(patient.dateOfBirth)}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={4}>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('patients.gender')}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={8}>
                                        <Typography variant="body2">
                                            {t(`patients.${patient.gender}`)}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={4}>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('patients.phone')}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={8}>
                                        <Typography variant="body2">
                                            {formatArmenianPhone(patient.phone)}
                                        </Typography>
                                    </Grid>
                                    {patient.email && (
                                        <>
                                            <Grid item xs={4}>
                                                <Typography variant="body2" color="text.secondary">
                                                    {t('patients.email')}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={8}>
                                                <Typography
                                                    variant="body2"
                                                    sx={{ overflowWrap: 'anywhere' }}
                                                >
                                                    {patient.email}
                                                </Typography>
                                            </Grid>
                                        </>
                                    )}
                                </Grid>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Address */}
                    <Grid item xs={12} md={6}>
                        <Card sx={{ mb: 3 }}>
                            <CardContent>
                                <Typography variant="h6" fontWeight={600} gutterBottom>
                                    {t('patients.address')}
                                </Typography>
                                <Divider sx={{ mb: 2 }} />
                                {patient.address ? (
                                    <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                                        {[
                                            patient.address.street,
                                            patient.address.city,
                                            patient.address.state,
                                            patient.address.zipCode,
                                            patient.address.country,
                                        ]
                                            .filter(Boolean)
                                            .join(', ') || '-'}
                                    </Typography>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">-</Typography>
                                )}
                            </CardContent>
                        </Card>

                        {/* Emergency Contact */}
                        <Card sx={{ mb: 3 }}>
                            <CardContent>
                                <Typography variant="h6" fontWeight={600} gutterBottom>
                                    {t('patients.emergencyContact')}
                                </Typography>
                                <Divider sx={{ mb: 2 }} />
                                {patient.emergencyContact ? (
                                    <Grid container spacing={1.5}>
                                        <Grid item xs={4}>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('patients.firstName')}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={8}>
                                            <Typography variant="body2">
                                                {patient.emergencyContact.name}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={4}>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('patients.relationship')}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={8}>
                                            <Typography variant="body2">
                                                {patient.emergencyContact.relationship}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={4}>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('patients.phone')}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={8}>
                                            <Typography variant="body2">
                                                {formatArmenianPhone(patient.emergencyContact.phone)}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">-</Typography>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Medical History */}
                    <Grid item xs={12} md={6}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" fontWeight={600} gutterBottom>
                                    {t('patients.medicalHistory')}
                                </Typography>
                                <Divider sx={{ mb: 2 }} />
                                {patient.medicalHistory ? (
                                    <Box>
                                        {!!patient.medicalHistory.conditions?.length && (
                                            <Box sx={{ mb: 2 }}>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{ mb: 0.5 }}
                                                >
                                                    {t('patients.conditions')}
                                                </Typography>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                    {patient.medicalHistory.conditions.map((c) => (
                                                        <Chip
                                                            key={c}
                                                            label={c}
                                                            size="small"
                                                            sx={{
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
                                            </Box>
                                        )}
                                        {!!patient.medicalHistory.allergies?.length && (
                                            <Box sx={{ mb: 2 }}>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{ mb: 0.5 }}
                                                >
                                                    {t('patients.allergies')}
                                                </Typography>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                    {patient.medicalHistory.allergies.map((a) => (
                                                        <Chip
                                                            key={a}
                                                            label={a}
                                                            size="small"
                                                            color="error"
                                                            variant="outlined"
                                                            sx={{
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
                                            </Box>
                                        )}
                                        {!!patient.medicalHistory.medications?.length && (
                                            <Box sx={{ mb: 2 }}>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{ mb: 0.5 }}
                                                >
                                                    {t('patients.medications')}
                                                </Typography>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                    {patient.medicalHistory.medications.map((m) => (
                                                        <Chip
                                                            key={m}
                                                            label={m}
                                                            size="small"
                                                            color="info"
                                                            variant="outlined"
                                                            sx={{
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
                                            </Box>
                                        )}
                                        {patient.medicalHistory.notes && (
                                            <Box>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{ mb: 0.5 }}
                                                >
                                                    {t('patients.notes')}
                                                </Typography>
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        overflowWrap: 'anywhere',
                                                        whiteSpace: 'pre-wrap',
                                                    }}
                                                >
                                                    {patient.medicalHistory.notes}
                                                </Typography>
                                            </Box>
                                        )}
                                    </Box>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">-</Typography>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Insurance */}
                    <Grid item xs={12} md={6}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" fontWeight={600} gutterBottom>
                                    {t('patients.insurance')}
                                </Typography>
                                <Divider sx={{ mb: 2 }} />
                                {patient.insurance ? (
                                    <Grid container spacing={1.5}>
                                        <Grid item xs={4}>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('patients.provider')}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={8}>
                                            <Typography variant="body2">
                                                {patient.insurance.provider}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={4}>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('patients.policyNo')}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={8}>
                                            <Typography variant="body2">
                                                {patient.insurance.policyNumber}
                                            </Typography>
                                        </Grid>
                                        {patient.insurance.groupNumber && (
                                            <>
                                                <Grid item xs={4}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {t('patients.groupNo')}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={8}>
                                                    <Typography variant="body2">
                                                        {patient.insurance.groupNumber}
                                                    </Typography>
                                                </Grid>
                                            </>
                                        )}
                                        {patient.insurance.expirationDate && (
                                            <>
                                                <Grid item xs={4}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {t('patients.expires')}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={8}>
                                                    <Typography variant="body2">
                                                        {formatDate(patient.insurance.expirationDate)}
                                                    </Typography>
                                                </Grid>
                                            </>
                                        )}
                                    </Grid>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">-</Typography>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Status audit trail */}
                    {!!patient.statusHistory?.length && (
                        <Grid item xs={12}>
                            <Card>
                                <CardContent>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <HistoryIcon fontSize="small" color="action" />
                                        <Typography variant="h6" fontWeight={600}>
                                            {t('patients.statusHistory')}
                                        </Typography>
                                    </Box>
                                    <Divider sx={{ my: 2 }} />
                                    <List dense disablePadding>
                                        {[...patient.statusHistory]
                                            .sort(
                                                (a, b) =>
                                                    new Date(b.changedAt).getTime() -
                                                    new Date(a.changedAt).getTime(),
                                            )
                                            .map((change, index) => (
                                                <ListItem
                                                    key={change._id || `${change.changedAt}-${index}`}
                                                    sx={{
                                                        px: 0,
                                                        borderBottom: '1px solid',
                                                        borderColor: 'divider',
                                                    }}
                                                >
                                                    <ListItemText
                                                        disableTypography
                                                        primary={
                                                            <Box
                                                                sx={{
                                                                    display: 'flex',
                                                                    flexWrap: 'wrap',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'space-between',
                                                                    gap: 1,
                                                                }}
                                                            >
                                                                <Box
                                                                    sx={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 0.75,
                                                                    }}
                                                                >
                                                                    {change.from ? (
                                                                        <>
                                                                            <StatusChip
                                                                                status={change.from}
                                                                                translationPrefix="patients"
                                                                            />
                                                                            <Typography
                                                                                variant="caption"
                                                                                color="text.secondary"
                                                                            >
                                                                                →
                                                                            </Typography>
                                                                        </>
                                                                    ) : (
                                                                        <Typography
                                                                            variant="caption"
                                                                            color="text.secondary"
                                                                        >
                                                                            {t('patients.registered')}
                                                                        </Typography>
                                                                    )}
                                                                    <StatusChip
                                                                        status={change.to}
                                                                        translationPrefix="patients"
                                                                    />
                                                                </Box>
                                                                <Typography
                                                                    variant="caption"
                                                                    color="text.secondary"
                                                                >
                                                                    {formatDateTime(change.changedAt)}
                                                                    {entryDentistName(change.changedBy) &&
                                                                        ` · ${entryDentistName(change.changedBy)}`}
                                                                </Typography>
                                                            </Box>
                                                        }
                                                        secondary={
                                                            change.reason ? (
                                                                <Typography
                                                                    variant="caption"
                                                                    color="text.secondary"
                                                                    sx={{
                                                                        mt: 0.5,
                                                                        display: 'block',
                                                                        overflowWrap: 'anywhere',
                                                                    }}
                                                                >
                                                                    {change.reason}
                                                                </Typography>
                                                            ) : null
                                                        }
                                                    />
                                                </ListItem>
                                            ))}
                                    </List>
                                </CardContent>
                            </Card>
                        </Grid>
                    )}

                    {/* Internal notes */}
                    {patient.notes && (
                        <Grid item xs={12}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" fontWeight={600} gutterBottom>
                                        {t('patients.internalNotes')}
                                    </Typography>
                                    <Divider sx={{ mb: 2 }} />
                                    <Typography
                                        variant="body2"
                                        sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
                                    >
                                        {patient.notes}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    )}
                </Grid>
            </TabPanel>

            {/* Dental Chart Tab */}
            <TabPanel value={tabValue} index={1}>
                <Card sx={{ mb: 3 }}>
                    <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                        <Typography variant="h6" fontWeight={600} gutterBottom>
                            {t('dental.odontogram')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {t('dental.selectTooth')}
                        </Typography>

                        <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={chartType}
                            onChange={(_e, value) => {
                                if (value && value !== chartType) setPendingChartType(value);
                            }}
                            sx={{ mb: 3 }}
                        >
                            <ToggleButton value="adult">{t('dental.adultChart')}</ToggleButton>
                            <ToggleButton value="pediatric">
                                {t('dental.pediatricChart')}
                            </ToggleButton>
                        </ToggleButtonGroup>

                        <Odontogram
                            teeth={teeth}
                            selectedTooth={selectedTooth}
                            onToothClick={handleToothClick}
                        />

                        {/* Legend */}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', mt: 2 }}>
                            {ALL_TOOTH_STATUSES.map((status) => (
                                <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Box sx={{
                                        width: 14, height: 14, borderRadius: '3px',
                                        bgcolor: TOOTH_STATUS_COLORS[status],
                                        opacity: status === 'missing' ? 0.4 : 1,
                                    }} />
                                    <Typography variant="caption" color="text.secondary">
                                        {t(statusTranslationMap[status])}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    </CardContent>
                </Card>

                {/* Tooth Detail Drawer */}
                <Drawer
                    anchor="right"
                    open={drawerOpen}
                    onClose={handleCloseDrawer}
                    PaperProps={{ sx: { width: { xs: '100%', sm: 400 }, maxWidth: '100%', p: 3 } }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" fontWeight={600}>
                            {t('dental.toothNumber')} {selectedTooth}
                        </Typography>
                        <IconButton onClick={handleCloseDrawer} size="small">
                            <CloseIcon />
                        </IconButton>
                    </Box>
                    <Divider sx={{ mb: 3 }} />

                    {selectedTooth && (
                        <Box sx={{ mb: 2 }}>
                            <Chip
                                label={t(statusTranslationMap[editStatus])}
                                sx={{ bgcolor: TOOTH_STATUS_COLORS[editStatus], color: '#fff', fontWeight: 600 }}
                            />
                        </Box>
                    )}

                    <FormControl fullWidth size="small" sx={{ mb: 3 }}>
                        <InputLabel>{t('common.status')}</InputLabel>
                        <Select value={editStatus} label={t('common.status')}
                            onChange={(e) => setEditStatus(e.target.value as ToothStatus)}>
                            {ALL_TOOTH_STATUSES.map((status) => (
                                <MenuItem key={status} value={status}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{
                                            width: 12, height: 12, borderRadius: '2px',
                                            bgcolor: TOOTH_STATUS_COLORS[status],
                                            opacity: status === 'missing' ? 0.4 : 1,
                                        }} />
                                        {t(statusTranslationMap[status])}
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                        {t('dental.surfaces')}
                    </Typography>
                    <FormGroup sx={{ mb: 3 }}>
                        {SURFACE_OPTIONS.map((surface) => (
                            <FormControlLabel key={surface}
                                control={<Checkbox size="small" checked={editSurfaces.includes(surface)}
                                    onChange={() => handleSurfaceToggle(surface)} />}
                                label={t(surfaceTranslationMap[surface])}
                            />
                        ))}
                    </FormGroup>

                    <TextField fullWidth size="small" label={t('patients.notes')} multiline rows={3}
                        value={editNotes} onChange={(e) => setEditNotes(e.target.value)} sx={{ mb: 3 }} />

                    <Button fullWidth variant="contained" startIcon={<SaveIcon />}
                        onClick={handleSaveTooth} disabled={updateToothLoading}>
                        {updateToothLoading ? t('common.loading') : t('common.save')}
                    </Button>

                    <Divider sx={{ my: 3 }} />
                    {id && selectedTooth !== null && (
                        <ToothTreatmentForm
                            patientId={id}
                            toothNumber={selectedTooth}
                            defaultSurfaces={editSurfaces}
                        />
                    )}

                    <Divider sx={{ my: 3 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <HistoryIcon fontSize="small" color="action" />
                        <Typography variant="subtitle2" fontWeight={600}>
                            {t('dental.statusHistory')}
                        </Typography>
                    </Box>
                    {!activeToothHistory?.statusHistory?.length ? (
                        <Typography variant="body2" color="text.secondary">
                            {t('dental.noHistory')}
                        </Typography>
                    ) : (
                        <List dense disablePadding>
                            {activeToothHistory.statusHistory.map((change, index) => (
                                <ListItem
                                    key={change._id || `${change.changedAt}-${index}`}
                                    sx={{ px: 0, borderBottom: '1px solid', borderColor: 'divider' }}
                                >
                                    <ListItemText
                                        disableTypography
                                        primary={
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: 1,
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    {change.previousStatus &&
                                                        change.previousStatus !== change.status && (
                                                            <>
                                                                <Typography
                                                                    variant="caption"
                                                                    color="text.secondary"
                                                                    sx={{ textDecoration: 'line-through' }}
                                                                >
                                                                    {t(statusTranslationMap[change.previousStatus])}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    →
                                                                </Typography>
                                                            </>
                                                        )}
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {t(statusTranslationMap[change.status])}
                                                    </Typography>
                                                </Box>
                                                <Typography variant="caption" color="text.secondary" noWrap>
                                                    {formatDateTime(change.changedAt)}
                                                </Typography>
                                            </Box>
                                        }
                                        secondary={
                                            <Box>
                                                {!!change.surfaces?.length && (
                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                                        {change.surfaces.map((surface) => (
                                                            <Chip
                                                                key={surface}
                                                                label={t(surfaceTranslationMap[surface] || surface)}
                                                                size="small"
                                                                variant="outlined"
                                                            />
                                                        ))}
                                                    </Box>
                                                )}
                                                {change.notes && (
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{
                                                            mt: 0.5,
                                                            display: 'block',
                                                            overflowWrap: 'anywhere',
                                                        }}
                                                    >
                                                        {change.notes}
                                                    </Typography>
                                                )}
                                            </Box>
                                        }
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}

                    <Divider sx={{ my: 3 }} />
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                        {t('dental.treatmentHistory')}
                    </Typography>
                    {!activeToothHistory?.treatments?.length ? (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {t('dental.noTreatmentsYet')}
                        </Typography>
                    ) : (
                        <List dense disablePadding>
                            {activeToothHistory.treatments.map((entry) => (
                                <ListItem key={entry._id} sx={{ px: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
                                    <ListItemText
                                        disableTypography
                                        primary={
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                                                <Typography variant="body2" fontWeight={600}>{entry.treatmentName}</Typography>
                                                <Typography variant="caption" color="text.secondary" noWrap>
                                                    {formatDate(entry.date)}
                                                </Typography>
                                            </Box>
                                        }
                                        secondary={
                                            <Box>
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        gap: 1,
                                                        mt: 0.25,
                                                    }}
                                                >
                                                    <Typography variant="caption" color="text.secondary">
                                                        {entryDentistName(entry.dentistId) || '—'}
                                                    </Typography>
                                                    {entry.cost !== undefined && entry.cost !== null && (
                                                        <Typography
                                                            variant="caption"
                                                            fontWeight={600}
                                                            color="text.primary"
                                                        >
                                                            {formatCurrency(entry.cost, entry.currency)}
                                                        </Typography>
                                                    )}
                                                </Box>
                                                {!!entry.surfaces?.length && (
                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                                        {entry.surfaces.map((surface) => (
                                                            <Chip
                                                                key={surface}
                                                                label={t(surfaceTranslationMap[surface] || surface)}
                                                                size="small"
                                                                variant="outlined"
                                                            />
                                                        ))}
                                                    </Box>
                                                )}
                                                {entry.notes && (
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{ mt: 0.5, display: 'block', overflowWrap: 'anywhere' }}
                                                    >
                                                        {entry.notes}
                                                    </Typography>
                                                )}
                                            </Box>
                                        }
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Drawer>
            </TabPanel>

            {/* Appointments Tab */}
            <TabPanel value={tabValue} index={2}>
                {appointmentsLoading && patientAppointments.length === 0 ? (
                    <LoadingSpinner />
                ) : patientAppointments.length === 0 ? (
                    <EmptyState title={t('appointments.noAppointments')} />
                ) : (
                    <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('common.date')}</TableCell>
                                    <TableCell>{t('appointments.dentist')}</TableCell>
                                    <TableCell>{t('appointments.treatmentType')}</TableCell>
                                    <TableCell>{t('appointments.duration')}</TableCell>
                                    <TableCell>{t('common.status')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {patientAppointments.map((appt) => {
                                    const dentist = typeof appt.dentistId === 'object' ? appt.dentistId : null;
                                    return (
                                        <TableRow
                                            key={appt._id}
                                            hover
                                            sx={{ cursor: 'pointer' }}
                                            onClick={() => navigate(`/appointments/${appt._id}`)}
                                        >
                                            <TableCell>{formatDate(appt.startTime, 'dd.MM.yyyy HH:mm')}</TableCell>
                                            <TableCell>
                                                {dentist
                                                    ? getFullName(dentist.firstName, dentist.lastName)
                                                    : '-'}
                                            </TableCell>
                                            <TableCell>{appt.treatmentType || '-'}</TableCell>
                                            <TableCell>{appt.duration} {t('common.minutes')}</TableCell>
                                            <TableCell>
                                                <StatusChip status={appt.status} translationPrefix="appointments" />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </TabPanel>

            {/* Billing Tab */}
            <TabPanel value={tabValue} index={3}>
                {invoicesLoading && patientInvoices.length === 0 ? (
                    <LoadingSpinner />
                ) : patientInvoices.length === 0 ? (
                    <EmptyState title={t('billing.noInvoices')} />
                ) : (
                    <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('billing.invoiceNumber')}</TableCell>
                                    <TableCell>{t('common.date')}</TableCell>
                                    <TableCell align="right">{t('billing.totalAmount')}</TableCell>
                                    <TableCell align="right">{t('billing.paidAmount')}</TableCell>
                                    <TableCell align="right">{t('billing.balance')}</TableCell>
                                    <TableCell>{t('common.status')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {patientInvoices.map((invoice) => (
                                    <TableRow
                                        key={invoice._id}
                                        hover
                                        sx={{ cursor: 'pointer' }}
                                        onClick={() => navigate(`/billing/${invoice._id}`)}
                                    >
                                        <TableCell>{invoice.invoiceNumber}</TableCell>
                                        <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                                        <TableCell align="right">
                                            {formatCurrency(invoice.totalAmount, invoice.currency)}
                                        </TableCell>
                                        <TableCell align="right">
                                            {formatCurrency(invoice.paidAmount, invoice.currency)}
                                        </TableCell>
                                        <TableCell align="right">
                                            {formatCurrency(
                                                invoice.totalAmount - invoice.paidAmount,
                                                invoice.currency,
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <StatusChip status={invoice.status} translationPrefix="billing" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </TabPanel>

            <ConfirmDialog
                open={!!pendingChartType}
                title={t('dental.changeChartType')}
                message={
                    pendingChartType
                        ? t('dental.confirmChartTypeChange', {
                              type: t(
                                  pendingChartType === 'pediatric'
                                      ? 'dental.pediatricChart'
                                      : 'dental.adultChart',
                              ),
                          })
                        : ''
                }
                variant="danger"
                onConfirm={confirmChartTypeChange}
                onCancel={() => setPendingChartType(null)}
            />

            <ConfirmDialog
                open={!!pendingStatus}
                title={t('patients.changeStatus')}
                message={
                    pendingStatus
                        ? t('patients.confirmStatusChange', {
                              status: t(`patients.${pendingStatus}`),
                          })
                        : ''
                }
                variant={pendingStatus === 'active' ? 'default' : 'danger'}
                onConfirm={confirmStatusChange}
                onCancel={cancelStatusChange}
            >
                <TextField
                    fullWidth
                    size="small"
                    label={t('patients.statusReason')}
                    placeholder={t('patients.statusReasonHint')}
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    multiline
                    rows={2}
                    sx={{ mt: 2 }}
                />
            </ConfirmDialog>
        </Box>
    );
};

export default PatientDetailPage;
