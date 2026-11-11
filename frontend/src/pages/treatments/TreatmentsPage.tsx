import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    IconButton,
    InputAdornment,
    MenuItem,
    Paper,
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
    Edit as EditIcon,
    Search as SearchIcon,
    VisibilityOff as DeactivateIcon,
    Restore as ReactivateIcon,
    LibraryAdd as SeedIcon,
} from '@mui/icons-material';
import { RootState } from '../../store';
import { treatmentsActions, TreatmentInput } from '../../store/treatments';
import { PageHeader, StatusChip, EmptyState, LoadingSpinner, ConfirmDialog } from '../../components/ui';
import { useHttpState, usePermission } from '../../hooks';
import { formatCurrency } from '../../utils/formatters';
import { localizedTreatmentName } from '../../utils/appointments';
import { TOOTH_STATUSES, toothStatusKey } from '../../utils/dental';
import { TREATMENT_CATEGORIES } from '../../utils/constants';
import { Currency, ToothStatus, Treatment, TreatmentCategory } from '../../types';

const CURRENCIES: Currency[] = ['AMD', 'USD', 'RUB'];

interface TreatmentForm {
    name: string;
    nameHy: string;
    nameRu: string;
    category: TreatmentCategory;
    code: string;
    duration: number;
    priceAmount: number;
    priceCurrency: Currency;
    toothStatus: ToothStatus | '';
    description: string;
}

const CATEGORY_COLORS: Record<string, string> = {
    general: '#3182CE',
    surgical: '#E53E3E',
    cosmetic: '#805AD5',
    orthodontic: '#D69E2E',
    endodontic: '#DD6B20',
    periodontic: '#0B5E6E',
    prosthodontic: '#38A169',
    pediatric: '#D53F8C',
    diagnostic: '#4A5568',
    preventive: '#2F855A',
};

type StatusFilter = 'all' | 'active' | 'inactive';

/**
 * The clinic's treatment catalogue. Search, filters and pages run on the
 * server — the page used to load the first 20 items and filter those, with a
 * total that always read 0. Only the clinic admin edits (D5).
 */
