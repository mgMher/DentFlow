import React, { useEffect, useState } from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Chip,
    Divider,
    Drawer,
    IconButton,
    List,
    ListItem,
    ListItemText,
    MenuItem,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import {
    AddCircleOutline as AddCircleIcon,
    Close as CloseIcon,
    ExpandMore as ExpandMoreIcon,
    History as HistoryIcon,
    Save as SaveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { dentalRecordsActions } from '../../store/dental-records';
import { useHttpState } from '../../hooks';
import { SurfaceState, SurfaceStatus, ToothRecord, ToothStatus, ToothSurface } from '../../types';
import { formatDate, formatDateTime, formatCurrency } from '../../utils/formatters';
import { staffName } from '../../utils/references';
import {
    SURFACE_STATUSES,
    SURFACE_STATUS_COLORS,
    TOOTH_STATUSES,
    TOOTH_STATUS_COLORS,
    entryState,
    sameSurfaces,
    surfaceKey,
    surfaceStatusKey,
    toothStatusKey,
} from '../../utils/dental';
import { StatusChip } from '../ui';
import ToothGlyph from './ToothGlyph';
import ToothStatusChip from './ToothStatusChip';
import TreatmentEntryForm from './TreatmentEntryForm';

const EDITOR_SIZE = 120;

type Brush = SurfaceStatus | 'sound';

const SurfaceChips: React.FC<{ surfaces: SurfaceState[] }> = ({ surfaces }) => {
    const { t } = useTranslation();
    if (!surfaces.length) return null;
    return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {surfaces.map((s) => (
                <Chip
                    key={s.surface}
                    size="small"
                    variant="outlined"
                    label={`${t(surfaceKey(s.surface))}: ${t(surfaceStatusKey(s.status))}`}
                    sx={{ borderColor: SURFACE_STATUS_COLORS[s.status] }}
                />
            ))}
        </Box>
    );
};

interface ToothDrawerProps {
    patientId: string;
    toothNumber: number | null;
    /** The tooth on the current chart; missing when it is not on it. */
    tooth?: ToothRecord;
    canEdit: boolean;
    onClose: () => void;
}

/**
 * One tooth: its status and surface findings (editable by clinicians), a form
 * to record a treatment on it, and its timeline — every change with who made
 * it, and the treatments done or planned on it.
 */
