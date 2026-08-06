import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Tooltip,
    TextField,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Grid,
    Chip,
    InputAdornment,
    Card,
    CardContent,
    CardActions,
    ToggleButtonGroup,
    ToggleButton,
} from '@mui/material';
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
    Search as SearchIcon,
    ViewList as ListIcon,
    GridView as GridViewIcon,
    AccessTime as ClockIcon,
} from '@mui/icons-material';
import { RootState } from '../../store';
import { treatmentsActions } from '../../store/treatments';
import { PageHeader, StatusChip, EmptyState, LoadingSpinner, ConfirmDialog } from '../../components/ui';
import { formatCurrency } from '../../utils/formatters';
import { TREATMENT_CATEGORIES, CURRENCY_SYMBOLS } from '../../utils/constants';
import { Treatment, TreatmentCategory, Currency } from '../../types';

// ── Form type ───────────────────────────────────────────────────────────────

interface TreatmentForm {
    name: string;
    nameHy: string;
    nameRu: string;
    category: TreatmentCategory;
    code: string;
    duration: number;
    priceAmount: number;
    priceCurrency: Currency;
    description: string;
}

// ── Category color map ──────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
    general: { bg: '#EBF4FF', color: '#3182CE' },
    surgical: { bg: '#FFF5F5', color: '#E53E3E' },
    cosmetic: { bg: '#FAF5FF', color: '#805AD5' },
    orthodontic: { bg: '#FFFFF0', color: '#D69E2E' },
    endodontic: { bg: '#FFFAF0', color: '#ED8936' },
    periodontic: { bg: '#E6FFFA', color: '#0B5E6E' },
    prosthodontic: { bg: '#F0FFF4', color: '#38A169' },
    pediatric: { bg: '#EBF4FF', color: '#3182CE' },
    diagnostic: { bg: '#F7FAFC', color: '#4A5568' },
    preventive: { bg: '#F0FFF4', color: '#2F855A' },
};

// ── Component ───────────────────────────────────────────────────────────────

