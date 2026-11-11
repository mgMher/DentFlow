import React from 'react';
import { useTheme, alpha } from '@mui/material';
import { SurfaceState, SurfaceStatus, ToothStatus, ToothSurface } from '../../types';
import {
    SURFACE_STATUS_COLORS,
    TOOTH_STATUS_COLORS,
    isUpperTooth,
    surfaceLayout,
} from '../../utils/dental';

interface ToothGlyphProps {
    toothNumber: number;
    status: ToothStatus;
    surfaces: SurfaceState[];
    size: number;
    /** Makes each surface a button (the surface editor). */
    onSurfaceClick?: (surface: ToothSurface) => void;
    surfaceLabel?: (surface: ToothSurface, status?: SurfaceStatus) => string;
}

/**
 * The five-part tooth diagram used on paper charts: centre = occlusal /
 * incisal, the four sides = buccal, lingual/palatal, mesial, distal. The
 * cervical (gum-line) surface is a bar on the root side. Each surface is
 * coloured by its own finding; the outline and tint show the whole tooth.
 *
 * Drawn at (0, 0); the parent positions it with a transform.
 */
const ToothGlyph: React.FC<ToothGlyphProps> = ({
    toothNumber,
    status,
    surfaces,
    size: s,
    onSurfaceClick,
    surfaceLabel,
}) => {
    const theme = useTheme();
    const layout = surfaceLayout(toothNumber);
    const stateOf = (surface: ToothSurface) => surfaces.find((x) => x.surface === surface)?.status;
    const missing = status === 'missing';
    const statusColor = TOOTH_STATUS_COLORS[status];
    const sound = theme.palette.background.paper;
    const line = theme.palette.mode === 'dark' ? theme.palette.grey[500] : theme.palette.grey[400];

    const a = s * 0.3;
    const b = s * 0.7;
    const regions: { surface: ToothSurface; points: string }[] = [
        { surface: layout.top, points: `0,0 ${s},0 ${b},${a} ${a},${a}` },
        { surface: layout.right, points: `${s},0 ${s},${s} ${b},${b} ${b},${a}` },
        { surface: layout.bottom, points: `${s},${s} 0,${s} ${a},${b} ${b},${b}` },
        { surface: layout.left, points: `0,${s} 0,0 ${a},${a} ${a},${b}` },
        { surface: layout.center, points: `${a},${a} ${b},${a} ${b},${b} ${a},${b}` },
    ];

    // The root (and gum line) is above an upper tooth and below a lower one.
    const barHeight = Math.max(3, s * 0.12);
    const barY = isUpperTooth(toothNumber) ? -barHeight - 2 : s + 2;
    const cervical = stateOf('cervical');

    const interactive = (surface: ToothSurface) =>
        onSurfaceClick
            ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': surfaceLabel?.(surface, stateOf(surface)),
                  style: { cursor: 'pointer', outline: 'none' },
                  onClick: () => onSurfaceClick(surface),
                  onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSurfaceClick(surface);
                      }
                  },
              }
            : {};

    return (
        <g opacity={missing ? 0.45 : 1}>
            {/* Whole-tooth tint behind the surfaces. */}
            {status !== 'healthy' && (
                <rect x={-2} y={-2} width={s + 4} height={s + 4} rx={4} fill={alpha(statusColor, 0.25)} />
            )}
            {regions.map(({ surface, points }) => {
                const state = stateOf(surface);
                return (
                    <polygon
                        key={surface}
                        className="tooth-surface"
                        points={points}
                        fill={state ? SURFACE_STATUS_COLORS[state] : sound}
                        stroke={line}
                        strokeWidth={1}
                        strokeLinejoin="round"
                        {...interactive(surface)}
                    >
                        {surfaceLabel && <title>{surfaceLabel(surface, state)}</title>}
                    </polygon>
                );
            })}
            {(cervical || onSurfaceClick) && (
                <rect
                    className="tooth-surface"
                    x={s * 0.15}
                    y={barY}
                    width={s * 0.7}
                    height={barHeight}
                    rx={barHeight / 2}
                    fill={cervical ? SURFACE_STATUS_COLORS[cervical] : sound}
                    stroke={line}
                    strokeWidth={onSurfaceClick ? 1 : 0}
                    {...interactive('cervical')}
                >
                    {surfaceLabel && <title>{surfaceLabel('cervical', cervical)}</title>}
                </rect>
            )}
            {status !== 'healthy' && (
                <rect
                    x={-2}
                    y={-2}
                    width={s + 4}
                    height={s + 4}
                    rx={4}
                    fill="none"
                    stroke={statusColor}
                    strokeWidth={2.5}
                    pointerEvents="none"
                />
            )}
            {missing && (
                <path
                    d={`M0,0 L${s},${s} M${s},0 L0,${s}`}
                    stroke={theme.palette.text.primary}
                    strokeWidth={2}
                    pointerEvents="none"
                />
            )}
        </g>
    );
};

export default ToothGlyph;
