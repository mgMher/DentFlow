import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Card,
    CardActionArea,
    CardContent,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    LinearProgress,
    MenuItem,
    TextField,
    Typography,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { RootState } from '../../store';
import { CREATE_PLAN, treatmentPlansActions } from '../../store/treatment-plans';
import { staffActions } from '../../store/staff';
import { EmptyState, LoadingSpinner, StatusChip } from '../../components/ui';
import { useHttpState, usePermission } from '../../hooks';
import { TreatmentPlan } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { staffName } from '../../utils/references';
import { staffRefId } from '../../utils/staff';
import { toLocalDateString } from '../../utils/dates';
import { isExpired, planLink } from '../../utils/plans';

/** Option A, B, C… for the next plan. */
const nextLetter = (count: number) => String.fromCharCode(65 + (count % 26));

const PlanCard: React.FC<{ plan: TreatmentPlan; today: string }> = ({ plan, today }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { summary } = plan;
    const progress = summary.items ? Math.round((summary.done / summary.items) * 100) : 0;
    const expired = isExpired(plan, today);

    return (
        <Card variant="outlined" sx={{ height: '100%' }}>
            <CardActionArea onClick={() => navigate(planLink(plan))} sx={{ height: '100%' }}>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
                            {plan.title}
                        </Typography>
                        <StatusChip status={plan.status} label={t(`plans.statuses.${plan.status}`)} />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                        {staffName(plan.dentistId)} · {formatDate(plan.createdAt)}
                    </Typography>
                    <Typography variant="h6" sx={{ mt: 1.5 }}>
                        {formatCurrency(summary.total, plan.currency)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="div">
                        {t('plans.itemsCount', { count: summary.items })}
                        {summary.discount > 0 && ` · ${t('plans.discountShort', { amount: formatCurrency(summary.discount, plan.currency) })}`}
                    </Typography>
                    {['accepted', 'completed'].includes(plan.status) && summary.items > 0 && (
                        <Box sx={{ mt: 1.5 }}>
                            <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
                            <Typography variant="caption" color="text.secondary">
                                {t('plans.progress', { done: summary.done, total: summary.items })}
                            </Typography>
                        </Box>
                    )}
                    {plan.status === 'presented' && plan.validUntil && (
                        <Typography variant="caption" color={expired ? 'error.main' : 'text.secondary'} component="div" sx={{ mt: 1 }}>
                            {expired ? t('plans.expiredOn', { date: formatDate(plan.validUntil) }) : t('plans.validUntilDate', { date: formatDate(plan.validUntil) })}
                        </Typography>
                    )}
                </CardContent>
            </CardActionArea>
        </Card>
    );
};

/** The patient's treatment plans (options), newest first, and a way to start one. */
const PatientPlansTab: React.FC<{ patientId: string; closed: boolean }> = ({ patientId, closed }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const can = usePermission();
    const { list, patientId: listFor, current } = useSelector((state: RootState) => state.treatmentPlans);
    const dentists = useSelector((state: RootState) => state.staff.dentists);
    const user = useSelector((state: RootState) => state.auth.user);
    const loading = useSelector((state: RootState) => state.http.loading.includes('GET_PLANS'));
    const create = useHttpState(CREATE_PLAN);
    const today = toLocalDateString();

    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [dentistId, setDentistId] = useState('');

    useEffect(() => {
        dispatch(treatmentPlansActions.getPlans(patientId));
        if (dentists.length === 0) dispatch(staffActions.getDentists());
    }, [dispatch, patientId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Open the new plan straight away.
    useEffect(() => {
        if (!create.success || !current) return;
        create.clearSuccess();
        setOpen(false);
        navigate(planLink(current));
    }, [create.success]); // eslint-disable-line react-hooks/exhaustive-deps

    const plans = listFor === patientId ? list : [];

    const start = () => {
        create.clearError();
        setTitle(`${t('plans.option')} ${nextLetter(plans.length)}`);
        const self = dentists.find((d: any) => staffRefId(d) === user?._id);
        setDentistId(staffRefId(self) || '');
        setOpen(true);
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Typography variant="body2" color="text.secondary">
                    {t('plans.tabHint')}
                </Typography>
                {can('editTreatmentPlans') && !closed && (
                    <Button variant="contained" startIcon={<AddIcon />} onClick={start}>
                        {t('plans.newPlan')}
                    </Button>
                )}
            </Box>

            {loading && !plans.length ? (
                <LoadingSpinner />
            ) : !plans.length ? (
                <EmptyState title={t('plans.noPlans')} />
            ) : (
                <Grid container spacing={2}>
                    {plans.map((plan) => (
                        <Grid item xs={12} sm={6} lg={4} key={plan._id}>
                            <PlanCard plan={plan} today={today} />
                        </Grid>
                    ))}
                </Grid>
            )}

            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>{t('plans.newPlan')}</DialogTitle>
                <DialogContent>
                    {create.error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {create.error}
                        </Alert>
                    )}
                    <TextField
                        autoFocus
                        required
                        fullWidth
                        size="small"
                        label={t('plans.title')}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        inputProps={{ maxLength: 120 }}
                        sx={{ mt: 1, mb: 2 }}
                    />
                    <TextField
                        select
                        required
                        fullWidth
                        size="small"
                        label={t('plans.responsibleDentist')}
                        value={dentistId}
                        onChange={(e) => setDentistId(e.target.value)}
                    >
                        {dentists.map((d: any) => (
                            <MenuItem key={d._id} value={staffRefId(d)}>
                                {d.lastName} {d.firstName}
                            </MenuItem>
                        ))}
                    </TextField>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
                    <Button
                        variant="contained"
                        disabled={!title.trim() || !dentistId || create.loading}
                        onClick={() => dispatch(treatmentPlansActions.createPlan({ patientId, title: title.trim(), dentistId }))}
                    >
                        {t('common.create')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default PatientPlansTab;
