/**
 * Timeline markers. Years are numeric: negative = BC, positive = AD.
 * The slider snaps to these epochs but interpolates smoothly between them.
 */
export interface TimelineMarker {
    year: number;
    label: string;
}

export const TIMELINE: TimelineMarker[] = [
    { year: -3000, label: '3000 BC' },
    { year: -2000, label: '2000 BC' },
    { year: -1000, label: '1000 BC' },
    { year: -500, label: '500 BC' },
    { year: 0, label: '0 AD' },
    { year: 500, label: '500 AD' },
    { year: 1000, label: '1000 AD' },
    { year: 1500, label: '1500 AD' },
    { year: 1800, label: '1800 AD' },
    { year: 1900, label: '1900 AD' },
    { year: 2000, label: '2000 AD' },
];

export const MIN_YEAR = TIMELINE[0].year;
export const MAX_YEAR = TIMELINE[TIMELINE.length - 1].year;

/** Human-readable label for any year. */
export function formatYear(year: number): string {
    const rounded = Math.round(year);
    if (rounded < 0) return `${Math.abs(rounded)} BC`;
    if (rounded === 0) return '0';
    return `${rounded} AD`;
}

/** Nearest marker to a given year (used for snapping). */
export function nearestMarker(year: number): TimelineMarker {
    return TIMELINE.reduce((best, m) =>
        Math.abs(m.year - year) < Math.abs(best.year - year) ? m : best
    );
}
