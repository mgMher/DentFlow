import React from 'react';
import {
    Box,
    Card,
    CardContent,
    Chip,
    Divider,
    Grid,
    List,
    ListItem,
    ListItemText,
    Typography,
} from '@mui/material';
import { History as HistoryIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { StatusChip } from '../../components/ui';
import { formatDate, formatDateTime, getFullName } from '../../utils/formatters';
import { formatArmenianPhone } from '../../utils/validators';
import { Patient } from '../../types';

const entryDentistName = (dentist?: string | { firstName?: string; lastName?: string }): string => {
    if (!dentist || typeof dentist === 'string') return '';
    return getFullName(dentist.firstName || '', dentist.lastName || '');
};

/** Profile tab of the patient page: personal, contact, medical, insurance, status history, notes. */
const PatientProfileTab: React.FC<{ patient: Patient }> = ({ patient }) => {
    const { t } = useTranslation();

    return (
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
                                        {t('patients.contactName')}
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
    );
};

export default PatientProfileTab;