const TreatmentsPage: React.FC = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();

    const { list: treatments, total } = useSelector((state: RootState) => state.treatments);
    const { loading } = useSelector((state: RootState) => state.http);

    const isLoading = loading.includes('GET_TREATMENTS');
    const isSaving = loading.includes('CREATE_TREATMENT') || loading.includes('UPDATE_TREATMENT');

    // ── Local state ─────────────────────────────────────────────────────────

    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Treatment | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    // ── Form ────────────────────────────────────────────────────────────────

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<TreatmentForm>({
        defaultValues: {
            name: '',
            nameHy: '',
            nameRu: '',
            category: 'general',
            code: '',
            duration: 30,
            priceAmount: 0,
            priceCurrency: 'AMD',
            description: '',
        },
    });

    // ── Effects ─────────────────────────────────────────────────────────────

    useEffect(() => {
        dispatch(treatmentsActions.getTreatments());
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Filtered list ───────────────────────────────────────────────────────

    const filteredTreatments = useMemo(() => {
        let result = [...treatments];
        if (selectedCategory !== 'all') {
            result = result.filter((tr) => tr.category === selectedCategory);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (tr) =>
                    tr.name.toLowerCase().includes(q) ||
                    (tr.nameHy || '').toLowerCase().includes(q) ||
                    (tr.nameRu || '').toLowerCase().includes(q) ||
                    (tr.code || '').toLowerCase().includes(q),
            );
        }
        return result;
    }, [treatments, selectedCategory, searchQuery]);

    // ── Handlers ────────────────────────────────────────────────────────────

    const handleViewChange = (_: React.MouseEvent<HTMLElement>, value: 'table' | 'grid' | null) => {
        if (value) setViewMode(value);
    };

    const handleOpenCreate = () => {
        setEditingTreatment(null);
        reset({
            name: '',
            nameHy: '',
            nameRu: '',
            category: 'general',
            code: '',
            duration: 30,
            priceAmount: 0,
            priceCurrency: 'AMD',
            description: '',
        });
        setDialogOpen(true);
    };

    const handleOpenEdit = (treatment: Treatment) => {
        setEditingTreatment(treatment);
        reset({
            name: treatment.name,
            nameHy: treatment.nameHy || '',
            nameRu: treatment.nameRu || '',
            category: treatment.category,
            code: treatment.code || '',
            duration: treatment.duration,
            priceAmount: treatment.price.amount,
            priceCurrency: treatment.price.currency,
            description: treatment.description || '',
        });
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingTreatment(null);
        reset();
    };

    const onSubmit = (data: TreatmentForm) => {
        const payload: Partial<Treatment> = {
            name: data.name,
            nameHy: data.nameHy || undefined,
            nameRu: data.nameRu || undefined,
            category: data.category,
            code: data.code || undefined,
            duration: data.duration,
            price: { amount: data.priceAmount, currency: data.priceCurrency },
            description: data.description || undefined,
        };

        if (editingTreatment) {
            dispatch(treatmentsActions.updateTreatment({ id: editingTreatment._id, data: payload }));
        } else {
            dispatch(treatmentsActions.createTreatment(payload));
        }
        handleCloseDialog();
    };

    const handleDeleteConfirm = () => {
        if (deleteTarget) {
            dispatch(treatmentsActions.deleteTreatment(deleteTarget._id));
            setDeleteTarget(null);
        }
    };

    // ── Category chip rendering ─────────────────────────────────────────────

    const renderCategoryChip = (category: string) => {
        const colors = CATEGORY_COLORS[category] || { bg: '#F7FAFC', color: '#A0AEC0' };
        return (
            <Chip
                label={t(`treatments.${category}`)}
                size="small"
                sx={{
                    backgroundColor: colors.bg,
                    color: colors.color,
                    fontWeight: 600,
                    fontSize: 12,
                }}
            />
        );
    };

    // ── Render ───────────────────────────────────────────────────────────────

    if (isLoading && treatments.length === 0) {
        return <LoadingSpinner fullPage />;
    }

    return (
        <Box>
            <PageHeader
                title={t('treatments.title')}
                actionLabel={t('treatments.addTreatment')}
                onAction={handleOpenCreate}
            >
                <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={handleViewChange}
                    size="small"
                >
                    <ToggleButton value="table">
                        <Tooltip title={t('appointments.listView')}>
                            <ListIcon />
                        </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="grid">
                        <Tooltip title="Grid">
                            <GridViewIcon />
                        </Tooltip>
                    </ToggleButton>
                </ToggleButtonGroup>
            </PageHeader>

            {/* Search + Category filter bar */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
                    <TextField
                        size="small"
                        placeholder={t('common.search')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ minWidth: 240 }}
                    />
                    <Box sx={{ flex: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                        {filteredTreatments.length} / {total}
                    </Typography>
                </Box>

                {/* Category chips (horizontal scrollable) */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                        label={t('common.all')}
                        size="small"
                        variant={selectedCategory === 'all' ? 'filled' : 'outlined'}
                        color={selectedCategory === 'all' ? 'primary' : 'default'}
                        onClick={() => setSelectedCategory('all')}
                    />
                    {TREATMENT_CATEGORIES.map((cat) => (
                        <Chip
                            key={cat}
                            label={t(`treatments.${cat}`)}
                            size="small"
                            variant={selectedCategory === cat ? 'filled' : 'outlined'}
                            color={selectedCategory === cat ? 'primary' : 'default'}
                            onClick={() => setSelectedCategory(cat)}
                            sx={
                                selectedCategory !== cat
                                    ? {
                                        backgroundColor: CATEGORY_COLORS[cat]?.bg,
                                        color: CATEGORY_COLORS[cat]?.color,
                                        borderColor: CATEGORY_COLORS[cat]?.color,
                                    }
                                    : undefined
                            }
                        />
                    ))}
                </Box>
            </Paper>

            {/* Content */}
            {filteredTreatments.length === 0 ? (
                <EmptyState
                    title={t('treatments.noTreatments')}
                    actionLabel={t('treatments.addTreatment')}
                    onAction={handleOpenCreate}
                />
            ) : viewMode === 'table' ? (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('treatments.name')}</TableCell>
                                <TableCell>{t('treatments.category')}</TableCell>
                                <TableCell>{t('treatments.code')}</TableCell>
                                <TableCell>{t('treatments.duration')}</TableCell>
                                <TableCell>{t('treatments.price')}</TableCell>
                                <TableCell>{t('common.status')}</TableCell>
                                <TableCell align="right">{t('common.actions')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredTreatments.map((tr) => (
                                <TableRow key={tr._id} hover>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>
                                            {tr.name}
                                        </Typography>
                                        {tr.nameHy && (
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                {tr.nameHy}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>{renderCategoryChip(tr.category)}</TableCell>
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                            {tr.code || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <ClockIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                            <Typography variant="body2">
                                                {tr.duration} {t('common.minutes').toLowerCase()}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>
                                            {formatCurrency(tr.price.amount, tr.price.currency)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <StatusChip
                                            status={tr.isActive ? 'active' : 'inactive'}
                                            translationPrefix="common"
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title={t('common.edit')}>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleOpenEdit(tr)}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title={t('common.delete')}>
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => setDeleteTarget(tr)}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            ) : (
                /* Grid view */
                <Grid container spacing={2}>
                    {filteredTreatments.map((tr) => (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={tr._id}>
                            <Card
                                variant="outlined"
                                sx={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    transition: 'box-shadow 0.2s',
                                    '&:hover': {
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                                    },
                                }}
                            >
                                <CardContent sx={{ flex: 1 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                                        <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
                                            {tr.name}
                                        </Typography>
                                        <StatusChip
                                            status={tr.isActive ? 'active' : 'inactive'}
                                            translationPrefix="common"
                                        />
                                    </Box>

                                    <Box sx={{ mb: 1.5 }}>
                                        {renderCategoryChip(tr.category)}
                                    </Box>

                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                        {tr.code && (
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    {t('treatments.code')}
                                                </Typography>
                                                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                                    {tr.code}
                                                </Typography>
                                            </Box>
                                        )}

                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('treatments.duration')}
                                            </Typography>
                                            <Typography variant="caption" fontWeight={600}>
                                                {tr.duration} {t('common.minutes').toLowerCase()}
                                            </Typography>
                                        </Box>

                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('treatments.price')}
                                            </Typography>
                                            <Typography variant="body2" fontWeight={700} color="primary.main">
                                                {formatCurrency(tr.price.amount, tr.price.currency)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </CardContent>

                                <CardActions sx={{ px: 2, pb: 1.5, pt: 0 }}>
                                    <Button
                                        size="small"
                                        startIcon={<EditIcon />}
                                        onClick={() => handleOpenEdit(tr)}
                                    >
                                        {t('common.edit')}
                                    </Button>
                                    <Box sx={{ flex: 1 }} />
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => setDeleteTarget(tr)}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Add/Edit Treatment Dialog */}
            <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <DialogTitle>
                        {editingTreatment ? t('common.edit') : t('treatments.addTreatment')}
                    </DialogTitle>
                    <DialogContent>
                        <Grid container spacing={2} sx={{ mt: 0.5 }}>
                            {/* Name (EN) */}
                            <Grid item xs={12}>
                                <Controller
                                    name="name"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label={`${t('treatments.name')} (EN)`}
                                            error={!!errors.name}
                                            helperText={errors.name?.message}
                                        />
                                    )}
                                />
                            </Grid>

                            {/* Name (HY) */}
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="nameHy"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label={`${t('treatments.name')} (HY)`}
                                        />
                                    )}
                                />
                            </Grid>

                            {/* Name (RU) */}
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="nameRu"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label={`${t('treatments.name')} (RU)`}
                                        />
                                    )}
                                />
                            </Grid>

                            {/* Category */}
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="category"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            select
                                            fullWidth
                                            label={t('treatments.category')}
                                            error={!!errors.category}
                                            helperText={errors.category?.message}
                                        >
                                            {TREATMENT_CATEGORIES.map((cat) => (
                                                <MenuItem key={cat} value={cat}>
                                                    {t(`treatments.${cat}`)}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    )}
                                />
                            </Grid>

                            {/* Code */}
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="code"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label={t('treatments.code')}
                                            placeholder="D0120"
                                        />
                                    )}
                                />
                            </Grid>

                            {/* Duration */}
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="duration"
                                    control={control}
                                    rules={{
                                        required: t('validation.required'),
                                        min: { value: 5, message: 'Min 5' },
                                    }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            type="number"
                                            label={t('treatments.duration')}
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        {t('common.minutes').toLowerCase()}
                                                    </InputAdornment>
                                                ),
                                            }}
                                            error={!!errors.duration}
                                            helperText={errors.duration?.message}
                                            onChange={(e) => field.onChange(Number(e.target.value))}
                                        />
                                    )}
                                />
                            </Grid>

                            {/* Price amount */}
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="priceAmount"
                                    control={control}
                                    rules={{
                                        required: t('validation.required'),
                                        min: { value: 0, message: 'Min 0' },
                                    }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            type="number"
                                            label={t('treatments.price')}
                                            error={!!errors.priceAmount}
                                            helperText={errors.priceAmount?.message}
                                            onChange={(e) => field.onChange(Number(e.target.value))}
                                        />
                                    )}
                                />
                            </Grid>

                            {/* Currency */}
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="priceCurrency"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            select
                                            fullWidth
                                            label={t('billing.currency')}
                                        >
                                            {Object.entries(CURRENCY_SYMBOLS).map(([code, symbol]) => (
                                                <MenuItem key={code} value={code}>
                                                    {symbol} {code}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    )}
                                />
                            </Grid>

                            {/* Description */}
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
                                        />
                                    )}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2 }}>
                        <Button onClick={handleCloseDialog} color="inherit">
                            {t('common.cancel')}
                        </Button>
                        <Button type="submit" variant="contained" disabled={isSaving}>
                            {t('common.save')}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* Delete confirmation dialog */}
            <ConfirmDialog
                open={!!deleteTarget}
                title={t('common.delete')}
                message={`${t('common.delete')} "${deleteTarget?.name}"?`}
                confirmLabel={t('common.delete')}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteTarget(null)}
                variant="danger"
            />
        </Box>
    );
};

export default TreatmentsPage;
