import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Card, CardContent, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { RootState } from '../../store';
import { dentalRecordsActions } from '../../store/dental-records';
import { ConfirmDialog, EmptyState, LoadingSpinner } from '../../components/ui';
import Odontogram from '../../components/dental/Odontogram';
import ToothDrawer from '../../components/dental/ToothDrawer';
import { useHttpState, usePermission } from '../../hooks';
import { ChartType, Patient } from '../../types';
import PerioPanel from '../../components/perio/PerioPanel';
import {
    SURFACE_STATUSES,
    SURFACE_STATUS_COLORS,
    TOOTH_STATUSES,
    TOOTH_STATUS_COLORS,
    chartTypeKey,
    predecessorOf,
    surfaceStatusKey,
    toothStatusKey,
    toothStatusShortKey,
} from '../../utils/dental';

const LegendItem: React.FC<{ swatch: React.ReactNode; label: string }> = ({ swatch, label }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        {swatch}
        <Typography variant="caption" color="text.secondary">
            {label}
        </Typography>
    </Box>
);

/**
 * The patient's dental chart (FDI). Clinicians edit; everyone else views.
 * `suggestedChartType` only applies when the chart is created on first open.
 */
const PatientChartTab: React.FC<{ patient: Patient; suggestedChartType: ChartType }> = ({ patient, suggestedChartType }) => {
    const [params, setParams] = useSearchParams();
    // F12: the chart, or the periodontal exams (`?view=perio`, so a reload stays there).
    const view = params.get('view') === 'perio' ? 'perio' : 'chart';
    const setView = (next: 'chart' | 'perio') => {
        const p = new URLSearchParams(params);
        if (next === 'perio') p.set('view', 'perio');
        else p.delete('view');
        setParams(p, { replace: true });
    };
    const { t } = useTranslation();
    const toggle = (
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_e, v) => v && setView(v)} sx={{ mb: 2, displayPrint: 'none' }}>
            <ToggleButton value="chart">{t('dental.odontogram')}</ToggleButton>
            <ToggleButton value="perio">{t('perio.title')}</ToggleButton>
        </ToggleButtonGroup>
    );
    return view === 'perio' ? (
        <>
            {toggle}
            <Card>
                <CardContent>
                    <PerioPanel patient={patient} />
                </CardContent>
            </Card>
        </>
    ) : (
        <>
            {toggle}
            <DentalChartView patientId={patient._id} suggestedChartType={suggestedChartType} />
        </>
    );
};