const ToothDrawer: React.FC<ToothDrawerProps> = ({ patientId, toothNumber, tooth, canEdit, onClose }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const storedHistory = useSelector((state: RootState) => state.dentalRecords.toothHistory);
    const save = useHttpState('UPDATE_TOOTH');
    const complete = useHttpState('COMPLETE_ENTRY');

    const [status, setStatus] = useState<ToothStatus>('healthy');
    const [surfaces, setSurfaces] = useState<SurfaceState[]>([]);
    const [notes, setNotes] = useState('');
    const [brush, setBrush] = useState<Brush>('decayed');
    const [formOpen, setFormOpen] = useState(false);

    // Reset the editor whenever another tooth opens or the saved tooth changes.
    useEffect(() => {
        setStatus(tooth?.status ?? 'healthy');
        setSurfaces(tooth?.surfaces ?? []);
        setNotes(tooth?.notes ?? '');
    }, [toothNumber, tooth]);

    useEffect(() => setFormOpen(false), [toothNumber]);

    // A stale response must never show under another tooth or patient.
    const history =
        storedHistory && storedHistory.toothNumber === toothNumber && storedHistory.patientId === patientId
            ? storedHistory
            : null;

    const paint = (surface: ToothSurface) => {
        setSurfaces((prev) => {
            const rest = prev.filter((s) => s.surface !== surface);
            const current = prev.find((s) => s.surface === surface)?.status;
            if (brush === 'sound' || current === brush) return rest;
            return [...rest, { surface, status: brush }];
        });
    };

    const surfaceLabel = (surface: ToothSurface, state?: SurfaceStatus) =>
        `${t(surfaceKey(surface))}: ${state ? t(surfaceStatusKey(state)) : t('dental.surface.sound')}`;

    const dirty =
        !!tooth && (status !== tooth.status || notes !== (tooth.notes ?? '') || !sameSurfaces(surfaces, tooth.surfaces));

    const handleSave = () => {
        if (toothNumber === null) return;
        dispatch(dentalRecordsActions.updateTooth({ patientId, data: { toothNumber, status, surfaces, notes } }));
    };

    return (
        <Drawer
            anchor="right"
            open={toothNumber !== null}
            onClose={onClose}
            PaperProps={{ sx: { width: { xs: '100%', sm: 420 }, maxWidth: '100%', p: 3 } }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                    {t('dental.tooth')} {toothNumber}
                </Typography>
                <IconButton onClick={onClose} size="small" aria-label={t('common.close')}>
                    <CloseIcon />
                </IconButton>
            </Box>
            <Divider sx={{ mb: 2 }} />

            {!tooth ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                    {t('dental.notOnChart')}
                </Alert>
            ) : canEdit ? (
                <>
                    <TextField
                        select
                        fullWidth
                        size="small"
                        label={t('dental.wholeTooth')}
                        value={status}
                        onChange={(e) => setStatus(e.target.value as ToothStatus)}
                        sx={{ mb: 2 }}
                    >
                        {TOOTH_STATUSES.map((s) => (
                            <MenuItem key={s} value={s}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box
                                        sx={{
                                            width: 12,
                                            height: 12,
                                            borderRadius: '2px',
                                            border: '2px solid',
                                            borderColor: s === 'healthy' ? 'divider' : TOOTH_STATUS_COLORS[s],
                                        }}
                                    />
                                    {t(toothStatusKey(s))}
                                </Box>
                            </MenuItem>
                        ))}
                    </TextField>

                    <Typography variant="subtitle2" fontWeight={600}>
                        {t('dental.surfaces')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
                        {t('dental.surfaceHint')}
                    </Typography>
                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={brush}
                        onChange={(_, value) => value && setBrush(value)}
                        sx={{ mb: 1.5, flexWrap: 'wrap' }}
                        aria-label={t('dental.surfaceHint')}
                    >
                        {SURFACE_STATUSES.map((s) => (
                            <ToggleButton key={s} value={s} sx={{ gap: 0.75 }}>
                                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: SURFACE_STATUS_COLORS[s] }} />
                                {t(surfaceStatusKey(s))}
                            </ToggleButton>
                        ))}
                        <ToggleButton value="sound">{t('dental.surface.sound')}</ToggleButton>
                    </ToggleButtonGroup>
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                        <svg
                            width={EDITOR_SIZE + 40}
                            height={EDITOR_SIZE + 50}
                            viewBox={`-20 -25 ${EDITOR_SIZE + 40} ${EDITOR_SIZE + 50}`}
                            role="group"
                            aria-label={t('dental.surfaces')}
                        >
                            <ToothGlyph
                                toothNumber={toothNumber ?? 11}
                                status={status}
                                surfaces={surfaces}
                                size={EDITOR_SIZE}
                                onSurfaceClick={paint}
                                surfaceLabel={surfaceLabel}
                            />
                        </svg>
                    </Box>
                    <SurfaceChips surfaces={surfaces} />

                    <TextField
                        fullWidth
                        size="small"
                        label={t('patients.notes')}
                        multiline
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        inputProps={{ maxLength: 2000 }}
                        sx={{ mt: 2, mb: 2 }}
                    />
                    <Button
                        fullWidth
                        variant="contained"
                        startIcon={<SaveIcon />}
                        onClick={handleSave}
                        disabled={save.loading || !dirty}
                    >
                        {save.loading ? t('common.loading') : t('common.save')}
                    </Button>
                </>
            ) : (
                <Box>
                    <ToothStatusChip status={tooth.status} />
                    <SurfaceChips surfaces={tooth.surfaces ?? []} />
                    {tooth.notes && (
                        <Typography variant="body2" sx={{ mt: 1, overflowWrap: 'anywhere' }}>
                            {tooth.notes}
                        </Typography>
                    )}
                </Box>
            )}

            {canEdit && toothNumber !== null && (
                <Accordion
                    expanded={formOpen}
                    onChange={() => setFormOpen(!formOpen)}
                    // Mount on open, so the form starts from the tooth as saved now.
                    TransitionProps={{ unmountOnExit: true }}
                    disableGutters
                    sx={{ mt: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
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
                        <TreatmentEntryForm
                            patientId={patientId}
                            initialTeeth={[toothNumber]}
                            defaultSurfaces={(tooth?.surfaces ?? [])
                                .filter((s) => s.status === 'decayed')
                                .map((s) => s.surface)}
                            onSaved={() => setFormOpen(false)}
                        />
                    </AccordionDetails>
                </Accordion>
            )}

            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                {t('dental.treatmentHistory')}
            </Typography>
            {!history?.treatments?.length ? (
                <Typography variant="body2" color="text.secondary">
                    {t('dental.noTreatmentsYet')}
                </Typography>
            ) : (
                <List dense disablePadding>
                    {history.treatments.map((entry) => (
                        <ListItem key={entry._id} sx={{ px: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <ListItemText
                                disableTypography
                                primary={
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
                                            {entry.treatmentName}
                                        </Typography>
                                        <StatusChip status={entryState(entry)} label={t(`dental.${entryState(entry)}`)} />
                                    </Box>
                                }
                                secondary={
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" component="div">
                                            {formatDate(entry.date)} · {staffName(entry.dentistId)}
                                            {entry.teeth.length > 1 && ` · ${t('dental.teeth')} ${entry.teeth.join(', ')}`}
                                            {entry.cost != null && ` · ${formatCurrency(entry.cost, entry.currency)}`}
                                        </Typography>
                                        {entry.notes && (
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                                                {entry.notes}
                                            </Typography>
                                        )}
                                        {canEdit && entry.status === 'planned' && !entry.voidedAt && (
                                            <Button
                                                size="small"
                                                sx={{ mt: 0.5, px: 0 }}
                                                disabled={complete.loading}
                                                onClick={() => dispatch(dentalRecordsActions.completeEntry({ patientId, entryId: entry._id }))}
                                            >
                                                {t('dental.markDone')}
                                            </Button>
                                        )}
                                    </Box>
                                }
                            />
                        </ListItem>
                    ))}
                </List>
            )}

            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <HistoryIcon fontSize="small" color="action" />
                <Typography variant="subtitle2" fontWeight={600}>
                    {t('dental.statusHistory')}
                </Typography>
            </Box>
            {!history?.statusHistory?.length ? (
                <Typography variant="body2" color="text.secondary">
                    {t('dental.noHistory')}
                </Typography>
            ) : (
                <List dense disablePadding>
                    {history.statusHistory.map((change, index) => (
                        <ListItem
                            key={change._id || `${change.changedAt}-${index}`}
                            sx={{ px: 0, borderBottom: '1px solid', borderColor: 'divider' }}
                        >
                            <ListItemText
                                disableTypography
                                primary={
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                            {change.previousStatus && change.previousStatus !== change.status && (
                                                <>
                                                    <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                                                        {t(toothStatusKey(change.previousStatus))}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">→</Typography>
                                                </>
                                            )}
                                            <Typography variant="body2" fontWeight={600}>
                                                {t(toothStatusKey(change.status))}
                                            </Typography>
                                        </Box>
                                        <Typography variant="caption" color="text.secondary" noWrap>
                                            {formatDateTime(change.changedAt)}
                                        </Typography>
                                    </Box>
                                }
                                secondary={
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" component="div">
                                            {t('dental.changedBy')}: {staffName(change.changedBy)}
                                            {change.treatmentEntryId && ` · ${t('dental.viaTreatment')}`}
                                        </Typography>
                                        <SurfaceChips surfaces={change.surfaces ?? []} />
                                        {change.notes && (
                                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', overflowWrap: 'anywhere' }}>
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
        </Drawer>
    );
};

export default ToothDrawer;
