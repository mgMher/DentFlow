/**
 * FDI (ISO 3950) tooth numbering — the standard in Armenia and Russia.
 *
 * Two digits: quadrant then position from the midline. Permanent teeth use
 * quadrants 1–4 (positions 1–8), primary teeth 5–8 (positions 1–5).
 * Quadrants run clockwise from the patient's upper right: 1/5 upper right,
 * 2/6 upper left, 3/7 lower left, 4/8 lower right.
 *
 * Charts used US "Universal" numbering (1–32, primary 51–70 for A–T) until
 * 2026-10; `universalToFdi` converts those once at startup.
 */

export type ChartType = 'adult' | 'pediatric';

const range = (from: number, to: number) =>
    Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => (from <= to ? from + i : from - i));

const quadrant = (q: number, count: number) => range(q * 10 + 1, q * 10 + count);

export const ADULT_TEETH: readonly number[] = [1, 2, 3, 4].flatMap((q) => quadrant(q, 8));
export const PEDIATRIC_TEETH: readonly number[] = [5, 6, 7, 8].flatMap((q) => quadrant(q, 5));

const ALL_TEETH = new Set([...ADULT_TEETH, ...PEDIATRIC_TEETH]);

/** Any permanent or primary tooth — a treatment may be recorded on either (mixed dentition). */
export const isFdiTooth = (n: unknown): n is number => typeof n === 'number' && ALL_TEETH.has(n);

export const teethFor = (chartType: ChartType): readonly number[] =>
    chartType === 'pediatric' ? PEDIATRIC_TEETH : ADULT_TEETH;

/**
 * Universal 1–16 run upper right → upper left, 17–32 lower left → lower right.
 * Index = universal number − 1.
 */
const UNIVERSAL_ADULT = [...range(18, 11), ...range(21, 28), ...range(38, 31), ...range(41, 48)];

/** Universal A–T, stored as 51–70, in the same order. Index = stored number − 51. */
const UNIVERSAL_PRIMARY = [...range(55, 51), ...range(61, 65), ...range(75, 71), ...range(81, 85)];

/** A tooth number from the old Universal charts, or `null` if it is not one. */
export const universalToFdi = (n: number): number | null => {
    if (n >= 1 && n <= 32) return UNIVERSAL_ADULT[n - 1];
    if (n >= 51 && n <= 70) return UNIVERSAL_PRIMARY[n - 51];
    return null;
};
