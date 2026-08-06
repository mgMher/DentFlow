import React, { useEffect, useState } from 'react';
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
} from '@mui/material';
import {
    ArrowBack as BackIcon,
    Edit as EditIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    CalendarMonth as CalendarIcon,
    MedicalServices as MedicalIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { patientsActions } from '../../store/patients';
import { PageHeader, StatusChip, EmptyState, LoadingSpinner } from '../../components/ui';
import { formatDate, formatCurrency, getFullName, getInitials } from '../../utils/formatters';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
    if (value !== index) return null;
    return <Box sx={{ py: 3 }}>{children}</Box>;
};

const PatientDetailPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { id } = useParams<{ id: string }>();

    const patient = useSelector((state: RootState) => state.patients.current);
    const loading = useSelector((state: RootState) => state.http.loading.includes('GET_PATIENT'));
    const appointments = useSelector((state: RootState) => state.appointments.list);
    const invoices = useSelector((state: RootState) => state.billing.invoices);

    const [tabValue, setTabValue] = useState(0);

    useEffect(() => {
        if (id) {
            dispatch(patientsActions.getPatient(id));
        }
    }, [id, dispatch]);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const calculateAge = (dateOfBirth: string): number => {
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    if (loading || !patient) {
        return <LoadingSpinner fullPage />;
    }

    const patientAppointments = appointments.filter((a) => {
        const patientId = typeof a.patientId === 'string' ? a.patientId : a.patientId?._id;
        return patientId === id;
    });

    const patientInvoices = invoices.filter((inv) => {
        const patientId = typeof inv.patientId === 'string' ? inv.patientId : inv.patientId?._id;
        return patientId === id;
    });

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

            {/* Patient Info Header Card */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Avatar
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
                                <Typography variant="h5" fontWeight={700}>
                                    {getFullName(patient.firstName, patient.lastName, patient.patronymic)}
                                </Typography>
                                <StatusChip
                                    status={patient.isActive ? 'active' : 'inactive'}
                                    translationPrefix="common"
                                />
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, color: 'text.secondary' }}>
                                {patient.dateOfBirth && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <CalendarIcon fontSize="small" />
                                        <Typography variant="body2">
                                            {formatDate(patient.dateOfBirth)} ({calculateAge(patient.dateOfBirth)})
                                        </Typography>
                                    </Box>
                                )}
                                {patient.phone && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <PhoneIcon fontSize="small" />
                                        <Typography variant="body2">{patient.phone}</Typography>
                                    </Box>
                                )}
                                {patient.email && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <EmailIcon fontSize="small" />
                                        <Typography variant="body2">{patient.email}</Typography>
                                    </Box>
                                )}
                            </Box>
                        </Box>
                        <Button
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={() => navigate(`/patients/${id}/edit`)}
                        >
                            {t('common.edit')}
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Paper sx={{ mb: 2 }}>
                <Tabs value={tabValue} onChange={handleTabChange}>
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
                                        <Typography variant="body2">{patient.phone}</Typography>
                                    </Grid>
                                    {patient.email && (
                                        <>
                                            <Grid item xs={4}>
                                                <Typography variant="body2" color="text.secondary">
                                                    {t('patients.email')}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={8}>
                                                <Typography variant="body2">{patient.email}</Typography>
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
                                    <Typography variant="body2">
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
                                                {patient.emergencyContact.phone}
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
                                        {patient.medicalHistory.conditions.length > 0 && (
                                            <Box sx={{ mb: 2 }}>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{ mb: 0.5 }}
                                                >
                                                    {t('patients.medicalHistory')}
                                                </Typography>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                    {patient.medicalHistory.conditions.map((c) => (
                                                        <Chip key={c} label={c} size="small" />
                                                    ))}
                                                </Box>
                                            </Box>
                                        )}
                                        {patient.medicalHistory.allergies.length > 0 && (
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
                                                        <Chip key={a} label={a} size="small" color="error" variant="outlined" />
                                                    ))}
                                                </Box>
                                            </Box>
                                        )}
                                        {patient.medicalHistory.medications.length > 0 && (
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
                                                        <Chip key={m} label={m} size="small" color="info" variant="outlined" />
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
                                                <Typography variant="body2">
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
                                                Provider
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={8}>
                                            <Typography variant="body2">
                                                {patient.insurance.provider}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={4}>
                                            <Typography variant="body2" color="text.secondary">
                                                Policy #
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
                                                        Group #
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
                                                        Expires
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
                </Grid>
            </TabPanel>

            {/* Dental Chart Tab */}
            <TabPanel value={tabValue} index={1}>
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <MedicalIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h6" gutterBottom>
                        {t('dental.odontogram')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        {t('dental.selectTooth')}
                    </Typography>
                    <Button
                        variant="contained"
                        size="large"
                        onClick={() => navigate(`/patients/${id}/chart`)}
                    >
                        {t('dental.odontogram')}
                    </Button>
                </Box>
            </TabPanel>

            {/* Appointments Tab */}
            <TabPanel value={tabValue} index={2}>
                {patientAppointments.length === 0 ? (
                    <EmptyState title={t('appointments.noAppointments')} />
                ) : (
                    <TableContainer component={Paper}>
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
                {patientInvoices.length === 0 ? (
                    <EmptyState title={t('billing.noInvoices')} />
                ) : (
                    <TableContainer component={Paper}>
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
        </Box>
    );
};

export default PatientDetailPage;