const TreatmentsPage: React.FC = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const can = usePermission();
    const canEdit = can('editTreatments');

    const { list: treatments, total } = useSelector((state: RootState) => state.treatments);
    const clinicCurrency = (useSelector((state: RootState) => state.clinic.clinic?.currency) as Currency) || 'AMD';
    const isLoading = useSelector((state: RootState) => state.http.loading.includes('GET_TREATMENTS'));
    const loadError = useSelector((state: RootState) => state.http.errors.find((e) => e.type === 'GET_TREATMENTS'));
    const create = useHttpState('CREATE_TREATMENT');
    const update = useHttpState('UPDATE_TREATMENT');
    const deactivate = useHttpState('DELETE_TREATMENT');
    const seed = useHttpState('SEED_TREATMENTS');

    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<TreatmentCategory | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Treatment | null>(null);
    const [deactivateTarget, setDeactivateTarget] = useState<Treatment | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const blank: TreatmentForm = {
        name: '',
        nameHy: '',
        nameRu: '',
        category: 'general',
        code: '',
        duration: 30,
        priceAmount: 0,
        priceCurrency: clinicCurrency,
        toothStatus: '',
        description: '',
    };

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<TreatmentForm>({ defaultValues: blank });

    // Typing waits a moment before searching, so each keystroke is not a request.
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(0);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        dispatch(
            treatmentsActions.getTreatments({
                page: page + 1,
                limit: rowsPerPage,
                search: search || undefined,
                category: category === 'all' ? undefined : category,
                isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
            }),
        );
    }, [dispatch, page, rowsPerPage, search, category, statusFilter, reloadKey]);

    const saving = create.loading || update.loading;
    const saveFailure = editing ? update : create;

    // The dialog closes only once the server has accepted the change.
    useEffect(() => {
        if (!create.success && !update.success) return;
        create.clearSuccess();
        update.clearSuccess();
        setDialogOpen(false);
        setEditing(null);
    }, [create.success, update.success]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!deactivate.success) return;
        deactivate.clearSuccess();
        setDeactivateTarget(null);
    }, [deactivate.success]); // eslint-disable-line react-hooks/exhaustive-deps

    const openCreate = () => {
        create.clearError();
        setEditing(null);
        reset(blank);
        setDialogOpen(true);
    };

    const openEdit = (treatment: Treatment) => {
        update.clearError();
        setEditing(treatment);
        reset({
            name: treatment.name,
            nameHy: treatment.nameHy || '',
            nameRu: treatment.nameRu || '',
            category: treatment.category,
            code: treatment.code || '',
            duration: treatment.duration,
            priceAmount: treatment.price.amount,
            priceCurrency: treatment.price.currency,
            toothStatus: treatment.toothStatus || '',
            description: treatment.description || '',
        });
        setDialogOpen(true);
    };

    const onSubmit = (data: TreatmentForm) => {
        // Empty optional fields are sent as '' when editing, which clears them.
        const optional = (value: string) => (editing ? value.trim() : value.trim() || undefined);
        const payload: TreatmentInput = {
            name: data.name.trim(),
            nameHy: optional(data.nameHy),
            nameRu: optional(data.nameRu),
            category: data.category,
            code: optional(data.code),
            duration: Number(data.duration),
            price: { amount: Number(data.priceAmount), currency: data.priceCurrency },
            toothStatus: editing ? data.toothStatus : data.toothStatus || undefined,
            description: optional(data.description),
        };
        if (editing) dispatch(treatmentsActions.updateTreatment({ id: editing._id, data: payload }));
        else dispatch(treatmentsActions.createTreatment(payload));
    };

    const otherNames = (tr: Treatment) => {
        const shown = localizedTreatmentName(tr);
        return [tr.name, tr.nameHy, tr.nameRu].filter((n) => n && n !== shown).join(' · ');
    };

    const filtered = !!search || category !== 'all' || statusFilter !== 'all';
    const codeTaken = saveFailure.errorCode === 'treatmentCodeTaken';

    if (isLoading && treatments.length === 0 && !filtered && page === 0) {
        return <LoadingSpinner fullPage />;
    }

    return (
        <Box>
            <PageHeader
                title={t('treatments.title')}
                subtitle={canEdit ? undefined : t('treatments.viewOnly')}
                actionLabel={canEdit ? t('treatments.addTreatment') : undefined}
                onAction={canEdit ? openCreate : undefined}
            />

            <Paper sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
                    <TextField
                        size="small"
                        placeholder={t('treatments.searchPlaceholder')}
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        inputProps={{ maxLength: 100, 'aria-label': t('common.search') }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ minWidth: 240, flex: { xs: 1, sm: 'none' } }}
                    />
                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={statusFilter}
                        onChange={(_, value) => {
                            if (!value) return;
                            setStatusFilter(value);
                            setPage(0);
                        }}
                    >
                        <ToggleButton value="all">{t('common.all')}</ToggleButton>
                        <ToggleButton value="active">{t('common.active')}</ToggleButton>
                        <ToggleButton value="inactive">{t('common.inactive')}</ToggleButton>
                    </ToggleButtonGroup>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {(['all', ...TREATMENT_CATEGORIES] as const).map((cat) => (
                        <Chip
                            key={cat}
                            label={cat === 'all' ? t('common.all') : t(`treatments.${cat}`)}
                            size="small"
                            variant={category === cat ? 'filled' : 'outlined'}
                            color={category === cat ? 'primary' : 'default'}
                            onClick={() => {
                                setCategory(cat);
                                setPage(0);
                            }}
                        />
                    ))}
                </Box>
            </Paper>

            {loadError && !treatments.length ? (
                <EmptyState
                    title={loadError.error}
                    actionLabel={t('common.retry')}
                    onAction={() => setReloadKey((k) => k + 1)}
                />
            ) : treatments.length === 0 ? (
                filtered ? (
                    <EmptyState title={t('treatments.noTreatments')} />
                ) : (
                    <EmptyState
                        title={t('treatments.emptyCatalogue')}
                        description={canEdit ? t('treatments.seedHint') : undefined}
                        actionLabel={canEdit ? t('treatments.seedDefaults') : undefined}
                        actionIcon={<SeedIcon />}
                        onAction={canEdit && !seed.loading ? () => dispatch(treatmentsActions.seedDefaults()) : undefined}
                    />
                )
            ) : (
                <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('treatments.name')}</TableCell>
                                <TableCell>{t('treatments.category')}</TableCell>
                                <TableCell>{t('treatments.code')}</TableCell>
                                <TableCell>{t('treatments.duration')}</TableCell>
                                <TableCell align="right">{t('treatments.price')}</TableCell>
                                <TableCell>{t('treatments.toothStatus')}</TableCell>
                                <TableCell>{t('common.status')}</TableCell>
                                {canEdit && <TableCell align="right">{t('common.actions')}</TableCell>}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {treatments.map((tr) => (
                                <TableRow key={tr._id} hover sx={tr.isActive ? undefined : { opacity: 0.6 }}>
                                    <TableCell sx={{ minWidth: 200 }}>
                                        <Typography variant="body2" fontWeight={600}>
                                            {localizedTreatmentName(tr)}
                                        </Typography>
                                        {otherNames(tr) && (
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                {otherNames(tr)}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={t(`treatments.${tr.category}`)}
                                            size="small"
                                            variant="outlined"
                                            sx={{ color: CATEGORY_COLORS[tr.category], borderColor: CATEGORY_COLORS[tr.category], fontWeight: 600 }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{tr.code || '—'}</TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                        {t('appointments.minutes', { count: tr.duration })}
                                    </TableCell>
                                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                                        {formatCurrency(tr.price.amount, tr.price.currency)}
                                    </TableCell>
                                    <TableCell>{tr.toothStatus ? t(toothStatusKey(tr.toothStatus)) : '—'}</TableCell>
                                    <TableCell>
                                        <StatusChip status={tr.isActive ? 'active' : 'inactive'} translationPrefix="common" />
                                    </TableCell>
                                    {canEdit && (
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                            <Tooltip title={t('common.edit')}>
                                                <IconButton size="small" onClick={() => openEdit(tr)} aria-label={t('common.edit')}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            {tr.isActive ? (
                                                <Tooltip title={t('common.deactivate')}>
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => setDeactivateTarget(tr)}
                                                        aria-label={t('common.deactivate')}
                                                    >
                                                        <DeactivateIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            ) : (
                                                <Tooltip title={t('treatments.reactivate')}>
                                                    <IconButton
                                                        size="small"
                                                        color="primary"
                                                        onClick={() => dispatch(treatmentsActions.reactivateTreatment(tr._id))}
                                                        aria-label={t('treatments.reactivate')}
                                                    >
                                                        <ReactivateIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <TablePagination
                        component="div"
                        count={total}
                        page={page}
                        onPageChange={(_, p) => setPage(p)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(e) => {
                            setRowsPerPage(Number(e.target.value));
                            setPage(0);
                        }}
                        rowsPerPageOptions={[20, 50, 100]}
                        labelRowsPerPage={t('common.rowsPerPage')}
                        labelDisplayedRows={({ from, to, count }) => t('common.displayedRows', { from, to, total: count })}
                    />
                </TableContainer>
            )}

            {/* Create / Edit Dialog */}
            <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth>
                <form onSubmit={handleSubmit(onSubmit)} noValidate>
                    <DialogTitle>{editing ? t('common.edit') : t('treatments.addTreatment')}</DialogTitle>
                    <DialogContent>
                        {saveFailure.error && !codeTaken && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {saveFailure.error}
                            </Alert>
                        )}
                        <Grid container spacing={2} sx={{ mt: 0 }}>
                            {(['name', 'nameHy', 'nameRu'] as const).map((field) => (
                                <Grid item xs={12} key={field}>
                                    <Controller
                                        name={field}
                                        control={control}
                                        rules={field === 'name' ? { validate: (v) => !!v.trim() || t('validation.required') } : undefined}
                                        render={({ field: f }) => (
                                            <TextField
                                                {...f}
                                                fullWidth
                                                required={field === 'name'}
                                                label={t(`treatments.${field}Label`)}
                                                error={!!errors[field]}
                                                helperText={errors[field]?.message}
                                                inputProps={{ maxLength: 200 }}
                                            />
                                        )}
                                    />
                                </Grid>
                            ))}
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="category"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField {...field} select fullWidth label={t('treatments.category')}>
                                            {TREATMENT_CATEGORIES.map((cat) => (
                                                <MenuItem key={cat} value={cat}>
                                                    {t(`treatments.${cat}`)}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="code"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label={t('treatments.code')}
                                            error={codeTaken}
                                            helperText={codeTaken ? saveFailure.error : t('treatments.codeHelper')}
                                            inputProps={{ maxLength: 40, style: { textTransform: 'uppercase' } }}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="duration"
                                    control={control}
                                    rules={{ min: { value: 5, message: t('treatments.durationRange') }, max: { value: 480, message: t('treatments.durationRange') } }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            type="number"
                                            label={t('treatments.duration')}
                                            error={!!errors.duration}
                                            helperText={errors.duration?.message}
                                            InputProps={{ endAdornment: <InputAdornment position="end">{t('common.minutes').toLowerCase()}</InputAdornment> }}
                                            inputProps={{ min: 5, max: 480, step: 5 }}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={7} sm={5}>
                                <Controller
                                    name="priceAmount"
                                    control={control}
                                    rules={{ min: { value: 0, message: t('validation.required') } }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            type="number"
                                            label={t('treatments.price')}
                                            error={!!errors.priceAmount}
                                            inputProps={{ min: 0, step: 'any' }}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={5} sm={3}>
                                <Controller
                                    name="priceCurrency"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField {...field} select fullWidth label={t('billing.currency')}>
                                            {CURRENCIES.map((code) => (
                                                <MenuItem key={code} value={code}>
                                                    {code}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Controller
                                    name="toothStatus"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            select
                                            fullWidth
                                            label={t('treatments.toothStatus')}
                                            helperText={t('treatments.toothStatusHelper')}
                                        >
                                            <MenuItem value="">{t('dental.noChartChange')}</MenuItem>
                                            {TOOTH_STATUSES.map((s) => (
                                                <MenuItem key={s} value={s}>
                                                    {t(toothStatusKey(s))}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Controller
                                    name="description"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            multiline
                                            rows={3}
                                            label={t('treatments.description')}
                                            inputProps={{ maxLength: 2000 }}
                                        />
                                    )}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2 }}>
                        <Button onClick={() => setDialogOpen(false)} color="inherit" disabled={saving}>
                            {t('common.cancel')}
                        </Button>
                        <Button type="submit" variant="contained" disabled={saving}>
                            {saving ? t('common.loading') : t('common.save')}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            <ConfirmDialog
                open={!!deactivateTarget}
                title={t('treatments.deactivateTitle')}
                message={t('treatments.deactivateMessage', {
                    name: deactivateTarget ? localizedTreatmentName(deactivateTarget) : '',
                })}
                variant="danger"
                confirmLabel={t('common.deactivate')}
                confirmDisabled={deactivate.loading}
                onConfirm={() => deactivateTarget && dispatch(treatmentsActions.deleteTreatment(deactivateTarget._id))}
                onCancel={() => setDeactivateTarget(null)}
            />
        </Box>
    );
};

export default TreatmentsPage;
