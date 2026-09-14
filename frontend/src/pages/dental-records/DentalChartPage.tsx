import React, { useEffect, useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Drawer,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormGroup,
    FormControlLabel,
    Checkbox,
    Divider,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Chip,
} from '@mui/material';
import {
    ArrowBack as BackIcon,
    Close as CloseIcon,
    Save as SaveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { patientsActions } from '../../store/patients';
import { dentalRecordsActions } from '../../store/dental-records';
import {
    PageHeader,
    LoadingSpinner,
    ToothTreatmentForm,
    Odontogram,
} from '../../components/ui';
import { formatCurrency, formatDate, formatDateTime, getFullName } from '../../utils/formatters';
import { TOOTH_STATUS_COLORS, TOOTH_SURFACES } from '../../utils/constants';
import { ToothStatus, ToothSurface } from '../../types';

// ── Tooth layout constants ──────────────────────────────────────────────────────

const ALL_TOOTH_STATUSES: ToothStatus[] = [
    'healthy', 'filled', 'crown', 'missing', 'implant',
    'needs_treatment', 'root_canal', 'decayed', 'bridge', 'veneer',
];

const SURFACE_OPTIONS: ToothSurface[] = [...TOOTH_SURFACES];

const statusTranslationKeys: Record<string, string> = {
    healthy: 'dental.healthy',
    filled: 'dental.filled',
    crown: 'dental.crown',
    missing: 'dental.missing',
    implant: 'dental.implant',
    needs_treatment: 'dental.needsTreatment',
    root_canal: 'dental.rootCanal',
    decayed: 'dental.decayed',
    bridge: 'dental.bridge',
    veneer: 'dental.veneer',
};

const ChartLegend: React.FC = () => {
    const { t } = useTranslation();

    return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', mt: 2 }}>
            {ALL_TOOTH_STATUSES.map((status) => (
                <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box
                        sx={{
                            width: 14,
                            height: 14,
                            borderRadius: '3px',
                            bgcolor: TOOTH_STATUS_COLORS[status],
                            opacity: status === 'missing' ? 0.4 : 1,
                        }}
                    />
                    <Typography variant="caption" color="text.secondary">
                        {t(statusTranslationKeys[status])}
                    </Typography>
                </Box>
            ))}
        </Box>
    );
};

const entryDentistName = (dentist?: string | { firstName?: string; lastName?: string }): string => {
    if (!dentist || typeof dentist === 'string') return '';
    return getFullName(dentist.firstName || '', dentist.lastName || '');
};

// ── Main DentalChartPage ────────────────────────────────────────────────────────

const DentalChartPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { id: patientId } = useParams<{ id: string }>();

    const patient = useSelector((state: RootState) => state.patients.current);
    const chart = useSelector((state: RootState) => state.dentalRecords.chart);
    const toothHistoryRecord = useSelector((state: RootState) => state.dentalRecords.toothHistory);
    const chartLoading = useSelector((state: RootState) => state.http.loading.includes('GET_CHART'));
    const updateLoading = useSelector((state: RootState) => state.http.loading.includes('UPDATE_TOOTH'));

    const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Tooth editing state
    const [editStatus, setEditStatus] = useState<ToothStatus>('healthy');
    const [editSurfaces, setEditSurfaces] = useState<ToothSurface[]>([]);
    const [editNotes, setEditNotes] = useState('');

    useEffect(() => {
        if (patientId) {
            dispatch(patientsActions.getPatient(patientId));
            dispatch(dentalRecordsActions.getChart(patientId));
        }
    }, [patientId, dispatch]);

    const teeth = chart?.teeth || [];

    const handleToothClick = (toothNumber: number) => {
        setSelectedTooth(toothNumber);

        // Find existing tooth record
        const toothRecord = teeth.find((t) => t.toothNumber === toothNumber);
        setEditStatus(toothRecord?.status || 'healthy');
        setEditSurfaces(toothRecord?.surfaces || []);
        setEditNotes(toothRecord?.notes || '');

        // Load this tooth's timeline (status changes + treatments)
        if (patientId) {
            dispatch(dentalRecordsActions.getToothHistory({ patientId, toothNumber }));
        }

        setDrawerOpen(true);
    };

    const handleSurfaceToggle = (surface: ToothSurface) => {
        setEditSurfaces((prev) =>
            prev.includes(surface)
                ? prev.filter((s) => s !== surface)
                : [...prev, surface],
        );
    };

    const handleSave = () => {
        if (!patientId || selectedTooth === null) return;

        dispatch(
            dentalRecordsActions.updateTooth({
                patientId,
                data: {
                    toothNumber: selectedTooth,
                    status: editStatus,
                    surfaces: editSurfaces,
                    notes: editNotes,
                },
            }),
        );
    };

    const handleCloseDrawer = () => {
        setDrawerOpen(false);
        setSelectedTooth(null);
        dispatch(dentalRecordsActions.clearToothHistory());
    };

    const patientName = patient
        ? getFullName(patient.firstName, patient.lastName, patient.patronymic)
        : '';

    if (chartLoading && !chart) {
        return <LoadingSpinner fullPage />;
    }

    const activeToothHistory =
        toothHistoryRecord && toothHistoryRecord.toothNumber === selectedTooth
            ? toothHistoryRecord
            : null;
    const toothHistory = activeToothHistory?.treatments || [];
    const statusHistory = activeToothHistory?.statusHistory || [];

    const surfaceTranslationMap: Record<string, string> = {
        mesial: 'dental.mesial',
        distal: 'dental.distal',
        occlusal: 'dental.occlusal',
        incisal: 'dental.incisal',
        buccal: 'dental.buccal',
        lingual: 'dental.lingual',
        palatal: 'dental.palatal',
        cervical: 'dental.cervical',
    };

    const statusTranslationMap: Record<string, string> = {
        healthy: 'dental.healthy',
        filled: 'dental.filled',
        crown: 'dental.crown',
        missing: 'dental.missing',
        implant: 'dental.implant',
        needs_treatment: 'dental.needsTreatment',
        root_canal: 'dental.rootCanal',
        decayed: 'dental.decayed',
        bridge: 'dental.bridge',
        veneer: 'dental.veneer',
    };

    return (
        <Box>
            <PageHeader title={patientName || t('dental.odontogram')}>
                <Button
                    variant="outlined"
                    startIcon={<BackIcon />}
                    onClick={() => navigate(patientId ? `/patients/${patientId}` : '/patients')}
                >
                    {t('common.back')}
                </Button>
            </PageHeader>

            {/* Odontogram Card */}
            <Card sx={{ mb: 3 }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                        {t('dental.odontogram')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        {t('dental.selectTooth')}
                    </Typography>

                    <Odontogram
                        teeth={teeth}
                        selectedTooth={selectedTooth}
                        onToothClick={handleToothClick}
                    />

                    <ChartLegend />
                </CardContent>
            </Card>

            {/* Tooth Detail Drawer */}
            <Drawer
                anchor="right"
                open={drawerOpen}
                onClose={handleCloseDrawer}
                PaperProps={{ sx: { width: 400, p: 3 } }}
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

                {/* Current Status Display */}
                {selectedTooth && (
                    <Box sx={{ mb: 2 }}>
                        <Chip
                            label={t(statusTranslationMap[editStatus])}
                            sx={{
                                bgcolor: TOOTH_STATUS_COLORS[editStatus],
                                color: '#fff',
                                fontWeight: 600,
                            }}
                        />
                    </Box>
                )}

                {/* Status Selector */}
                <FormControl fullWidth size="small" sx={{ mb: 3 }}>
                    <InputLabel>{t('common.status')}</InputLabel>
                    <Select
                        value={editStatus}
                        label={t('common.status')}
                        onChange={(e) => setEditStatus(e.target.value as ToothStatus)}
                    >
                        {ALL_TOOTH_STATUSES.map((status) => (
                            <MenuItem key={status} value={status}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box
                                        sx={{
                                            width: 12,
                                            height: 12,
                                            borderRadius: '2px',
                                            bgcolor: TOOTH_STATUS_COLORS[status],
                                            opacity: status === 'missing' ? 0.4 : 1,
                                        }}
                                    />
                                    {t(statusTranslationMap[status])}
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Surfaces Checkboxes */}
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    {t('dental.surfaces')}
                </Typography>
                <FormGroup sx={{ mb: 3 }}>
                    {SURFACE_OPTIONS.map((surface) => (
                        <FormControlLabel
                            key={surface}
                            control={
                                <Checkbox
                                    size="small"
                                    checked={editSurfaces.includes(surface)}
                                    onChange={() => handleSurfaceToggle(surface)}
                                />
                            }
                            label={t(surfaceTranslationMap[surface])}
                        />
                    ))}
                </FormGroup>

                {/* Notes */}
                <TextField
                    fullWidth
                    size="small"
                    label={t('patients.notes')}
                    multiline
                    rows={3}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    sx={{ mb: 3 }}
                />

                {/* Save Button */}
                <Button
                    fullWidth
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={updateLoading}
                >
                    {updateLoading ? t('common.loading') : t('common.save')}
                </Button>

                {/* Record a treatment for this tooth */}
                <Divider sx={{ my: 3 }} />
                {patientId && selectedTooth !== null && (
                    <ToothTreatmentForm
                        patientId={patientId}
                        toothNumber={selectedTooth}
                        defaultSurfaces={editSurfaces}
                    />
                )}

                {/* Status History */}
                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    {t('dental.statusHistory')}
                </Typography>

                {statusHistory.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        {t('dental.noHistory')}
                    </Typography>
                ) : (
                    <List dense disablePadding>
                        {statusHistory.map((change, index) => (
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
                                        change.notes ? (
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{ mt: 0.5, display: 'block', overflowWrap: 'anywhere' }}
                                            >
                                                {change.notes}
                                            </Typography>
                                        ) : null
                                    }
                                />
                            </ListItem>
                        ))}
                    </List>
                )}

                {/* Treatment History */}
                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    {t('dental.treatmentHistory')}
                </Typography>

                {toothHistory.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {t('dental.noTreatmentsYet')}
                    </Typography>
                ) : (
                    <List dense disablePadding>
                        {toothHistory.map((entry) => (
                            <ListItem
                                key={entry._id}
                                sx={{
                                    px: 0,
                                    borderBottom: '1px solid',
                                    borderColor: 'divider',
                                }}
                            >
                                <ListItemText
                                    disableTypography
                                    primary={
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography variant="body2" fontWeight={600}>
                                                {entry.treatmentName}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
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
                                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
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
        </Box>
    );
};

export default DentalChartPage;