const DentalChartView: React.FC<{ patientId: string; suggestedChartType: ChartType }> = ({ patientId, suggestedChartType }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const can = usePermission();
    const canEdit = can('editDentalChart');
    const stored = useSelector((state: RootState) => state.dentalRecords.chart);
    const failure = useSelector((state: RootState) => state.http.errors.find((e) => e.type === 'GET_CHART'));
    const loading = useSelector((state: RootState) => state.http.loading.includes('GET_CHART'));

    const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
    const [pendingType, setPendingType] = useState<ChartType | null>(null);
    // Mixed chart: the tooth to open once an eruption is saved.
    const [afterErupt, setAfterErupt] = useState<number | null>(null);
    const erupt = useHttpState('ERUPT_TOOTH');

    // The store holds whichever patient was opened last; never draw their teeth here.
    const chart = stored && stored.patientId === patientId ? stored : null;
    const onChart = useMemo(() => new Set((chart?.teeth ?? []).map((tooth) => tooth.toothNumber)), [chart?.teeth]);

    const { success: erupted, clearSuccess: clearErupted } = erupt;
    useEffect(() => {
        if (!erupted) return;
        clearErupted();
        if (afterErupt !== null) {
            setSelectedTooth(afterErupt);
            dispatch(dentalRecordsActions.getToothHistory({ patientId, toothNumber: afterErupt }));
            setAfterErupt(null);
        }
    }, [erupted, clearErupted, afterErupt, dispatch, patientId]);

    const handleErupt = (permanent: number, undo: boolean) => {
        // After an undo the primary tooth is back in its place; a molar just leaves.
        setAfterErupt(undo ? predecessorOf(permanent) : permanent);
        if (undo && !predecessorOf(permanent)) setSelectedTooth(null);
        dispatch(dentalRecordsActions.eruptTooth({ patientId, toothNumber: permanent, undo }));
    };

    useEffect(() => {
        dispatch(dentalRecordsActions.getChart({ patientId, chartType: suggestedChartType }));
        setSelectedTooth(null);
    }, [dispatch, patientId, suggestedChartType]);

    const closeDrawer = () => {
        setSelectedTooth(null);
        dispatch(dentalRecordsActions.clearToothHistory());
    };

    const openTooth = (toothNumber: number) => {
        setSelectedTooth(toothNumber);
        dispatch(dentalRecordsActions.getToothHistory({ patientId, toothNumber }));
    };

    const confirmTypeChange = () => {
        if (!pendingType) return;
        dispatch(dentalRecordsActions.setChartType({ patientId, chartType: pendingType }));
        setPendingType(null);
        setSelectedTooth(null);
    };

    if (!chart) {
        if (failure && !loading) {
            return (
                <EmptyState
                    title={failure.error}
                    actionLabel={t('common.retry')}
                    onAction={() => dispatch(dentalRecordsActions.getChart({ patientId, chartType: suggestedChartType }))}
                />
            );
        }
        return <LoadingSpinner />;
    }

    const restoring = pendingType ? chart.archivedChartTypes?.includes(pendingType) : false;
    const typeLabel = (type: ChartType) => t(chartTypeKey(type));

    return (
        <>
            <Card sx={{ mb: 3 }}>
                <CardContent sx={{ py: 3 }}>
                    <Box
                        sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 2,
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            mb: 2,
                        }}
                    >
                        <Box>
                            <Typography variant="h6" fontWeight={600}>
                                {t('dental.odontogram')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {canEdit ? t('dental.selectTooth') : t('dental.viewOnly')}
                            </Typography>
                        </Box>
                        <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={chart.chartType}
                            disabled={!canEdit}
                            onChange={(_e, value) => value && value !== chart.chartType && setPendingType(value)}
                        >
                            <ToggleButton value="adult">{t('dental.adultChart')}</ToggleButton>
                            <ToggleButton value="mixed">{t('dental.mixedChart')}</ToggleButton>
                            <ToggleButton value="pediatric">{t('dental.pediatricChart')}</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>

                    <Odontogram
                        chartType={chart.chartType}
                        teeth={chart.teeth}
                        selectedTooth={selectedTooth}
                        onToothClick={openTooth}
                    />

                    <Box sx={{ mt: 3, display: 'grid', gap: 1.5 }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary">
                                {t('dental.wholeTooth')}:
                            </Typography>
                            {TOOTH_STATUSES.filter((s) => s !== 'healthy').map((s) => (
                                <LegendItem
                                    key={s}
                                    label={`${t(toothStatusShortKey(s))} — ${t(toothStatusKey(s))}`}
                                    swatch={
                                        <Box
                                            sx={{
                                                width: 14,
                                                height: 14,
                                                borderRadius: '3px',
                                                border: `2.5px solid ${TOOTH_STATUS_COLORS[s]}`,
                                            }}
                                        />
                                    }
                                />
                            ))}
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary">
                                {t('dental.surfaces')}:
                            </Typography>
                            {SURFACE_STATUSES.map((s) => (
                                <LegendItem
                                    key={s}
                                    label={t(surfaceStatusKey(s))}
                                    swatch={<Box sx={{ width: 14, height: 14, borderRadius: '2px', bgcolor: SURFACE_STATUS_COLORS[s] }} />}
                                />
                            ))}
                        </Box>
                        {chart.chartType === 'mixed' && (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                                <Typography variant="caption" fontWeight={700} color="text.secondary">
                                    {t('dental.mixedChart')}:
                                </Typography>
                                <LegendItem
                                    label={t('dental.legendPrimary')}
                                    swatch={<Typography variant="caption" fontWeight={700} color="secondary.main">55</Typography>}
                                />
                                <LegendItem
                                    label={t('dental.notErupted')}
                                    swatch={<Box sx={{ width: 14, height: 14, borderRadius: '3px', border: '1.5px dashed', borderColor: 'text.disabled' }} />}
                                />
                            </Box>
                        )}
                    </Box>
                </CardContent>
            </Card>

            <ToothDrawer
                patientId={patientId}
                toothNumber={selectedTooth}
                tooth={chart.teeth.find((tooth) => tooth.toothNumber === selectedTooth)}
                canEdit={canEdit}
                onClose={closeDrawer}
                mixed={chart.chartType === 'mixed' ? { onChart, busy: erupt.loading, error: erupt.error, onErupt: handleErupt } : undefined}
            />

            <ConfirmDialog
                open={!!pendingType}
                title={t('dental.changeChartType')}
                message={
                    pendingType
                        ? t(restoring ? 'dental.confirmChartTypeRestore' : 'dental.confirmChartTypeChange', {
                              type: typeLabel(pendingType),
                          })
                        : ''
                }
                onConfirm={confirmTypeChange}
                onCancel={() => setPendingType(null)}
            />
        </>
    );
};

export default PatientChartTab;
