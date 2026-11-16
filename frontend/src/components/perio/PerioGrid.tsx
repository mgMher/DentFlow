import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { alpha, Box, Checkbox, ListItemText, Menu, MenuItem, useTheme } from '@mui/material';
import { PerioSite, PerioTooth } from '../../types';
import { PD_MAX, REC_MAX, REC_MIN, archTeeth, cal, hasFurcation, parseDepth, pdLevel, siteOrder } from '../../utils/perio';

type Side = 'buccal' | 'lingual';
type NumberField = 'pd' | 'rec' | 'mobility' | 'furcation';
type Field = NumberField | 'bop' | 'plaque';

/** One place the cursor can be: a tooth's value, or one site's. */
interface Cell {
    key: string;
    tooth: number;
    field: Field;
    site?: number;
}

interface Row {
    id: string;
    field: Field | 'cal';
    side?: Side;
    label: string;
    cells: Cell[];
}

const RANGE: Record<NumberField, [number, number]> = {
    pd: [0, PD_MAX],
    rec: [REC_MIN, REC_MAX],
    mobility: [0, 3],
    furcation: [0, 3],
};

const cellKey = (tooth: number, field: Field, site?: number) => `${tooth}:${field}:${site ?? ''}`;

interface PerioGridProps {
    teeth: PerioTooth[];
    /** The previous exam's teeth, to show beside each depth. */
    previous?: Map<number, PerioTooth> | null;
    editable: boolean;
    /** A change to one tooth, applied to the latest state (keys can come faster than renders). */
    onChange: (toothNumber: number, update: (tooth: PerioTooth) => PerioTooth) => void;
}

/**
 * The six-site chart. Typing a depth moves on to the next site ("1" waits for
 * 10–15), arrows move around, Backspace clears, Space marks bleeding / pus or
 * plaque. Depths of 4 mm and more are amber, 6 mm and more red.
 */
