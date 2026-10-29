import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Tooltip, Typography } from '@mui/material';
import { Currency, ReportGroupBy, RevenueReport } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

const HEIGHT = 220;
const MAX_X_LABELS = 12;

/**
 * "29 Oct", "26 Oct –" (week start) or "Oct 2026", in the UI language. Uses the
 * app's date-fns locales: the browser's own Armenian month names are missing
 * in some builds.
 */
export const periodLabel = (period: string, groupBy: ReportGroupBy, language: string, long = false): string => {
    if (groupBy === 'month') return formatDate(period, long ? 'LLLL yyyy' : 'LLL yyyy', language);
    const day = formatDate(period, long ? 'd MMM yyyy' : 'd MMM', language);
    return groupBy === 'week' ? `${day} –` : day;
};

interface Props {
    data: RevenueReport['byPeriod'];
    groupBy: ReportGroupBy;
    currency: Currency;
}

/**
 * Collected money per period: one series, so no legend; the tallest bar is
 * the only one labelled, the rest show their value on hover or focus.
 */
const RevenueChart: React.FC<Props> = ({ data, groupBy, currency }) => {
    const { t, i18n } = useTranslation();
    const max = Math.max(...data.map((d) => d.total), 0);
    const peak = data.findIndex((d) => d.total === max && max > 0);
    const labelEvery = Math.ceil(data.length / MAX_X_LABELS);

    return (
        <Box role="img" aria-label={t('reports.revenueChart')}>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '2px',
                    height: HEIGHT,
                    pt: 3,
                    borderBottom: 1,
                    borderColor: 'divider',
                }}
            >
                {data.map((d, i) => {
                    const share = max > 0 ? d.total / max : 0;
                    return (
                        <Tooltip
                            key={d.period}
                            arrow
                            title={
                                <>
                                    <div>{periodLabel(d.period, groupBy, i18n.language, true)}</div>
                                    <strong>{formatCurrency(d.total, currency)}</strong>
                                    <div>{t('reports.paymentsCount', { count: d.count })}</div>
                                </>
                            }
                        >
                            <Box
                                tabIndex={0}
                                aria-label={`${periodLabel(d.period, groupBy, i18n.language, true)}: ${formatCurrency(d.total, currency)}`}
                                sx={{
                                    flex: 1,
                                    minWidth: 0,
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'flex-end',
                                    alignItems: 'center',
                                    borderRadius: 1,
                                    cursor: 'default',
                                    outline: 'none',
                                    '&:hover, &:focus-visible': { bgcolor: 'action.hover' },
                                }}
                            >
                                {i === peak && (
                                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', mb: 0.5 }}>
                                        {formatCurrency(d.total, currency)}
                                    </Typography>
                                )}
                                <Box
                                    sx={{
                                        width: '70%',
                                        maxWidth: 40,
                                        height: `${share * 100}%`,
                                        minHeight: d.total > 0 ? 2 : 0,
                                        bgcolor: 'primary.main',
                                        borderRadius: '4px 4px 0 0',
                                    }}
                                />
                            </Box>
                        </Tooltip>
                    );
                })}
            </Box>
            <Box sx={{ display: 'flex', gap: '2px', mt: 0.5 }}>
                {data.map((d, i) => (
                    <Typography
                        key={d.period}
                        variant="caption"
                        color="text.secondary"
                        sx={{ flex: 1, minWidth: 0, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'visible', fontSize: 11 }}
                    >
                        {i % labelEvery === 0 ? periodLabel(d.period, groupBy, i18n.language) : ''}
                    </Typography>
                ))}
            </Box>
        </Box>
    );
};

export default RevenueChart;
