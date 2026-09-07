import React, { useEffect, useState, useMemo } from 'react';
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
import { PageHeader, LoadingSpinner } from '../../components/ui';
import { formatDate, formatDateTime, getFullName } from '../../utils/formatters';
import { TOOTH_STATUS_COLORS, TOOTH_SURFACES } from '../../utils/constants';
import { ToothStatus, ToothSurface, ToothRecord } from '../../types';

// ── Tooth layout constants ──────────────────────────────────────────────────────

const TOOTH_WIDTH = 34;
const TOOTH_HEIGHT = 44;
const TOOTH_GAP = 4;
const TOOTH_RX = 6;

const ALL_TOOTH_STATUSES: ToothStatus[] = [
    'healthy', 'filled', 'crown', 'missing', 'implant',
    'needs_treatment', 'root_canal', 'decayed', 'bridge', 'veneer',
];

const SURFACE_OPTIONS: ToothSurface[] = [...TOOTH_SURFACES];

// Upper teeth: 1-16 (right to left in dentist's view), Lower teeth: 17-32
const UPPER_TEETH = Array.from({ length: 16 }, (_, i) => i + 1);
const LOWER_TEETH = Array.from({ length: 16 }, (_, i) => i + 17);

// ── Arch layout calculation ─────────────────────────────────────────────────────
// Creates a dental arch shape for the teeth

interface ToothPosition {
    x: number;
    y: number;
    toothNumber: number;
}

const buildArchPositions = (
    teeth: number[],
    centerX: number,
    baseY: number,
    isUpper: boolean,
): ToothPosition[] => {
    const totalWidth = teeth.length * (TOOTH_WIDTH + TOOTH_GAP) - TOOTH_GAP;
    const startX = centerX - totalWidth / 2;

    return teeth.map((toothNumber, idx) => {
        const x = startX + idx * (TOOTH_WIDTH + TOOTH_GAP);
        // Create arch curve: teeth at the edges are lower (upper) or higher (lower)
        const normalized = (idx - (teeth.length - 1) / 2) / ((teeth.length - 1) / 2); // -1 to 1
        const archOffset = normalized * normalized * 30; // parabolic curve
        const y = isUpper ? baseY + archOffset : baseY - archOffset;

        return { x, y, toothNumber };
    });
};

// ── Odontogram SVG Component ────────────────────────────────────────────────────

interface OdontogramProps {
    teeth: ToothRecord[];
    selectedTooth: number | null;
    onToothClick: (toothNumber: number) => void;
}

const Odontogram: React.FC<OdontogramProps> = ({ teeth, selectedTooth, onToothClick }) => {
    const { t } = useTranslation();

    const svgWidth = 700;
    const svgHeight = 340;
    const centerX = svgWidth / 2;

    const upperPositions = buildArchPositions(UPPER_TEETH, centerX, 50, true);
    const lowerPositions = buildArchPositions(LOWER_TEETH, centerX, 220, false);

    const toothStatusMap = useMemo(() => {
        const map: Record<number, ToothStatus> = {};
        teeth.forEach((tooth) => {
            map[tooth.toothNumber] = tooth.status;
        });
        return map;
    }, [teeth]);

    const renderTooth = (pos: ToothPosition) => {
        const status = toothStatusMap[pos.toothNumber] || 'healthy';
        const fillColor = TOOTH_STATUS_COLORS[status] || TOOTH_STATUS_COLORS.healthy;
        const isSelected = selectedTooth === pos.toothNumber;

        return (
            <g
                key={pos.toothNumber}
                onClick={() => onToothClick(pos.toothNumber)}
                style={{ cursor: 'pointer' }}
            >
                <rect
                    x={pos.x}
                    y={pos.y}
                    width={TOOTH_WIDTH}
                    height={TOOTH_HEIGHT}
                    rx={TOOTH_RX}
                    ry={TOOTH_RX}
                    fill={fillColor}
                    stroke={isSelected ? '#1A202C' : '#E2E8F0'}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    opacity={status === 'missing' ? 0.4 : 1}
                />
                {/* Hover overlay */}
                <rect
                    x={pos.x}
                    y={pos.y}
                    width={TOOTH_WIDTH}
                    height={TOOTH_HEIGHT}
                    rx={TOOTH_RX}
                    ry={TOOTH_RX}
                    fill="transparent"
                    stroke="transparent"
                    strokeWidth={0}
                >
                    <animate
                        attributeName="fill"
                        from="transparent"
                        to="rgba(0,0,0,0.08)"
                        dur="0.15s"
                        begin="mouseover"
                        fill="freeze"
                    />
                    <animate
                        attributeName="fill"
                        from="rgba(0,0,0,0.08)"
                        to="transparent"
                        dur="0.15s"
                        begin="mouseout"
                        fill="freeze"
                    />
                </rect>
                {/* Tooth number label */}
                <text
                    x={pos.x + TOOTH_WIDTH / 2}
                    y={pos.y + TOOTH_HEIGHT / 2 + 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={12}
                    fontWeight={600}
                    fill="#fff"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                    {pos.toothNumber}
                </text>
            </g>
        );
    };

    return (
        <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            width="100%"
            style={{ maxWidth: svgWidth }}
        >
            {/* Upper jaw label */}
            <text
                x={centerX}
                y={20}
                textAnchor="middle"
                fontSize={14}
                fontWeight={600}
                fill="#4A5568"
            >
                {t('dental.upperJaw')}
            </text>

            {/* Midline */}
            <line
                x1={centerX}
                y1={35}
                x2={centerX}
                y2={155}
                stroke="#CBD5E0"
                strokeWidth={1}
                strokeDasharray="4 4"
            />

            {/* Upper teeth */}
            {upperPositions.map(renderTooth)}

            {/* Separator line */}
            <line
                x1={40}
                y1={svgHeight / 2}
                x2={svgWidth - 40}
                y2={svgHeight / 2}
                stroke="#CBD5E0"
                strokeWidth={1}
            />

            {/* Lower jaw label */}
            <text
                x={centerX}
                y={svgHeight - 10}
                textAnchor="middle"
                fontSize={14}
                fontWeight={600}
                fill="#4A5568"
            >
                {t('dental.lowerJaw')}
            </text>

            {/* Midline lower */}
            <line
                x1={centerX}
                y1={185}
                x2={centerX}
                y2={305}
                stroke="#CBD5E0"
                strokeWidth={1}
                strokeDasharray="4 4"
            />

            {/* Lower teeth */}
            {lowerPositions.map(renderTooth)}
        </svg>
    );
};

// ── Legend Component ─────────────────────────────────────────────────────────────

const ChartLegend: React.FC = () => {
    const { t } = useTranslation();

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
                        {t(statusTranslationMap[status])}
                    </Typography>
                </Box>
            ))}
        </Box>
    );
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
                        {t('common.noData')}
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
