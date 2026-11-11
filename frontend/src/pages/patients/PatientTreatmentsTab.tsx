import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box,
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    IconButton,
    Paper,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    Add as AddIcon,
    Block as VoidIcon,
    CheckCircleOutline as DoneIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import { RootState } from '../../store';
import { dentalRecordsActions } from '../../store/dental-records';
import { ConfirmDialog, EmptyState, LoadingSpinner, StatusChip } from '../../components/ui';
import TreatmentEntryForm from '../../components/dental/TreatmentEntryForm';
import { useHttpState, usePermission } from '../../hooks';
import { TreatmentEntry, TreatmentEntryStatus } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { staffName } from '../../utils/references';
import { entryState, teethLabel, toothStatusKey } from '../../utils/dental';

const PAGE_SIZE = 20;

/**
 * Everything done or planned for the patient — the treatment plan and the
 * record in one list. The data was always fetched but never shown.
 */
const PatientTreatmentsTab: React.FC<{ patientId: string }> = ({ patientId }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const can = usePermission();
    const canEdit = can('editDentalChart');
    const { entries } = useSelector((state: RootState) => state.dentalRecords);
    const loading = useSelector((state: RootState) => state.http.loading.includes('GET_ENTRIES'));
    const complete = useHttpState('COMPLETE_ENTRY');
    const voiding = useHttpState('VOID_ENTRY');

    const [page, setPage] = useState(0);
    const [status, setStatus] = useState<TreatmentEntryStatus | 'all'>('all');
    const [includeVoided, setIncludeVoided] = useState(false);
    const [adding, setAdding] = useState(false);
    const [voidTarget, setVoidTarget] = useState<TreatmentEntry | null>(null);
    const [voidReason, setVoidReason] = useState('');

    useEffect(() => {
        dispatch(
            dentalRecordsActions.getEntries({
                patientId,
                page: page + 1,
                limit: PAGE_SIZE,
                status: status === 'all' ? undefined : status,
                includeVoided: includeVoided || undefined,
            }),
        );
    }, [dispatch, patientId, page, status, includeVoided]);

    // Close the void dialog once the server has answered yes.
    useEffect(() => {
        if (!voiding.success) return;
        voiding.clearSuccess();
        setVoidTarget(null);
        setVoidReason('');
    }, [voiding.success]); // eslint-disable-line react-hooks/exhaustive-deps

    const rows = entries.query?.patientId === patientId ? entries.list : [];
    const reasonValid = voidReason.trim().length >= 3;

    return (
        <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={status}
                    onChange={(_, value) => {
                        if (!value) return;
                        setStatus(value);
                        setPage(0);
                    }}
                >
                    <ToggleButton value="all">{t('common.all')}</ToggleButton>
                    <ToggleButton value="planned">{t('dental.planned')}</ToggleButton>
                    <ToggleButton value="done">{t('dental.done')}</ToggleButton>
                </ToggleButtonGroup>
                <FormControlLabel
                    control={
                        <Switch
                            checked={includeVoided}
                            onChange={(e) => {
                                setIncludeVoided(e.target.checked);
                                setPage(0);
                            }}
                        />
                    }
                    label={t('dental.showVoided')}
                />
                <Box sx={{ flex: 1 }} />
                {canEdit && (
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>
                        {t('dental.addTreatment')}
                    </Button>
                )}
            </Box>

            {loading && !rows.length ? (
                <LoadingSpinner />
            ) : !rows.length ? (
                <EmptyState title={t('dental.noTreatments')} />
            ) : (
                <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('common.date')}</TableCell>
                                <TableCell>{t('dental.teeth')}</TableCell>
                                <TableCell>{t('dental.treatmentName')}</TableCell>
                                <TableCell>{t('appointments.dentist')}</TableCell>
                                <TableCell align="right">{t('dental.cost')}</TableCell>
                                <TableCell>{t('common.status')}</TableCell>
                                {canEdit && <TableCell align="right">{t('common.actions')}</TableCell>}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((entry) => {
                                const state = entryState(entry);
                                return (
                                    <TableRow key={entry._id} sx={state === 'voided' ? { opacity: 0.6 } : undefined}>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(entry.date)}</TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                            {teethLabel(entry.teeth) || t('dental.wholeMouth')}
                                        </TableCell>
                                        <TableCell sx={{ overflowWrap: 'anywhere', minWidth: 160 }}>
                                            <Typography
                                                variant="body2"
                                                fontWeight={600}
                                                sx={state === 'voided' ? { textDecoration: 'line-through' } : undefined}
                                            >
                                                {entry.treatmentName}
                                            </Typography>
                                            {entry.resultStatus && entry.teeth.length > 0 && (
                                                <Typography variant="caption" color="text.secondary" component="div">
                                                    → {t(toothStatusKey(entry.resultStatus))}
                                                </Typography>
                                            )}
                                            {entry.notes && (
                                                <Typography variant="caption" color="text.secondary" component="div">
                                                    {entry.notes}
                                                </Typography>
                                            )}
                                            {state === 'voided' && (
                                                <Typography variant="caption" color="error" component="div">
                                                    {t('dental.voidedBy', {
                                                        name: staffName(entry.voidedBy),
                                                        date: formatDate(entry.voidedAt!),
                                                    })}
                                                    {entry.voidReason && `: ${entry.voidReason}`}
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell>{staffName(entry.dentistId)}</TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                            {entry.cost != null ? formatCurrency(entry.cost, entry.currency) : '—'}
                                        </TableCell>
                                        <TableCell>
                                            <StatusChip status={state} label={t(`dental.${state}`)} />
                                        </TableCell>
                                        {canEdit && (
                                            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                {state === 'planned' && (
                                                    <Tooltip title={t('dental.markDone')}>
                                                        <span>
                                                            <IconButton
                                                                size="small"
                                                                color="primary"
                                                                disabled={complete.loading}
                                                                aria-label={t('dental.markDone')}
                                                                onClick={() =>
                                                                    dispatch(
                                                                        dentalRecordsActions.completeEntry({
                                                                            patientId,
                                                                            entryId: entry._id,
                                                                        }),
                                                                    )
                                                                }
                                                            >
                                                                <DoneIcon fontSize="small" />
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                )}
                                                {state !== 'voided' && (
                                                    <Tooltip title={t('dental.voidEntry')}>
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            aria-label={t('dental.voidEntry')}
                                                            onClick={() => setVoidTarget(entry)}
                                                        >
                                                            <VoidIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    {entries.total > PAGE_SIZE && (
                        <TablePagination
                            component="div"
                            count={entries.total}
                            page={page}
                            onPageChange={(_, p) => setPage(p)}
                            rowsPerPage={PAGE_SIZE}
                            rowsPerPageOptions={[PAGE_SIZE]}
                        />
                    )}
                </TableContainer>
            )}

            <Dialog open={adding} onClose={() => setAdding(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {t('dental.addTreatment')}
                    <IconButton size="small" onClick={() => setAdding(false)} aria-label={t('common.close')}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ pt: '8px !important' }}>
                    {adding && <TreatmentEntryForm patientId={patientId} onSaved={() => setAdding(false)} />}
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!voidTarget}
                title={t('dental.voidTitle')}
                message={t('dental.voidMessage', { name: voidTarget?.treatmentName ?? '' })}
                variant="danger"
                confirmLabel={t('dental.voidEntry')}
                confirmDisabled={!reasonValid || voiding.loading}
                onConfirm={() => {
                    if (!voidTarget) return;
                    dispatch(
                        dentalRecordsActions.voidEntry({ patientId, entryId: voidTarget._id, reason: voidReason.trim() }),
                    );
                }}
                onCancel={() => {
                    setVoidTarget(null);
                    setVoidReason('');
                }}
            >
                <TextField
                    autoFocus
                    fullWidth
                    required
                    size="small"
                    label={t('dental.voidReason')}
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    error={!!voidReason && !reasonValid}
                    helperText={voidReason && !reasonValid ? t('dental.voidReasonHint') : undefined}
                    inputProps={{ maxLength: 500 }}
                    sx={{ mt: 2 }}
                />
            </ConfirmDialog>
        </Box>
    );
};

export default PatientTreatmentsTab;
