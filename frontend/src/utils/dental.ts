import { ChartType, SurfaceState, SurfaceStatus, ToothStatus, ToothSurface, TreatmentEntry } from '../types';

/**
 * Everything the chart screens share: FDI numbering (D1), how teeth are laid
 * out, which surface sits where, labels and colours. There used to be three
 * copies of the status/surface maps, one per page.
 *
 * FDI: two digits, quadrant then position from the midline. Quadrants 1–4
 * are permanent teeth, 5–8 primary; 1/5 upper right, 2/6 upper left,
 * 3/7 lower left, 4/8 lower right (the patient's right and left).
 */

const range = (from: number, to: number) =>
    Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => (from <= to ? from + i : from - i));

/**
 * Rows as the dentist faces the patient: the patient's right is on the
 * viewer's left, in both arches. The old chart drew the lower arch in
 * numeric order, which mirrored it, so clinicians clicked the wrong tooth.
 */
export const CHART_ROWS: Record<ChartType, { upper: number[]; lower: number[] }> = {
    adult: {
        upper: [...range(18, 11), ...range(21, 28)],
        lower: [...range(48, 41), ...range(31, 38)],
    },
    pediatric: {
        upper: [...range(55, 51), ...range(61, 65)],
        lower: [...range(85, 81), ...range(71, 75)],
    },
};

/** Every tooth a treatment can be recorded on, permanent first (mixed dentition is allowed). */
export const ALL_TEETH: number[] = [
    ...[1, 2, 3, 4].flatMap((q) => range(q * 10 + 1, q * 10 + 8)),
    ...[5, 6, 7, 8].flatMap((q) => range(q * 10 + 1, q * 10 + 5)),
];

const quadrant = (tooth: number) => Math.floor(tooth / 10);
export const isUpperTooth = (tooth: number) => [1, 2, 5, 6].includes(quadrant(tooth));
/** The patient's right — drawn on the viewer's left. */
const isPatientRight = (tooth: number) => [1, 4, 5, 8].includes(quadrant(tooth));
/** Incisors and canines have an incisal edge instead of an occlusal surface. */
export const isAnteriorTooth = (tooth: number) => tooth % 10 <= 3;

export interface SurfaceLayout {
    top: ToothSurface;
    bottom: ToothSurface;
    left: ToothSurface;
    right: ToothSurface;
    center: ToothSurface;
}

/**
 * Which surface sits on each side of the five-part tooth diagram. The outer
 * (buccal) side faces away from the other arch, mesial faces the midline.
 */
export const surfaceLayout = (tooth: number): SurfaceLayout => {
    const upper = isUpperTooth(tooth);
    const right = isPatientRight(tooth);
    return {
        top: upper ? 'buccal' : 'lingual',
        bottom: upper ? 'palatal' : 'buccal',
        left: right ? 'distal' : 'mesial',
        right: right ? 'mesial' : 'distal',
        center: isAnteriorTooth(tooth) ? 'incisal' : 'occlusal',
    };
};

/** The surfaces that exist on this tooth, in a stable order (cervical is the gum line, all teeth). */
export const surfacesOf = (tooth: number): ToothSurface[] => {
    const l = surfaceLayout(tooth);
    return [l.center, 'mesial', 'distal', 'buccal', l.bottom === 'palatal' ? 'palatal' : 'lingual', 'cervical'];
};

export const TOOTH_STATUSES: ToothStatus[] = [
    'healthy', 'decayed', 'needs_treatment', 'filled', 'root_canal',
    'crown', 'veneer', 'bridge', 'implant', 'missing',
];

export const SURFACE_STATUSES: SurfaceStatus[] = ['decayed', 'filled', 'sealant'];

export const toothStatusKey = (status: ToothStatus) =>
    ({
        healthy: 'dental.healthy',
        filled: 'dental.filled',
        crown: 'dental.crown',
        missing: 'dental.missing',
        implant: 'dental.implant',
        needs_treatment: 'dental.needsTreatment',
        root_canal: 'dental.rootCanal',
        decayed: 'dental.decayed',
        bridge: 'dental.bridge',
        veneer: 'dental.veneer',
    })[status] ?? status;

/** One-or-two-letter mark drawn on the tooth, so the chart does not rely on colour alone. */
export const toothStatusShortKey = (status: ToothStatus) => `dental.short.${status}`;

export const surfaceKey = (surface: ToothSurface | string) => `dental.${surface}`;
export const surfaceStatusKey = (status: SurfaceStatus) => `dental.surface.${status}`;

/**
 * Whole-tooth colours. Healthy has none, so the eye lands on what needs
 * work. Picked to stay apart from each other (the old decayed / needs
 * treatment and filled / bridge pairs were near-identical) and readable on
 * both light and dark backgrounds.
 */
export const TOOTH_STATUS_COLORS: Record<ToothStatus, string> = {
    healthy: 'transparent',
    decayed: '#E53E3E',
    needs_treatment: '#DD6B20',
    filled: '#3182CE',
    root_canal: '#D53F8C',
    crown: '#D69E2E',
    veneer: '#38B2AC',
    bridge: '#4C51BF',
    implant: '#805AD5',
    missing: '#A0AEC0',
};

export const SURFACE_STATUS_COLORS: Record<SurfaceStatus, string> = {
    decayed: '#E53E3E',
    filled: '#3182CE',
    sealant: '#48BB78',
};

/** `voided` wins over the stored planned/done status. */
export const entryState = (entry: Pick<TreatmentEntry, 'status' | 'voidedAt'>) =>
    entry.voidedAt ? 'voided' : entry.status;

/** "16", "14, 15, 16" or "" for whole-mouth work. */
export const teethLabel = (teeth: number[] = []) => teeth.join(', ');

/** Same findings on the same surfaces, in any order. */
export const sameSurfaces = (a: SurfaceState[] = [], b: SurfaceState[] = []) => {
    const key = (list: SurfaceState[]) => list.map((s) => `${s.surface}:${s.status}`).sort().join();
    return key(a) === key(b);
};
