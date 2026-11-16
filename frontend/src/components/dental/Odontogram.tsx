import React, { useMemo, useState } from 'react';
import { Box, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ChartType, ToothRecord } from '../../types';
import { CHART_ROWS, isPrimaryTooth, mixedSlot, surfaceKey, surfaceStatusKey, toothStatusKey, toothStatusShortKey } from '../../utils/dental';
import ToothGlyph from './ToothGlyph';

const GLYPH = 30;
const CELL = 40;
const MIDLINE_GAP = 16;
const PAD_X = 12;
const NUMBER_SPACE = 30;

interface OdontogramProps {
    chartType: ChartType;
    teeth: ToothRecord[];
    selectedTooth: number | null;
    onToothClick: (toothNumber: number) => void;
}

/**
 * FDI chart as the dentist faces the patient: upper arch on top, the
 * patient's right on the viewer's left in both arches. Every tooth is a
 * keyboard-reachable button whose label reads out its status and surfaces.
 */
const Odontogram: React.FC<OdontogramProps> = ({ chartType, teeth, selectedTooth, onToothClick }) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const [focused, setFocused] = useState<number | null>(null);

    const byNumber = useMemo(() => new Map(teeth.map((tooth) => [tooth.toothNumber, tooth])), [teeth]);
    const rows = CHART_ROWS[chartType];
    const perRow = rows.upper.length;
    const half = perRow / 2;

    const width = PAD_X * 2 + perRow * CELL + MIDLINE_GAP;
    const upperY = NUMBER_SPACE + 10;
    const lowerY = upperY + GLYPH + 56;
    const height = lowerY + GLYPH + NUMBER_SPACE + 4;
    const xOf = (index: number) => PAD_X + index * CELL + (index >= half ? MIDLINE_GAP : 0) + (CELL - GLYPH) / 2;

    const mixed = chartType === 'mixed';
    const onChart = useMemo(() => new Set(teeth.map((tooth) => tooth.toothNumber)), [teeth]);

    const describe = (tooth: ToothRecord) => {
        const parts = [`${t('dental.tooth')} ${tooth.toothNumber}`, t(toothStatusKey(tooth.status))];
        if (mixed && isPrimaryTooth(tooth.toothNumber)) parts.splice(1, 0, t('dental.primaryTooth'));
        tooth.surfaces?.forEach((s) => parts.push(`${t(surfaceKey(s.surface))}: ${t(surfaceStatusKey(s.status))}`));
        return parts.join(', ');
    };

    const renderTooth = (position: number, index: number, upper: boolean) => {
        // A mixed chart's position shows the permanent tooth, the primary one, or an empty place.
        const toothNumber = mixed ? mixedSlot(position, onChart) ?? position : position;
        const tooth = byNumber.get(toothNumber);
        if (!tooth && !mixed) return null;
        const x = xOf(index);
        const y = upper ? upperY : lowerY;
        const selected = selectedTooth === toothNumber;
        const label = tooth ? describe(tooth) : `${t('dental.tooth')} ${toothNumber}, ${t('dental.notErupted')}`;
        const short = !tooth || tooth.status === 'healthy' ? '' : t(toothStatusShortKey(tooth.status));
        const primary = mixed && isPrimaryTooth(toothNumber);
        // Number on the outside of the arch, status mark towards the middle.
        const numberY = upper ? y - 14 : y + GLYPH + 22;
        const shortY = upper ? y + GLYPH + 18 : y - 10;

        return (
            <g
                key={toothNumber}
                className="tooth"
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-pressed={selected}
                style={{ cursor: 'pointer', outline: 'none' }}
                onClick={() => onToothClick(toothNumber)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onToothClick(toothNumber);
                    }
                }}
                onFocus={() => setFocused(toothNumber)}
                onBlur={() => setFocused((f) => (f === toothNumber ? null : f))}
            >
                <title>{label}</title>
                {/* Large hit area and the selection / keyboard-focus ring. */}
                <rect
                    className="tooth-hit"
                    x={x - 5}
                    y={upper ? numberY - 14 : y - 20}
                    width={GLYPH + 10}
                    height={GLYPH + 46}
                    rx={6}
                    fill={selected ? theme.palette.action.selected : 'transparent'}
                    stroke={selected || focused === toothNumber ? theme.palette.primary.main : 'none'}
                    strokeWidth={2}
                />
                {tooth ? (
                    <g transform={primary ? `translate(${x + GLYPH * 0.1}, ${y + GLYPH * 0.1}) scale(0.8)` : `translate(${x}, ${y})`}>
                        <ToothGlyph toothNumber={toothNumber} status={tooth.status} surfaces={tooth.surfaces ?? []} size={GLYPH} />
                    </g>
                ) : (
                    // Not erupted yet: an empty place the permanent tooth will take.
                    <rect
                        x={x + 3}
                        y={y + 3}
                        width={GLYPH - 6}
                        height={GLYPH - 6}
                        rx={4}
                        fill="none"
                        stroke={theme.palette.text.disabled}
                        strokeDasharray="3 3"
                    />
                )}
                <text
                    x={x + GLYPH / 2}
                    y={numberY}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={selected ? 700 : 600}
                    fill={!tooth ? theme.palette.text.disabled : primary ? theme.palette.secondary.main : theme.palette.text.primary}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                    {toothNumber}
                </text>
                {short && (
                    <text
                        x={x + GLYPH / 2}
                        y={shortY}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={700}
                        fill={theme.palette.text.secondary}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                        {short}
                    </text>
                )}
            </g>
        );
    };

    const midX = PAD_X + half * CELL + MIDLINE_GAP / 2;
    const divider = theme.palette.divider;
    const caption = { fontSize: 11, fill: theme.palette.text.secondary, style: { userSelect: 'none' as const } };

    return (
        <Box
            component="svg"
            viewBox={`0 0 ${width} ${height}`}
            role="group"
            aria-label={t('dental.odontogram')}
            sx={{
                width: '100%',
                maxWidth: width * 1.4,
                display: 'block',
                mx: 'auto',
                '& .tooth:hover .tooth-hit': { fill: theme.palette.action.hover },
            }}
        >
            <line x1={midX} y1={4} x2={midX} y2={height - 4} stroke={divider} strokeDasharray="4 4" />
            <line x1={PAD_X} y1={(upperY + GLYPH + lowerY) / 2} x2={width - PAD_X} y2={(upperY + GLYPH + lowerY) / 2} stroke={divider} />
            <text x={PAD_X} y={12} {...caption}>{t('dental.patientRight')}</text>
            <text x={width - PAD_X} y={12} textAnchor="end" {...caption}>{t('dental.patientLeft')}</text>
            {rows.upper.map((n, i) => renderTooth(n, i, true))}
            {rows.lower.map((n, i) => renderTooth(n, i, false))}
        </Box>
    );
};

export default Odontogram;
