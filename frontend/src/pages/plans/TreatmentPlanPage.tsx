import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    List,
    ListItem,
    ListItemText,
    MenuItem,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    Add as AddIcon,
    ArrowBack as BackIcon,
    Cancel as CancelIcon,
    CheckCircle as AcceptIcon,
    CheckCircleOutline as DoneIcon,
    ContentCopy as DuplicateIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    EditNote as ReviseIcon,
    Print as PrintIcon,
    Send as PresentIcon,
    ThumbDown as DeclineIcon,
} from '@mui/icons-material';
import { RootState } from '../../store';
import { patientsActions } from '../../store/patients';
import { staffActions } from '../../store/staff';
import {
    ACCEPT_PLAN,
    CANCEL_PLAN,
    COMPLETE_PLAN_ITEM,
    DECLINE_PLAN,
    DUPLICATE_PLAN,
    GET_PLAN,
    PRESENT_PLAN,
    UPDATE_PLAN,
    treatmentPlansActions,
} from '../../store/treatment-plans';
import { ConfirmDialog, LoadingSpinner, StatusChip } from '../../components/ui';
import PlanItemDialog from '../../components/plans/PlanItemDialog';
import { useHttpState, usePermission } from '../../hooks';
import { TreatmentPlan, TreatmentPlanItem } from '../../types';
import { formatCurrency, formatDate, formatDateTime, getFullName } from '../../utils/formatters';
import { staffName } from '../../utils/references';
import { staffRefId } from '../../utils/staff';
import { teethLabel, toothStatusKey } from '../../utils/dental';
import { toLocalDateString } from '../../utils/dates';
import { byStage, isDeclinedItem, isExpired, isOpenItem, planLink } from '../../utils/plans';
import { addDays, format, parseISO } from 'date-fns';

type Reason = { kind: 'decline' | 'cancel' } | null;

/** "Done", "declined", "voided" or "planned" for an item, as a status-chip key. */
const itemState = (item: TreatmentPlanItem) =>
    isDeclinedItem(item) ? 'declined' : item.voidedAt ? 'voided' : item.status;

const invoiceNumberOf = (item: TreatmentPlanItem) =>
    item.invoiceId && typeof item.invoiceId === 'object' ? item.invoiceId.invoiceNumber : null;

const TreatmentPlanPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { id: patientId, planId } = useParams<{ id: string; planId: string }>();
    const can = usePermission();
    const editor = can('editTreatmentPlans');
    const decider = can('decideTreatmentPlans');
    const chartEditor = can('editDentalChart');

    const stored = useSelector((state: RootState) => state.treatmentPlans.current);
    const storedPatient = useSelector((state: RootState) => state.patients.current);
    const clinic = useSelector((state: RootState) => state.clinic.clinic);
    const dentists = useSelector((state: RootState) => state.staff.dentists);
    const load = useHttpState(GET_PLAN);
    const present = useHttpState(PRESENT_PLAN);
    const accept = useHttpState(ACCEPT_PLAN);
    const decline = useHttpState(DECLINE_PLAN);
    const cancel = useHttpState(CANCEL_PLAN);
    const update = useHttpState(UPDATE_PLAN);
    const duplicate = useHttpState(DUPLICATE_PLAN);
    const completing = useHttpState(COMPLETE_PLAN_ITEM);

    const plan: TreatmentPlan | null = stored && stored._id === planId ? stored : null;
    const patient = storedPatient && storedPatient._id === patientId ? storedPatient : null;
    const today = useMemo(() => toLocalDateString(), []);

    const [itemDialog, setItemDialog] = useState<{ item: TreatmentPlanItem | null } | null>(null);
    const [removeTarget, setRemoveTarget] = useState<TreatmentPlanItem | null>(null);
    const [presentOpen, setPresentOpen] = useState(false);
    const [validUntil, setValidUntil] = useState('');
    const [acceptOpen, setAcceptOpen] = useState(false);
    const [declinedIds, setDeclinedIds] = useState<string[]>([]);
    const [reasonFor, setReasonFor] = useState<Reason>(null);
    const [reason, setReason] = useState('');
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [details, setDetails] = useState({ title: '', dentistId: '', notes: '' });

    useEffect(() => {
        if (planId) dispatch(treatmentPlansActions.getPlan(planId));
    }, [dispatch, planId]);

    useEffect(() => {
        if (patientId && !patient) dispatch(patientsActions.getPatient(patientId));
        if (dentists.length === 0) dispatch(staffActions.getDentists());
    }, [patientId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Close each dialog once its request succeeded.
    useEffect(() => {
        if (present.success) { present.clearSuccess(); setPresentOpen(false); }
    }, [present.success]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (accept.success) { accept.clearSuccess(); setAcceptOpen(false); }
    }, [accept.success]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (decline.success || cancel.success) {
            decline.clearSuccess();
            cancel.clearSuccess();
            setReasonFor(null);
        }
    }, [decline.success, cancel.success]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (update.success) { update.clearSuccess(); setDetailsOpen(false); }
    }, [update.success]); // eslint-disable-line react-hooks/exhaustive-deps
    // A copy opens as its own page.
    useEffect(() => {
        if (!duplicate.success || !stored) return;
        duplicate.clearSuccess();
        navigate(planLink(stored));
    }, [duplicate.success]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!plan) {
        if (load.error && !load.loading) {
            return (
                <Alert
                    severity="error"
                    action={<Button color="inherit" size="small" onClick={() => planId && dispatch(treatmentPlansActions.getPlan(planId))}>{t('common.retry')}</Button>}
                >
                    {load.error}
                </Alert>
            );
        }
        return <LoadingSpinner />;
    }

    const items = plan.items ?? [];
    const stages = byStage(items);
    const showStages = stages.length > 1 || (stages[0]?.stage ?? 1) > 1;
    const open = items.filter(isOpenItem);
    const isDraft = plan.status === 'draft';
    const awaiting = ['draft', 'presented'].includes(plan.status);
    const expired = isExpired(plan, today);
    const { summary } = plan;
    const money = (n: number) => formatCurrency(n, plan.currency);
    const patientName = patient ? getFullName(patient.firstName, patient.lastName, patient.patronymic) : '';
    const lastStage = items.reduce((max, i) => Math.max(max, i.stage ?? 1), 1);
    const acceptedPreview = open.filter((i) => !declinedIds.includes(i._id)).reduce((s, i) => s + i.net, 0);
    const address = clinic ? [clinic.address?.street, clinic.address?.city, clinic.address?.country].filter(Boolean).join(', ') : '';

    const openPresent = () => {
        present.clearError();
        setValidUntil(format(addDays(parseISO(today), 30), 'yyyy-MM-dd'));
        setPresentOpen(true);
    };
    const openAccept = () => {
        accept.clearError();
        setDeclinedIds([]);
        setAcceptOpen(true);
    };
    const openReason = (kind: 'decline' | 'cancel') => {
        decline.clearError();
        cancel.clearError();
        setReason('');
        setReasonFor({ kind });
    };
    const openDetails = () => {
        update.clearError();
        setDetails({ title: plan.title, dentistId: staffRefId(plan.dentistId as any) || '', notes: plan.notes ?? '' });
        setDetailsOpen(true);
    };

    const reasonError = reasonFor?.kind === 'decline' ? decline.error : cancel.error;

    return (
        <Box>
            {/* Screen header and actions */}
            <Box sx={{ displayPrint: 'none' }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 2, mb: 2 }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Button
                            size="small"
                            startIcon={<BackIcon />}
                            onClick={() => navigate(`/patients/${plan.patientId}?tab=plans`)}
                            sx={{ mb: 1 }}
                        >
                            {patientName || t('common.back')}
                        </Button>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                            <Typography variant="h4" sx={{ overflowWrap: 'anywhere' }}>
                                {plan.title}
                            </Typography>
                            <StatusChip status={plan.status} label={t(`plans.statuses.${plan.status}`)} />
                            {isDraft && editor && (
                                <Tooltip title={t('plans.editDetails')}>
                                    <IconButton size="small" onClick={openDetails} aria-label={t('plans.editDetails')}>
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start' }}>
                        <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()} disabled={!items.length}>
                            {t('plans.printEstimate')}
                        </Button>
                        {isDraft && editor && (
                            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setItemDialog({ item: null })}>
                                {t('plans.addItem')}
                            </Button>
                        )}
                        {isDraft && editor && (
                            <Button variant="outlined" startIcon={<PresentIcon />} onClick={openPresent} disabled={!open.length}>
                                {t('plans.present')}
                            </Button>
                        )}
                        {awaiting && decider && (
                            <Button variant="contained" startIcon={<AcceptIcon />} onClick={openAccept} disabled={!open.length}>
                                {t('plans.recordAcceptance')}
                            </Button>
                        )}
                        {awaiting && decider && (
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DeclineIcon />}
                                onClick={() => openReason('decline')}
                                disabled={!open.length}
                            >
                                {t('plans.decline')}
                            </Button>
                        )}
                        {['presented', 'accepted'].includes(plan.status) && editor && (
                            <Button variant="outlined" startIcon={<ReviseIcon />} onClick={() => dispatch(treatmentPlansActions.revise({ planId: plan._id }))}>
                                {t('plans.revise')}
                            </Button>
                        )}
                        {editor && (
                            <Button
                                variant="outlined"
                                startIcon={<DuplicateIcon />}
                                disabled={duplicate.loading}
                                onClick={() => dispatch(treatmentPlansActions.duplicate({ planId: plan._id, title: `${plan.title} (${t('plans.copy')})` }))}
                            >
                                {t('plans.duplicate')}
                            </Button>
                        )}
                        {['draft', 'presented', 'accepted'].includes(plan.status) && editor && (
                            <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={() => openReason('cancel')}>
                                {t('plans.cancelPlan')}
                            </Button>
                        )}
                    </Box>
                </Box>

                {expired && <Alert severity="warning" sx={{ mb: 2 }}>{t('plans.expiredHint', { date: formatDate(plan.validUntil!) })}</Alert>}
                {plan.status === 'accepted' && <Alert severity="info" sx={{ mb: 2 }}>{t('plans.acceptedHint')}</Alert>}
                {['declined', 'cancelled'].includes(plan.status) && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        {t(`plans.closed.${plan.status}`, { date: plan.closedAt ? formatDate(plan.closedAt) : '' })}
                        {plan.closeReason && `: ${plan.closeReason}`}
                    </Alert>
                )}
                {completing.error && <Alert severity="error" sx={{ mb: 2 }} onClose={completing.clearError}>{completing.error}</Alert>}
            </Box>

            {/* Letterhead: printed only */}
            <Box sx={{ display: 'none', displayPrint: 'block', mb: 2 }}>
                {clinic && (
                    <>
                        <Typography variant="h5" fontWeight={700}>{clinic.name}</Typography>
                        {address && <Typography variant="body2">{address}</Typography>}
                        <Typography variant="body2">{[clinic.phone, clinic.email].filter(Boolean).join(' · ')}</Typography>
                        <Divider sx={{ my: 2 }} />
                    </>
                )}
                <Typography variant="h5" fontWeight={700}>{t('plans.estimateTitle')}</Typography>
                <Typography variant="subtitle1">{plan.title}</Typography>
            </Box>

            <Paper sx={{ p: 3, mb: 3, '@media print': { boxShadow: 'none', p: 0 } }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="subtitle2" color="text.secondary">{t('plans.patient')}</Typography>
                        <Typography>{patientName || '—'}</Typography>
                        {patient?.dateOfBirth && (
                            <Typography variant="caption" color="text.secondary">{formatDate(patient.dateOfBirth)}</Typography>
                        )}
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="subtitle2" color="text.secondary">{t('plans.responsibleDentist')}</Typography>
                        <Typography>{staffName(plan.dentistId)}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="subtitle2" color="text.secondary">{t('common.date')}</Typography>
                        <Typography>{formatDate(plan.presentedAt || plan.createdAt)}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="subtitle2" color="text.secondary">{t('plans.validUntil')}</Typography>
                        <Typography color={expired ? 'error.main' : undefined}>
                            {plan.validUntil ? formatDate(plan.validUntil) : '—'}
                        </Typography>
                    </Grid>
                    {plan.acceptedAt && (
                        <Grid item xs={12} sx={{ displayPrint: 'none' }}>
                            <Typography variant="body2" color="text.secondary">
                                {t('plans.acceptedBy', { name: staffName(plan.acceptedBy), date: formatDateTime(plan.acceptedAt, i18n.language) })}
                            </Typography>
                        </Grid>
                    )}
                </Grid>
            </Paper>

            {/* Items, by stage */}
            {!items.length ? (
                <Paper sx={{ p: 4, mb: 3, textAlign: 'center', displayPrint: 'none' }}>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>{t('plans.noItems')}</Typography>
                    {isDraft && editor && (
                        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setItemDialog({ item: null })}>
                            {t('plans.addItem')}
                        </Button>
                    )}
                </Paper>
            ) : (
                <TableContainer component={Paper} sx={{ mb: 3, overflowX: 'auto', '@media print': { boxShadow: 'none' } }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('dental.teeth')}</TableCell>
                                <TableCell>{t('dental.treatmentName')}</TableCell>
                                <TableCell align="right">{t('plans.price')}</TableCell>
                                <TableCell align="right">{t('billing.discount')}</TableCell>
                                <TableCell align="right">{t('billing.totalAmount')}</TableCell>
                                <TableCell sx={{ displayPrint: 'none' }}>{t('common.status')}</TableCell>
                                <TableCell sx={{ displayPrint: 'none' }} />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {stages.map(({ stage, items: stageItems, total }) => (
                                <React.Fragment key={stage}>
                                    {showStages && (
                                        <TableRow sx={{ backgroundColor: 'action.hover' }}>
                                            <TableCell colSpan={4}>
                                                <Typography variant="subtitle2">{t('plans.stageN', { n: stage })}</Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Typography variant="subtitle2">{money(total)}</Typography>
                                            </TableCell>
                                            <TableCell colSpan={2} sx={{ displayPrint: 'none' }} />
                                        </TableRow>
                                    )}
                                    {stageItems.map((item) => {
                                        const state = itemState(item);
                                        const struck = !!item.voidedAt;
                                        const invoice = invoiceNumberOf(item);
                                        return (
                                            <TableRow
                                                key={item._id}
                                                sx={{
                                                    ...(struck ? { opacity: 0.6 } : {}),
                                                    // The estimate shows what is offered: no voided lines.
                                                    ...(struck && !isDeclinedItem(item) ? { '@media print': { display: 'none' } } : {}),
                                                }}
                                            >
                                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{teethLabel(item.teeth) || t('dental.wholeMouth')}</TableCell>
                                                <TableCell sx={{ minWidth: 160, overflowWrap: 'anywhere' }}>
                                                    <Typography variant="body2" fontWeight={600} sx={struck ? { textDecoration: 'line-through' } : undefined}>
                                                        {item.treatmentName}
                                                    </Typography>
                                                    {item.resultStatus && item.teeth.length > 0 && (
                                                        <Typography variant="caption" color="text.secondary" component="div">
                                                            → {t(toothStatusKey(item.resultStatus))}
                                                        </Typography>
                                                    )}
                                                    {item.notes && (
                                                        <Typography variant="caption" color="text.secondary" component="div">{item.notes}</Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(item.cost ?? 0)}</TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{item.discount ? `${item.discount}%` : '—'}</TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{money(item.net)}</TableCell>
                                                <TableCell sx={{ displayPrint: 'none', whiteSpace: 'nowrap' }}>
                                                    <StatusChip status={state} label={t(state === 'declined' ? 'plans.itemDeclined' : `dental.${state}`)} />
                                                    {invoice && (
                                                        <Typography variant="caption" color="text.secondary" component="div">{invoice}</Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell align="right" sx={{ displayPrint: 'none', whiteSpace: 'nowrap' }}>
                                                    {isDraft && editor && isOpenItem(item) && (
                                                        <>
                                                            <Tooltip title={t('common.edit')}>
                                                                <IconButton size="small" onClick={() => setItemDialog({ item })} aria-label={t('common.edit')}>
                                                                    <EditIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title={t('plans.removeItem')}>
                                                                <IconButton size="small" color="error" onClick={() => setRemoveTarget(item)} aria-label={t('plans.removeItem')}>
                                                                    <DeleteIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </>
                                                    )}
                                                    {chartEditor && isOpenItem(item) && ['draft', 'presented', 'accepted'].includes(plan.status) && (
                                                        <Tooltip title={t('dental.markDone')}>
                                                            <span>
                                                                <IconButton
                                                                    size="small"
                                                                    color="primary"
                                                                    disabled={completing.loading}
                                                                    aria-label={t('dental.markDone')}
                                                                    onClick={() =>
                                                                        dispatch(
                                                                            treatmentPlansActions.completeItem({
                                                                                planId: plan._id,
                                                                                patientId: plan.patientId,
                                                                                itemId: item._id,
                                                                            }),
                                                                        )
                                                                    }
                                                                >
                                                                    <DoneIcon fontSize="small" />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Totals */}
            {items.length > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                    <Box sx={{ minWidth: 280 }}>
                        {summary.discount > 0 && (
                            <>
                                <TotalRow label={t('billing.subtotal')} value={money(summary.subtotal)} />
                                <TotalRow label={t('billing.discount')} value={`− ${money(summary.discount)}`} />
                            </>
                        )}
                        <TotalRow label={t('plans.estimateTotal')} value={money(summary.total)} bold />
                        {summary.acceptedTotal !== null && (
                            <Box sx={{ displayPrint: 'none' }}>
                                <TotalRow label={t('plans.doneTotal')} value={money(summary.doneTotal)} />
                                <TotalRow label={t('plans.remaining')} value={money(Math.max(0, summary.total - summary.doneTotal))} />
                            </Box>
                        )}
                    </Box>
                </Box>
            )}

            {plan.notes && (
                <Paper sx={{ p: 2, mb: 3, '@media print': { boxShadow: 'none', p: 0 } }}>
                    <Typography variant="subtitle2" color="text.secondary">{t('patients.notes')}</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{plan.notes}</Typography>
                </Paper>
            )}

            {/* Printed only: validity and signatures */}
            <Box sx={{ display: 'none', displayPrint: 'block', mt: 4 }}>
                {plan.validUntil && (
                    <Typography variant="body2" sx={{ mb: 1 }}>{t('plans.printValidity', { date: formatDate(plan.validUntil) })}</Typography>
                )}
                <Typography variant="body2" sx={{ mb: 6 }}>{t('plans.printDisclaimer')}</Typography>
                <Grid container spacing={6}>
                    {[t('plans.patientSignature'), t('plans.dentistSignature')].map((label) => (
                        <Grid item xs={6} key={label}>
                            <Divider sx={{ borderColor: 'text.primary', mb: 0.5 }} />
                            <Typography variant="caption">{label}</Typography>
                        </Grid>
                    ))}
                </Grid>
            </Box>

            {/* History: screen only */}
            {!!plan.history?.length && (
                <Paper sx={{ p: 2, displayPrint: 'none' }}>
                    <Typography variant="subtitle2" color="text.secondary">{t('plans.history')}</Typography>
                    <List dense disablePadding>
                        {[...plan.history].reverse().map((h, index) => (
                            <ListItem key={index} disableGutters>
                                <ListItemText
                                    primary={t(`plans.actions.${h.action}`)}
                                    secondary={[
                                        staffName(h.by),
                                        formatDateTime(h.at, i18n.language),
                                        // An acceptance's note is the number of items declined.
                                        h.action === 'accepted'
                                            ? Number(h.note) > 0 && t('plans.declinedCount', { count: Number(h.note) })
                                            : h.note,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                />
                            </ListItem>
                        ))}
                    </List>
                </Paper>
            )}

            {/* ── Dialogs ── */}
            <PlanItemDialog
                open={!!itemDialog}
                plan={plan}
                item={itemDialog?.item}
                defaultStage={lastStage}
                onClose={() => setItemDialog(null)}
            />

            <ConfirmDialog
                open={!!removeTarget}
                title={t('plans.removeItem')}
                message={t('plans.removeItemMessage', { name: removeTarget?.treatmentName ?? '' })}
                variant="danger"
                confirmLabel={t('plans.removeItem')}
                onConfirm={() => {
                    if (removeTarget) dispatch(treatmentPlansActions.removeItem({ planId: plan._id, itemId: removeTarget._id }));
                    setRemoveTarget(null);
                }}
                onCancel={() => setRemoveTarget(null)}
            />

            <Dialog open={presentOpen} onClose={() => setPresentOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>{t('plans.present')}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('plans.presentHint')}</Typography>
                    {present.error && <Alert severity="error" sx={{ mb: 2 }}>{present.error}</Alert>}
                    <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label={t('plans.validUntil')}
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                        inputProps={{ min: today }}
                        InputLabelProps={{ shrink: true }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPresentOpen(false)}>{t('common.cancel')}</Button>
                    <Button
                        variant="contained"
                        disabled={!validUntil || present.loading}
                        onClick={() => dispatch(treatmentPlansActions.present({ planId: plan._id, validUntil }))}
                    >
                        {t('plans.present')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={acceptOpen} onClose={() => setAcceptOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{t('plans.recordAcceptance')}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('plans.acceptHint')}</Typography>
                    {accept.error && <Alert severity="error" sx={{ mb: 2 }}>{accept.error}</Alert>}
                    <List dense>
                        {open.map((item) => {
                            const agreed = !declinedIds.includes(item._id);
                            return (
                                <ListItem
                                    key={item._id}
                                    disableGutters
                                    secondaryAction={<Typography variant="body2">{money(item.net)}</Typography>}
                                >
                                    <Checkbox
                                        edge="start"
                                        checked={agreed}
                                        onChange={() =>
                                            setDeclinedIds((prev) => (agreed ? [...prev, item._id] : prev.filter((x) => x !== item._id)))
                                        }
                                        inputProps={{ 'aria-label': item.treatmentName }}
                                    />
                                    <ListItemText
                                        primary={item.treatmentName}
                                        secondary={teethLabel(item.teeth) || t('dental.wholeMouth')}
                                        sx={!agreed ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}
                                    />
                                </ListItem>
                            );
                        })}
                    </List>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="subtitle2">{t('plans.acceptedTotal')}</Typography>
                        <Typography variant="subtitle2">{money(Math.round(acceptedPreview * 100) / 100)}</Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAcceptOpen(false)}>{t('common.cancel')}</Button>
                    <Button
                        variant="contained"
                        disabled={accept.loading || declinedIds.length >= open.length}
                        onClick={() => dispatch(treatmentPlansActions.accept({ planId: plan._id, revision: plan.revision, declinedItemIds: declinedIds }))}
                    >
                        {t('plans.confirmAcceptance')}
                    </Button>
                </DialogActions>
            </Dialog>

            <ConfirmDialog
                open={!!reasonFor}
                title={reasonFor?.kind === 'decline' ? t('plans.declineTitle') : t('plans.cancelTitle')}
                message={reasonFor?.kind === 'decline' ? t('plans.declineMessage') : t('plans.cancelMessage')}
                variant="danger"
                confirmLabel={reasonFor?.kind === 'decline' ? t('plans.decline') : t('plans.cancelPlan')}
                confirmDisabled={reason.trim().length < 3 || decline.loading || cancel.loading}
                onConfirm={() => {
                    const payload = { planId: plan._id, reason: reason.trim() };
                    dispatch(reasonFor?.kind === 'decline' ? treatmentPlansActions.decline(payload) : treatmentPlansActions.cancel(payload));
                }}
                onCancel={() => setReasonFor(null)}
            >
                {reasonError && <Alert severity="error" sx={{ mt: 2 }}>{reasonError}</Alert>}
                <TextField
                    autoFocus
                    fullWidth
                    required
                    size="small"
                    label={t('plans.reason')}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    helperText={reason && reason.trim().length < 3 ? t('dental.voidReasonHint') : undefined}
                    inputProps={{ maxLength: 500 }}
                    sx={{ mt: 2 }}
                />
            </ConfirmDialog>

            <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{t('plans.editDetails')}</DialogTitle>
                <DialogContent>
                    {update.error && <Alert severity="error" sx={{ mb: 2 }}>{update.error}</Alert>}
                    <TextField
                        fullWidth
                        required
                        size="small"
                        label={t('plans.title')}
                        value={details.title}
                        onChange={(e) => setDetails({ ...details, title: e.target.value })}
                        inputProps={{ maxLength: 120 }}
                        sx={{ mt: 1, mb: 2 }}
                    />
                    <TextField
                        select
                        fullWidth
                        size="small"
                        label={t('plans.responsibleDentist')}
                        value={details.dentistId}
                        onChange={(e) => setDetails({ ...details, dentistId: e.target.value })}
                        sx={{ mb: 2 }}
                    >
                        {dentists.map((d: any) => (
                            <MenuItem key={d._id} value={staffRefId(d)}>
                                {d.lastName} {d.firstName}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        size="small"
                        label={t('plans.notesForPatient')}
                        value={details.notes}
                        onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                        inputProps={{ maxLength: 2000 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetailsOpen(false)}>{t('common.cancel')}</Button>
                    <Button
                        variant="contained"
                        disabled={!details.title.trim() || update.loading}
                        onClick={() =>
                            dispatch(
                                treatmentPlansActions.updatePlan({
                                    planId: plan._id,
                                    data: {
                                        title: details.title.trim(),
                                        notes: details.notes,
                                        ...(details.dentistId ? { dentistId: details.dentistId } : {}),
                                    },
                                }),
                            )
                        }
                    >
                        {t('common.save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

const TotalRow: React.FC<{ label: string; value: string; bold?: boolean }> = ({ label, value, bold }) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 3, py: 0.5 }}>
        <Typography variant={bold ? 'subtitle1' : 'body2'} fontWeight={bold ? 700 : 400}>{label}</Typography>
        <Typography variant={bold ? 'subtitle1' : 'body2'} fontWeight={bold ? 700 : 400}>{value}</Typography>
    </Box>
);

export default TreatmentPlanPage;
