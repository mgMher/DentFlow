import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TOOTH_STATUS_COLORS } from '../../utils/constants';
import { ToothRecord, ToothStatus } from '../../types';

const TOOTH_WIDTH = 34;
const TOOTH_HEIGHT = 44;
const TOOTH_GAP = 4;
const TOOTH_RX = 6;

interface ToothPosition {
    x: number;
    y: number;
    toothNumber: number;
}

const buildArchPositions = (
    teeth: number[],
    centerX: number,
    baseY: number,
    isUpper: boolean,
): ToothPosition[] => {
    if (teeth.length === 0) return [];

    const totalWidth = teeth.length * (TOOTH_WIDTH + TOOTH_GAP) - TOOTH_GAP;
    const startX = centerX - totalWidth / 2;
    const span = (teeth.length - 1) / 2;

    return teeth.map((toothNumber, idx) => {
        const x = startX + idx * (TOOTH_WIDTH + TOOTH_GAP);
        // Curve the row into an arch; a single-tooth row stays flat.
        const normalized = span === 0 ? 0 : (idx - span) / span;
        const archOffset = normalized * normalized * 30;
        const y = isUpper ? baseY + archOffset : baseY - archOffset;
        return { x, y, toothNumber };
    });
};

/**
 * Splits whatever teeth the chart actually holds into an upper and a lower
 * arch. Driven by the data rather than hardcoded ranges, so it renders an adult
 * chart (32 teeth, 1-32) and a pediatric one (20 teeth, 51-70) alike.
 */
const splitArches = (teeth: ToothRecord[]) => {
    const numbers = teeth.map((tooth) => tooth.toothNumber).sort((a, b) => a - b);
    const half = Math.ceil(numbers.length / 2);
    return { upper: numbers.slice(0, half), lower: numbers.slice(half) };
};

interface OdontogramProps {
    teeth: ToothRecord[];
    selectedTooth: number | null;
    onToothClick: (toothNumber: number) => void;
}

const Odontogram: React.FC<OdontogramProps> = ({ teeth, selectedTooth, onToothClick }) => {
    const { t } = useTranslation();

    const { upper, lower } = useMemo(() => splitArches(teeth), [teeth]);

    const perArch = Math.max(upper.length, lower.length, 1);
    const svgWidth = Math.max(360, perArch * (TOOTH_WIDTH + TOOTH_GAP) + 80);
    const svgHeight = 340;
    const centerX = svgWidth / 2;

    const upperPositions = buildArchPositions(upper, centerX, 50, true);
    const lowerPositions = buildArchPositions(lower, centerX, 220, false);

    const toothStatusMap = useMemo(() => {
        const map: Record<number, ToothStatus> = {};
        teeth.forEach((tooth) => {
            map[tooth.toothNumber] = tooth.status;
        });
        return map;
    }, [teeth]);

    const renderTooth = (pos: ToothPosition) => {
        const status = toothStatusMap[pos.toothNumber] || 'healthy';
        const fillColor = TOOTH_STATUS_COLORS[status] || TOOTH_STATUS_COLORS.healthy;
        const isSelected = selectedTooth === pos.toothNumber;

        return (
            <g
                key={pos.toothNumber}
                onClick={() => onToothClick(pos.toothNumber)}
                style={{ cursor: 'pointer' }}
            >
                <rect
                    x={pos.x}
                    y={pos.y}
                    width={TOOTH_WIDTH}
                    height={TOOTH_HEIGHT}
                    rx={TOOTH_RX}
                    ry={TOOTH_RX}
                    fill={fillColor}
                    stroke={isSelected ? '#1A202C' : '#E2E8F0'}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    opacity={status === 'missing' ? 0.4 : 1}
                />
                <rect
                    x={pos.x}
                    y={pos.y}
                    width={TOOTH_WIDTH}
                    height={TOOTH_HEIGHT}
                    rx={TOOTH_RX}
                    ry={TOOTH_RX}
                    fill="transparent"
                    stroke="transparent"
                    strokeWidth={0}
                >
                    <animate
                        attributeName="fill"
                        from="transparent"
                        to="rgba(0,0,0,0.08)"
                        dur="0.15s"
                        begin="mouseover"
                        fill="freeze"
                    />
                    <animate
                        attributeName="fill"
                        from="rgba(0,0,0,0.08)"
                        to="transparent"
                        dur="0.15s"
                        begin="mouseout"
                        fill="freeze"
                    />
                </rect>
                <text
                    x={pos.x + TOOTH_WIDTH / 2}
                    y={pos.y + TOOTH_HEIGHT / 2 + 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={12}
                    fontWeight={600}
                    fill="#fff"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                    {pos.toothNumber}
                </text>
            </g>
        );
    };

    return (
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" style={{ maxWidth: svgWidth }}>
            <text
                x={centerX}
                y={20}
                textAnchor="middle"
                fontSize={14}
                fontWeight={600}
                fill="#4A5568"
            >
                {t('dental.upperJaw')}
            </text>
            <line
                x1={centerX}
                y1={35}
                x2={centerX}
                y2={155}
                stroke="#CBD5E0"
                strokeWidth={1}
                strokeDasharray="4 4"
            />
            {upperPositions.map(renderTooth)}
            <line
                x1={40}
                y1={svgHeight / 2}
                x2={svgWidth - 40}
                y2={svgHeight / 2}
                stroke="#CBD5E0"
                strokeWidth={1}
            />
            <text
                x={centerX}
                y={svgHeight - 10}
                textAnchor="middle"
                fontSize={14}
                fontWeight={600}
                fill="#4A5568"
            >
                {t('dental.lowerJaw')}
            </text>
            <line
                x1={centerX}
                y1={185}
                x2={centerX}
                y2={305}
                stroke="#CBD5E0"
                strokeWidth={1}
                strokeDasharray="4 4"
            />
            {lowerPositions.map(renderTooth)}
        </svg>
    );
};

export default Odontogram;
