import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Chip, Link, Paper, Typography } from '@mui/material';
import api from '../../api/axios';
import { EmptyState, LoadingSpinner } from '../ui';
import { AuditEntry, AuditPage } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import { detailItems, eventLabel, fieldLabel, formatValue, isFailure, roleLabel } from '../../utils/audit';
import { formatDate, getFullName } from '../../utils/formatters';

interface AuditEntryListProps {
    /** `/audit` or `/patients/:id/history`. */
    url: string;
    params?: Record<string, string | undefined>;
    /** Link each entry to its patient (the clinic-wide log). */
    showPatient?: boolean;
}

const Entry: React.FC<{ entry: AuditEntry; showPatient?: boolean }> = ({ entry, showPatient }) => {
    const { t, i18n } = useTranslation();
    const details = detailItems(t, entry);
    const failed = isFailure(entry);
    const patient = entry.patientId;

    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '64px minmax(0, 1fr)' }, gap: { xs: 0.5, sm: 2 }, py: 1.5, px: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatDate(entry.at, 'HH:mm', i18n.language)}
            </Typography>
            <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 1 }}>
                    <Typography variant="body2" fontWeight={600} color={failed ? 'error.main' : 'text.primary'}>
                        {eventLabel(t, entry.event)}
                    </Typography>
                    {showPatient && patient && (
                        <Link component={RouterLink} to={`/patients/${patient._id}`} variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                            {getFullName(patient.firstName, patient.lastName, patient.patronymic)}
                        </Link>
                    )}
                </Box>
                <Typography variant="caption" color="text.secondary" component="div">
                    {entry.actor.kind === 'patient'
                        ? t('audit.byPatient', { name: entry.actor.name ?? '' })
                        : entry.actor.name || t('audit.someone')}
                    {entry.actor.role && ` · ${roleLabel(t, entry.actor.role)}`}
                    {entry.ip && (
                        <Box component="span" title={entry.userAgent}>
                            {` · ${entry.ip}`}
                        </Box>
                    )}
                </Typography>
                {details.length > 0 && (
                    <Typography variant="body2" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
                        {details.join(' · ')}
                    </Typography>
                )}
                {!!entry.changes?.length && (
                    <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                        {entry.changes.map((c) => (
                            <Typography component="li" variant="body2" key={c.field} sx={{ overflowWrap: 'anywhere' }}>
                                <Box component="span" color="text.secondary">{fieldLabel(t, c.field)}: </Box>
                                {c.masked ? (
                                    <Box component="span" fontStyle="italic">{t('audit.changedHidden')}</Box>
                                ) : (
                                    <>
                                        <Box component="span" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                                            {formatValue(t, entry, c.field, c.from)}
                                        </Box>
                                        {' → '}
                                        <Box component="span" fontWeight={600}>{formatValue(t, entry, c.field, c.to)}</Box>
                                    </>
                                )}
                            </Typography>
                        ))}
                    </Box>
                )}
            </Box>
        </Box>
    );
};

/** Audit entries newest first, grouped by day, with "Load more". */
const AuditEntryList: React.FC<AuditEntryListProps> = ({ url, params, showPatient }) => {
    const { t, i18n } = useTranslation();
    const [items, setItems] = useState<AuditEntry[] | null>(null);
    const [next, setNext] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const key = JSON.stringify(params ?? {});

    const fetchPage = useCallback(
        (before?: string) => {
            const query = Object.fromEntries(Object.entries(JSON.parse(key)).filter(([, v]) => v));
            return api.get(url, { params: { ...query, limit: 50, ...(before ? { before } : {}) } }).then((res) => (res.data?.data ?? res.data) as AuditPage);
        },
        [url, key],
    );

    useEffect(() => {
        let live = true;
        setItems(null);
        setError(null);
        fetchPage()
            .then((page) => {
                if (!live) return;
                setItems(page.items);
                setNext(page.next);
            })
            .catch((err) => live && setError(apiErrorMessage(err, 'audit.loadError')));
        return () => {
            live = false;
        };
    }, [fetchPage]);

    const loadMore = () => {
        if (!next) return;
        setLoadingMore(true);
        fetchPage(next)
            .then((page) => {
                setItems((prev) => [...(prev ?? []), ...page.items]);
                setNext(page.next);
            })
            .catch((err) => setError(apiErrorMessage(err, 'audit.loadError')))
            .finally(() => setLoadingMore(false));
    };

    if (error && !items) return <Alert severity="error">{error}</Alert>;
    if (!items) return <LoadingSpinner />;
    if (!items.length) return <EmptyState title={t('audit.none')} />;

    // Day headers between entries of different days.
    // Only the first letter: month names stay lower case in Armenian and Russian.
    const day = (e: AuditEntry) => {
        const text = formatDate(e.at, 'EEEE, d MMMM yyyy', i18n.language);
        return text.charAt(0).toUpperCase() + text.slice(1);
    };
    return (
        <Box>
            <Paper variant="outlined">
                {items.map((entry, i) => (
                    <React.Fragment key={entry._id}>
                        {(i === 0 || day(entry) !== day(items[i - 1])) && (
                            <Box sx={{ px: 2, py: 0.75, bgcolor: 'action.hover', borderTop: i ? '1px solid' : 0, borderColor: 'divider' }}>
                                <Typography variant="caption" fontWeight={600}>{day(entry)}</Typography>
                            </Box>
                        )}
                        <Box sx={{ borderTop: i && day(entry) === day(items[i - 1]) ? '1px solid' : 0, borderColor: 'divider' }}>
                            <Entry entry={entry} showPatient={showPatient} />
                        </Box>
                    </React.Fragment>
                ))}
            </Paper>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {next && (
                <Box sx={{ textAlign: 'center', mt: 2 }}>
                    <Button onClick={loadMore} disabled={loadingMore}>{t('audit.loadMore')}</Button>
                </Box>
            )}
            {!next && items.length > 10 && (
                <Box sx={{ textAlign: 'center', mt: 2 }}>
                    <Chip size="small" label={t('audit.end')} />
                </Box>
            )}
        </Box>
    );
};

export default AuditEntryList;