const PerioGrid: React.FC<PerioGridProps> = ({ teeth, previous, editable, onChange }) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const root = useRef<HTMLDivElement>(null);
    // What is typed so far in one cell ("1" may become 10–15); a ref too, as keys can come faster than renders.
    const [draft, setDraftState] = useState<{ key: string; text: string } | null>(null);
    const draftRef = useRef<{ key: string; text: string } | null>(null);
    const setDraft = (next: { key: string; text: string } | null | ((d: { key: string; text: string } | null) => { key: string; text: string } | null)) => {
        draftRef.current = typeof next === 'function' ? next(draftRef.current) : next;
        setDraftState(draftRef.current);
    };
    const [menu, setMenu] = useState<{ anchor: HTMLElement; tooth: number } | null>(null);

    const byNumber = useMemo(() => new Map(teeth.map((tooth) => [tooth.toothNumber, tooth])), [teeth]);
    const arches = useMemo(
        () => ({ upper: archTeeth(teeth, 'upper'), lower: archTeeth(teeth, 'lower') }),
        [teeth],
    );

    /** Every row in screen order; upper: cheek side then palate, lower: tongue side then cheek. */
    const layout = useMemo(() => {
        const build = (arch: 'upper' | 'lower') => {
            const list = arches[arch];
            const present = list.filter((tooth) => !tooth.missing);
            const toothRow = (field: 'mobility' | 'furcation', label: string): Row => ({
                id: `${arch}-${field}`,
                field,
                label,
                cells: present
                    .filter((tooth) => field !== 'furcation' || hasFurcation(tooth.toothNumber))
                    .map((tooth) => ({ key: cellKey(tooth.toothNumber, field), tooth: tooth.toothNumber, field })),
            });
            const sideRows = (side: Side): Row[] => {
                const sideLabel = side === 'buccal' ? t('perio.buccal') : arch === 'upper' ? t('perio.palatal') : t('perio.lingual');
                const siteRow = (field: Field | 'cal', label: string): Row => ({
                    id: `${arch}-${side}-${field}`,
                    field,
                    side,
                    label: `${label}`,
                    cells:
                        field === 'cal'
                            ? []
                            : present.flatMap((tooth) =>
                                  siteOrder(tooth.toothNumber, side).map((site) => ({
                                      key: cellKey(tooth.toothNumber, field, site),
                                      tooth: tooth.toothNumber,
                                      field,
                                      site,
                                  })),
                              ),
                });
                return [
                    { ...siteRow('pd', t('perio.pd')), sideLabel },
                    siteRow('rec', t('perio.rec')),
                    siteRow('cal', t('perio.cal')),
                    siteRow('bop', t('perio.bop')),
                    siteRow('plaque', t('perio.plaque')),
                ] as (Row & { sideLabel?: string })[];
            };
            const sides: Side[] = arch === 'upper' ? ['buccal', 'lingual'] : ['lingual', 'buccal'];
            return {
                arch,
                teeth: list,
                rows: [toothRow('mobility', t('perio.mobility')), toothRow('furcation', t('perio.furcation')), ...sides.flatMap(sideRows)] as (Row & {
                    sideLabel?: string;
                })[],
            };
        };
        return [build('upper'), build('lower')];
    }, [arches, t]);

    const allRows = useMemo(() => layout.flatMap((a) => a.rows).filter((r) => r.cells.length), [layout]);

    // Every cell is always drawn, so the cursor can move at once (before the next key arrives).
    const focus = (key: string) => root.current?.querySelector<HTMLElement>(`[data-cell="${key}"]`)?.focus();

    const locate = (key: string) => {
        for (let r = 0; r < allRows.length; r++) {
            const c = allRows[r].cells.findIndex((cell) => cell.key === key);
            if (c >= 0) return { r, c };
        }
        return null;
    };

    /** The next place to type: along the row, then the next row of the same kind (PD → PD). */
    const nextOf = (key: string): string | null => {
        const at = locate(key);
        if (!at) return null;
        const row = allRows[at.r];
        if (at.c + 1 < row.cells.length) return row.cells[at.c + 1].key;
        const following = allRows.slice(at.r + 1).find((r) => r.field === row.field);
        return following?.cells[0]?.key ?? null;
    };

    const move = (key: string, dir: 'left' | 'right' | 'up' | 'down') => {
        const at = locate(key);
        if (!at) return;
        const row = allRows[at.r];
        if (dir === 'left' || dir === 'right') {
            const target = row.cells[at.c + (dir === 'right' ? 1 : -1)];
            if (target) focus(target.key);
            return;
        }
        const target = allRows[at.r + (dir === 'down' ? 1 : -1)];
        if (!target) return;
        const here = row.cells[at.c];
        // The same tooth (and the same site when there is one), else the nearest tooth.
        const sameSite = target.cells.find((c) => c.tooth === here.tooth && (c.site === here.site || here.site === undefined || c.site === undefined));
        const order = (n: number) => layout.flatMap((a) => a.teeth).findIndex((tooth) => tooth.toothNumber === n);
        const nearest =
            sameSite ??
            [...target.cells].sort((a, b) => Math.abs(order(a.tooth) - order(here.tooth)) - Math.abs(order(b.tooth) - order(here.tooth)))[0];
        if (nearest) focus(nearest.key);
    };

    const setSite = (toothNumber: number, site: number, patch: (s: PerioSite) => Partial<PerioSite>) =>
        onChange(toothNumber, (tooth) => ({ ...tooth, sites: tooth.sites.map((s, i) => (i === site ? { ...s, ...patch(s) } : s)) }));

    const valueOf = (cell: Cell): number | null => {
        const tooth = byNumber.get(cell.tooth)!;
        if (cell.field === 'mobility' || cell.field === 'furcation') return tooth[cell.field];
        return (tooth.sites[cell.site!] as any)[cell.field] ?? null;
    };

    const setValue = (cell: Cell, value: number | null) => {
        if (cell.field === 'mobility' || cell.field === 'furcation') onChange(cell.tooth, (tooth) => ({ ...tooth, [cell.field]: value }));
        else setSite(cell.tooth, cell.site!, () => ({ [cell.field]: value }));
    };

    const cellOf = (key: string | null) => (key ? allRows.flatMap((r) => r.cells).find((c) => c.key === key) ?? null : null);

    /**
     * A character typed into a number cell. Returns the cell the cursor is in
     * afterwards, so a pasted "323434" fills six sites one after another.
     */
    const type = (cell: Cell, ch: string): Cell => {
        if (!/^[0-9-]$/.test(ch)) return cell;
        const [min, max] = RANGE[cell.field as NumberField];
        const pending = draftRef.current?.key === cell.key ? draftRef.current.text : '';
        const parsed = parseDepth(pending + ch, min, max);
        if (!parsed) {
            // "1" then "7": the 1 stands, the 7 goes to the next site.
            if (!pending) return cell;
            setDraft(null);
            const next = cellOf(nextOf(cell.key));
            if (!next) return cell;
            focus(next.key);
            return type(next, ch);
        }
        setValue(cell, parsed.value);
        if (!parsed.complete) {
            setDraft({ key: cell.key, text: pending + ch });
            return cell;
        }
        setDraft(null);
        const next = cellOf(nextOf(cell.key));
        if (!next) return cell;
        focus(next.key);
        return next;
    };

    const onKeyDown = (cell: Cell) => (e: React.KeyboardEvent) => {
        const arrows: Record<string, 'left' | 'right' | 'up' | 'down'> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
        if (arrows[e.key]) {
            e.preventDefault();
            setDraft(null);
            move(cell.key, arrows[e.key]);
            return;
        }
        if (!editable) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            setDraft(null);
            const next = nextOf(cell.key);
            if (next) focus(next);
            return;
        }
        if (cell.field === 'bop' || cell.field === 'plaque') {
            if (e.key === ' ') {
                e.preventDefault();
                toggle(cell);
            }
            return;
        }
        if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            setDraft(null);
            setValue(cell, null);
            return;
        }
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            type(cell, e.key);
        }
    };

    /** Bleeding row: none → bleeding → bleeding with pus → pus → none. Plaque: on / off. */
    const toggle = (cell: Cell) => {
        if (cell.field === 'plaque') return setSite(cell.tooth, cell.site!, (s) => ({ plaque: !s.plaque }));
        setSite(cell.tooth, cell.site!, (s) =>
            !s.bop && !s.sup ? { bop: true, sup: false } : s.bop && !s.sup ? { bop: true, sup: true } : s.bop ? { bop: false, sup: true } : { bop: false, sup: false },
        );
    };

    const deepColor = { deep: theme.palette.error.main, moderate: theme.palette.warning.dark } as const;
    const line = theme.palette.divider;

    const numberCell = (cell: Cell, opts: { level?: 'deep' | 'moderate' | null; prev?: number | null } = {}) => {
        const value = valueOf(cell);
        const text = draft?.key === cell.key ? draft.text : value == null ? '' : String(value);
        const changed = opts.prev != null && value != null ? value - opts.prev : 0;
        return (
            <Box
                component="input"
                data-cell={cell.key}
                value={text}
                readOnly={!editable}
                inputMode="numeric"
                autoComplete="off"
                aria-label={`${t('dental.tooth')} ${cell.tooth} · ${t(`perio.${cell.field}`)}${cell.site !== undefined ? ` · ${t(`perio.site.${cell.site}`)}` : ''}`}
                onKeyDown={onKeyDown(cell)}
                onBlur={() => setDraft((d) => (d?.key === cell.key ? null : d))}
                // Phones' keyboards do not always send key events; take the typed character from the change.
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    if (!editable) return;
                    const next = e.target.value;
                    if (next.length < text.length) {
                        setDraft(null);
                        setValue(cell, null);
                        return;
                    }
                    // Whatever was added (a key, or a pasted run of depths), one character at a time.
                    const added = next.startsWith(text) ? next.slice(text.length) : next;
                    let at = cell;
                    for (const ch of Array.from(added)) at = type(at, ch);
                }}
                sx={{
                    width: '100%',
                    height: 22,
                    p: 0,
                    border: 0,
                    outline: 'none',
                    textAlign: 'center',
                    font: 'inherit',
                    fontSize: 13,
                    fontWeight: opts.level ? 700 : 400,
                    color: opts.level ? deepColor[opts.level] : 'text.primary',
                    bgcolor:
                        changed >= 2
                            ? alpha(theme.palette.error.main, 0.14)
                            : changed <= -2
                              ? alpha(theme.palette.success.main, 0.16)
                              : 'transparent',
                    caretColor: 'transparent',
                    // A faint line shows where to type; nothing when read-only.
                    boxShadow: editable ? `inset 0 -1px 0 ${alpha(theme.palette.text.primary, 0.12)}` : 'none',
                    '&:hover': editable ? { bgcolor: 'action.hover' } : {},
                    '@media print': { boxShadow: 'none' },
                    '&:focus': { boxShadow: `inset 0 0 0 2px ${theme.palette.primary.main}`, borderRadius: '3px' },
                }}
            />
        );
    };

    const dot = (cell: Cell) => {
        const tooth = byNumber.get(cell.tooth)!;
        const s = tooth.sites[cell.site!];
        const on = cell.field === 'plaque' ? s.plaque : s.bop || s.sup;
        const fill = cell.field === 'plaque' ? (s.plaque ? theme.palette.info.main : 'transparent') : s.bop ? theme.palette.error.main : 'transparent';
        const ring = s.sup && cell.field === 'bop' ? theme.palette.warning.main : on ? fill : theme.palette.text.disabled;
        const state =
            cell.field === 'plaque'
                ? s.plaque
                    ? t('perio.plaque')
                    : t('perio.none')
                : [s.bop && t('perio.bop'), s.sup && t('perio.sup')].filter(Boolean).join(', ') || t('perio.none');
        return (
            <Box
                component="button"
                type="button"
                data-cell={cell.key}
                aria-label={`${t('dental.tooth')} ${cell.tooth} · ${t(`perio.site.${cell.site}`)} · ${state}`}
                aria-pressed={on}
                onClick={() => editable && toggle(cell)}
                onKeyDown={onKeyDown(cell)}
                sx={{
                    width: '100%',
                    height: 18,
                    p: 0,
                    border: 0,
                    bgcolor: 'transparent',
                    cursor: editable ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    outline: 'none',
                    '&:focus-visible': { boxShadow: `inset 0 0 0 2px ${theme.palette.primary.main}`, borderRadius: '3px' },
                }}
            >
                <Box
                    component="span"
                    sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: fill,
                        border: `${s.sup && cell.field === 'bop' ? 3 : 1.5}px solid ${ring}`,
                        opacity: on ? 1 : 0.45,
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact',
                    }}
                />
            </Box>
        );
    };

    const header = (tooth: PerioTooth) => (
        <Box
            component={editable ? 'button' : 'span'}
            type={editable ? 'button' : undefined}
            onClick={editable ? (e: React.MouseEvent<HTMLElement>) => setMenu({ anchor: e.currentTarget, tooth: tooth.toothNumber }) : undefined}
            aria-label={`${t('dental.tooth')} ${tooth.toothNumber}${tooth.missing ? `, ${t('perio.missing')}` : ''}${tooth.implant ? `, ${t('perio.implant')}` : ''}`}
            sx={{
                width: '100%',
                border: 0,
                bgcolor: 'transparent',
                font: 'inherit',
                fontWeight: 700,
                fontSize: 13,
                color: tooth.missing ? 'text.disabled' : 'text.primary',
                textDecoration: tooth.missing ? 'line-through' : 'none',
                cursor: editable ? 'pointer' : 'default',
                p: '2px 0',
                display: 'block',
            }}
        >
            {tooth.toothNumber}
            {tooth.implant && (
                <Box component="span" sx={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'info.main' }}>
                    {t('perio.implantShort')}
                </Box>
            )}
        </Box>
    );

    const labelCell = (text: string, strong = false) => (
        <Box
            component="th"
            scope="row"
            sx={{
                position: 'sticky',
                left: 0,
                zIndex: 1,
                bgcolor: 'background.paper',
                textAlign: 'left',
                fontSize: { xs: 11, sm: 12 },
                lineHeight: 1.2,
                fontWeight: strong ? 700 : 500,
                color: strong ? 'text.primary' : 'text.secondary',
                pr: 1,
                // On a phone the labels wrap, leaving room for the teeth.
                whiteSpace: { xs: 'normal', sm: 'nowrap' },
                minWidth: { xs: 84, sm: 0 },
                maxWidth: { xs: 116, sm: 'none' },
                overflowWrap: 'anywhere',
                borderRight: `1px solid ${line}`,
            }}
        >
            {text}
        </Box>
    );

    const renderArch = (arch: (typeof layout)[number]) => {
        const half = arch.teeth.findIndex((tooth) => [2, 3, 6, 7].includes(Math.floor(tooth.toothNumber / 10)));
        // A thicker line between the patient's right and left, and between teeth.
        const toothBorder = (i: number) => ({
            borderLeft: i === half ? `2px solid ${theme.palette.text.secondary}` : `1px solid ${line}`,
        });
        return (
            <Box
                component="table"
                key={arch.arch}
                sx={{
                    borderCollapse: 'collapse',
                    tableLayout: 'fixed',
                    mb: 2,
                    '& td': { width: 22, minWidth: 22, p: 0, textAlign: 'center', fontSize: 12 },
                    '& tr.side-start td, & tr.side-start th': { borderTop: `1px solid ${line}` },
                    '@media print': { '& td': { width: 19, minWidth: 19 } },
                }}
            >
                <caption style={{ captionSide: 'top', textAlign: 'left', fontWeight: 700, fontSize: 13, padding: '0 0 4px' }}>
                    {t(arch.arch === 'upper' ? 'perio.upperArch' : 'perio.lowerArch')}
                </caption>
                <tbody>
                    <tr>
                        {labelCell(t('dental.tooth'), true)}
                        {arch.teeth.map((tooth, i) => (
                            <Box
                                component="td"
                                key={tooth.toothNumber}
                                colSpan={3}
                                sx={{ ...toothBorder(i), bgcolor: tooth.missing ? 'action.hover' : undefined }}
                            >
                                {header(tooth)}
                            </Box>
                        ))}
                    </tr>
                    {arch.rows.map((row) => (
                        <tr key={row.id} className={row.sideLabel ? 'side-start' : undefined}>
                            {labelCell(row.sideLabel ? `${row.sideLabel} · ${row.label}` : row.label, !!row.sideLabel)}
                            {arch.teeth.map((tooth, i) => {
                                const shade = tooth.missing ? 'action.hover' : undefined;
                                if (row.field === 'mobility' || row.field === 'furcation') {
                                    const cell = row.cells.find((c) => c.tooth === tooth.toothNumber);
                                    return (
                                        <Box component="td" key={tooth.toothNumber} colSpan={3} sx={{ ...toothBorder(i), bgcolor: shade }}>
                                            {cell ? numberCell(cell) : null}
                                        </Box>
                                    );
                                }
                                return siteOrder(tooth.toothNumber, row.side!).map((site, k) => {
                                    const cellStyle = { ...(k === 0 ? toothBorder(i) : {}), bgcolor: shade };
                                    if (tooth.missing) return <Box component="td" key={`${tooth.toothNumber}-${site}`} sx={cellStyle} />;
                                    const s = tooth.sites[site];
                                    if (row.field === 'cal') {
                                        const v = cal(s);
                                        return (
                                            <Box component="td" key={`${tooth.toothNumber}-${site}`} sx={{ ...cellStyle, color: 'text.secondary', height: 20 }}>
                                                {v ?? ''}
                                            </Box>
                                        );
                                    }
                                    const cell = row.cells.find((c) => c.tooth === tooth.toothNumber && c.site === site)!;
                                    if (row.field === 'bop' || row.field === 'plaque') {
                                        return (
                                            <Box component="td" key={cell.key} sx={cellStyle}>
                                                {dot(cell)}
                                            </Box>
                                        );
                                    }
                                    const prev = row.field === 'pd' ? previous?.get(tooth.toothNumber)?.sites[site]?.pd ?? null : null;
                                    return (
                                        <Box component="td" key={cell.key} sx={{ ...cellStyle, verticalAlign: 'top' }}>
                                            {numberCell(cell, { level: row.field === 'pd' ? pdLevel(s.pd) : null, prev })}
                                            {previous && row.field === 'pd' && (
                                                <Box sx={{ fontSize: 10, lineHeight: '12px', color: 'text.disabled' }}>{prev ?? '·'}</Box>
                                            )}
                                        </Box>
                                    );
                                });
                            })}
                        </tr>
                    ))}
                </tbody>
            </Box>
        );
    };

    const menuTooth = menu ? byNumber.get(menu.tooth) : null;

    return (
        <Box ref={root} sx={{ overflowX: 'auto', '@media print': { overflow: 'visible' } }}>
            {layout.map(renderArch)}
            <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
                {menuTooth &&
                    (['missing', 'implant'] as const).map((flag) => (
                        <MenuItem key={flag} dense onClick={() => onChange(menuTooth.toothNumber, (tooth) => ({ ...tooth, [flag]: !tooth[flag] }))}>
                            <Checkbox size="small" edge="start" checked={menuTooth[flag]} tabIndex={-1} sx={{ py: 0 }} />
                            <ListItemText primary={t(`perio.${flag}`)} />
                        </MenuItem>
                    ))}
            </Menu>
        </Box>
    );
};

export default PerioGrid;
