import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
    Alert,
    Box,
    Chip,
    InputAdornment,
    Link,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import api from '../../api/axios';
import { EmptyState, LoadingSpinner, PageHeader } from '../../components/ui';
import { ClinicState, PlatformClinic } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { CLINIC_STATES, CLINIC_STATE_COLORS, clinicStateKey, lastDayOf } from '../../utils/platform';

/** F13: every clinic on the platform, with its state, plan, end date and how much it is used. */
const PlatformClinicsPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const [params, setParams] = useSearchParams();
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [state, setState] = useState<ClinicState | 'all'>('all');
    const [clinics, setClinics] = useState<PlatformClinic[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    // The API client sends a platform admin here when a support view ends.
    const [supportEnded] = useState(params.get('supportEnded') === '1');

    useEffect(() => {
        if (params.get('supportEnded')) setParams({}, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => setQuery(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        let live = true;
        api.get('/platform/clinics', { params: query ? { search: query } : {} })
            .then((res) => live && (setClinics(res.data?.data ?? res.data), setError(null)))
            .catch((err) => live && setError(apiErrorMessage(err)));
        return () => {
            live = false;
        };
    }, [query]);

    const counts = useMemo(() => {
        const c: Partial<Record<ClinicState, number>> = {};
        clinics?.forEach((x) => (c[x.state] = (c[x.state] ?? 0) + 1));
        return c;
    }, [clinics]);
    const shown = clinics?.filter((c) => state === 'all' || c.state === state) ?? [];

    return (
        <Box>
            <PageHeader title={t('platform.clinics')} subtitle={t('platform.clinicsSubtitle')} />
            {supportEnded && <Alert severity="info" sx={{ mb: 2 }}>{t('support.ended')}</Alert>}

            <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField
                    size="small"
                    placeholder={t('platform.searchClinics')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ minWidth: 240, flex: '1 1 240px', maxWidth: 360 }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                />
                <ToggleButtonGroup exclusive size="small" value={state} onChange={(_, v) => v && setState(v)} sx={{ flexWrap: 'wrap' }}>
                    <ToggleButton value="all">{t('common.all')} {clinics ? `(${clinics.length})` : ''}</ToggleButton>
                    {CLINIC_STATES.map((s) => (
                        <ToggleButton key={s} value={s}>
                            {t(clinicStateKey(s))} {counts[s] ? `(${counts[s]})` : ''}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </Paper>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {!clinics ? (
                !error && <LoadingSpinner />
            ) : !shown.length ? (
                <EmptyState title={t('platform.noClinics')} />
            ) : (
                <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('platform.clinic')}</TableCell>
                                <TableCell>{t('platform.stateLabel')}</TableCell>
                                <TableCell>{t('subscription.plan')}</TableCell>
                                <TableCell>{t('platform.lastDay')}</TableCell>
                                <TableCell align="right">{t('platform.usage.staff')}</TableCell>
                                <TableCell align="right">{t('platform.usage.patients')}</TableCell>
                                <TableCell align="right">{t('platform.usage.appointments30')}</TableCell>
                                <TableCell align="right">{t('platform.usage.invoices30')}</TableCell>
                                <TableCell>{t('platform.usage.lastSignIn')}</TableCell>
                                <TableCell>{t('platform.created')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {shown.map((c) => (
                                <TableRow key={c._id} hover>
                                    <TableCell sx={{ minWidth: 180 }}>
                                        <Link component={RouterLink} to={`/platform/clinics/${c._id}`} fontWeight={600}>{c.name}</Link>
                                        <Typography variant="caption" color="text.secondary" component="div" sx={{ overflowWrap: 'anywhere' }}>{c.email}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Tooltip title={c.suspendReason ?? ''}>
                                            <Chip size="small" color={CLINIC_STATE_COLORS[c.state]} label={t(clinicStateKey(c.state))} />
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell>{c.subscription?.plan || '—'}</TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                        {c.subscription?.expiresAt ? formatDate(lastDayOf(c.subscription.expiresAt), 'dd.MM.yyyy', i18n.language) : t('platform.noEnd')}
                                    </TableCell>
                                    <TableCell align="right">{c.usage.staff}</TableCell>
                                    <TableCell align="right">{c.usage.patients}</TableCell>
                                    <TableCell align="right">{c.usage.appointments30}</TableCell>
                                    <TableCell align="right">{c.usage.invoices30}</TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{c.usage.lastSignIn ? formatDateTime(c.usage.lastSignIn, i18n.language) : '—'}</TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(c.createdAt, 'dd.MM.yyyy', i18n.language)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
};

export default PlatformClinicsPage;
