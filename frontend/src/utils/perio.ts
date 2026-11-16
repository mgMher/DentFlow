import { PerioSite, PerioSummary, PerioTooth } from '../types';
import { CHART_ROWS, mixedSlot } from './dental';

/**
 * Periodontal charting (F12). Sites are stored DB, B, MB, DL, L, ML; on screen
 * each tooth shows them distal → mesial on the patient's right (viewer's left)
 * and mesial → distal on the left, so neighbouring teeth' sites sit side by side.
 */

export const PD_MAX = 15;
export const REC_MIN = -5;
export const REC_MAX = 15;

/** Pockets from 4 mm need attention; from 6 mm they are deep. */
export const pdLevel = (pd: number | null | undefined): 'deep' | 'moderate' | null =>
    pd == null ? null : pd >= 6 ? 'deep' : pd >= 4 ? 'moderate' : null;

export const emptySite = (): PerioSite => ({ pd: null, rec: null, bop: false, sup: false, plaque: false });

export const cal = (site: PerioSite): number | null => (site.pd != null && site.rec != null ? site.pd + site.rec : null);

/** On the viewer's right half (patient's left: quadrants 2, 3, 6, 7) a tooth reads mesial first. */
const readsMesialFirst = (tooth: number) => [2, 3, 6, 7].includes(Math.floor(tooth / 10));

/** Indexes into `sites` for one side, in screen order (left to right). */
export const siteOrder = (tooth: number, side: 'buccal' | 'lingual'): number[] => {
    const base = side === 'buccal' ? [0, 1, 2] : [3, 4, 5];
    return readsMesialFirst(tooth) ? [...base].reverse() : base;
};

/** The exam's teeth of one arch, as the dentist faces the patient (works for permanent, primary and mixed). */
export const archTeeth = (teeth: PerioTooth[], arch: 'upper' | 'lower'): PerioTooth[] => {
    const byNumber = new Map(teeth.map((t) => [t.toothNumber, t]));
    const numbers = new Set(byNumber.keys());
    return CHART_ROWS.adult[arch]
        .map((position) => mixedSlot(position, numbers))
        .filter((n): n is number => n !== null)
        .map((n) => byNumber.get(n)!);
};

export const SUMMARY_ROWS: { key: keyof PerioSummary; label: string; unit?: string; lowerIsBetter: boolean }[] = [
    { key: 'meanPd', label: 'perio.meanPd', unit: 'mm', lowerIsBetter: true },
    { key: 'meanCal', label: 'perio.meanCal', unit: 'mm', lowerIsBetter: true },
    { key: 'bopPercent', label: 'perio.bopPercent', unit: '%', lowerIsBetter: true },
    { key: 'plaquePercent', label: 'perio.plaquePercent', unit: '%', lowerIsBetter: true },
    { key: 'sites4plus', label: 'perio.sites4plus', lowerIsBetter: true },
    { key: 'sites6plus', label: 'perio.sites6plus', lowerIsBetter: true },
    { key: 'mobileTeeth', label: 'perio.mobileTeeth', lowerIsBetter: true },
    { key: 'furcationTeeth', label: 'perio.furcationTeeth', lowerIsBetter: true },
];

/**
 * What a typed value becomes, and whether it is complete (the cursor moves on):
 * "3" is complete, "1" may become 10–15, "-" waits for its digit.
 */
export const parseDepth = (text: string, min: number, max: number): { value: number | null; complete: boolean } | null => {
    if (text === '') return { value: null, complete: false };
    if (text === '-' && min < 0) return { value: null, complete: false };
    if (!/^-?\d{1,2}$/.test(text)) return null;
    const value = Number(text);
    if (value < min || value > max) return null;
    const digits = text.replace('-', '');
    // Another digit could still follow only after a "1" (10–15).
    const complete = digits.length === 2 || digits !== '1' || max < 10 || value < 0;
    return { value, complete };
};

/** Molars, upper first premolars and primary molars can have a furcation. */
export const hasFurcation = (tooth: number) => {
    const quadrant = Math.floor(tooth / 10);
    const position = tooth % 10;
    if (quadrant >= 5) return position >= 4;
    return position >= 6 || (position === 4 && (quadrant === 1 || quadrant === 2));
};
