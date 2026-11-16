/** What a perio exam adds up to, the figures dentists compare between visits. */
export interface PerioSummary {
    /** Teeth present (not missing). */
    teeth: number;
    /** Sites with a probing depth. */
    sitesProbed: number;
    meanPd: number | null;
    /** Mean attachment loss over sites with both depth and recession. */
    meanCal: number | null;
    /** % of sites on present teeth. */
    bopPercent: number | null;
    plaquePercent: number | null;
    sites4plus: number;
    sites6plus: number;
    mobileTeeth: number;
    furcationTeeth: number;
}

interface SiteLike {
    pd?: number | null;
    rec?: number | null;
    bop?: boolean;
    plaque?: boolean;
}
interface ToothLike {
    missing?: boolean;
    mobility?: number | null;
    furcation?: number | null;
    sites?: SiteLike[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function summarizePerio(teeth: ToothLike[]): PerioSummary {
    const present = teeth.filter((t) => !t.missing);
    const sites = present.flatMap((t) => t.sites ?? []);
    const pds = sites.map((s) => s.pd).filter((x): x is number => typeof x === 'number');
    const cals = sites.filter((s) => typeof s.pd === 'number' && typeof s.rec === 'number').map((s) => s.pd! + s.rec!);
    // The share of all six sites of every present tooth — the usual full-mouth score.
    const total = present.length * 6;
    const percent = (n: number) => (total && sites.length ? round1((n * 100) / total) : null);
    return {
        teeth: present.length,
        sitesProbed: pds.length,
        meanPd: mean(pds),
        meanCal: mean(cals),
        bopPercent: percent(sites.filter((s) => s.bop).length),
        plaquePercent: percent(sites.filter((s) => s.plaque).length),
        sites4plus: pds.filter((x) => x >= 4).length,
        sites6plus: pds.filter((x) => x >= 6).length,
        mobileTeeth: present.filter((t) => (t.mobility ?? 0) > 0).length,
        furcationTeeth: present.filter((t) => (t.furcation ?? 0) > 0).length,
    };
}
