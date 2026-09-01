import { useEffect, useRef, useState } from 'react';
import { MIN_YEAR, MAX_YEAR, formatYear } from '../data/new-data/timeline';

interface TimelineProps {
    year: number;
    onYear: (year: number) => void;
    activeCount: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// How many years of scale are visible across the full rail height. The ruler is
// centre-locked (Cupertino style): the current year always sits at the vertical
// middle and the tick lines scroll behind it.
const WINDOW_YEARS = 3000;
// Minor tick every 100 years; a longer "major" line every 500.
const MINOR_STEP = 100;
const MAJOR_STEP = 500;

// Pre-compute the tick years once.
const TICKS: { year: number; major: boolean }[] = [];
for (let y = Math.ceil(MIN_YEAR / MINOR_STEP) * MINOR_STEP; y <= MAX_YEAR; y += MINOR_STEP) {
    TICKS.push({ year: y, major: y % MAJOR_STEP === 0 });
}

// Vertical, left-anchored ruler. Oldest year sits toward the top; scrubbing
// scrolls the scale so the selected year stays pinned at the centre readout.
export default function Timeline({ year, onYear, activeCount }: TimelineProps) {
    const railRef = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);
    const lastPos = useRef(0);
    const accum = useRef(year);

    // On tablets/phones the ruler lies horizontally along the bottom; scrubbing
    // and the tick scale then run along the X axis instead of Y.
    const [horizontal, setHorizontal] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 900px)');
        const apply = () => setHorizontal(mq.matches);
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);

    const yearsPerPixel = () => {
        const rail = railRef.current;
        const rect = rail?.getBoundingClientRect();
        const extent = horizontal ? rect?.width : rect?.height;
        return WINDOW_YEARS / (extent || 600);
    };

    const posOf = (e: React.PointerEvent<HTMLDivElement>) =>
        horizontal ? e.clientX : e.clientY;

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        dragging.current = true;
        lastPos.current = posOf(e);
        accum.current = year;
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragging.current) return;
        const cur = posOf(e);
        const d = cur - lastPos.current;
        lastPos.current = cur;
        // Drag toward the end (down / right) → scale moves that way → earlier
        // years reach the centre.
        accum.current = clamp(accum.current - d * yearsPerPixel(), MIN_YEAR, MAX_YEAR);
        onYear(Math.round(accum.current));
    };
    const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        dragging.current = false;
        try {
            (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        } catch {
            /* ignore */
        }
    };
    const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        const delta = e.deltaY > 0 ? 25 : -25;
        onYear(clamp(year + delta, MIN_YEAR, MAX_YEAR));
    };
    const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            onYear(clamp(year + 25, MIN_YEAR, MAX_YEAR));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            onYear(clamp(year - 25, MIN_YEAR, MAX_YEAR));
        }
    };

    const half = WINDOW_YEARS / 2;

    return (
        <div className={`timeline timeline-ruler${horizontal ? ' is-horizontal' : ''}`}>
            <div
                ref={railRef}
                className="tl-rail"
                role="slider"
                tabIndex={0}
                aria-label="Year"
                aria-valuemin={MIN_YEAR}
                aria-valuemax={MAX_YEAR}
                aria-valuenow={year}
                aria-valuetext={formatYear(year)}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onWheel={onWheel}
                onKeyDown={onKey}
            >
                <div className="tl-ticks" aria-hidden="true">
                    {TICKS.map((t) => {
                        const off = t.year - year;
                        if (Math.abs(off) > half + MINOR_STEP) return null;
                        const pct = 50 + (off / WINDOW_YEARS) * 100;
                        const fade = 1 - Math.min(1, Math.abs(off) / half) * 0.82;
                        const style = horizontal
                            ? { left: `${pct}%`, opacity: fade }
                            : { top: `${pct}%`, opacity: fade };
                        return (
                            <span
                                key={t.year}
                                className={`tl-tick${t.major ? ' is-major' : ''}`}
                                style={style}
                            />
                        );
                    })}
                </div>

                <div className="tl-selector" aria-hidden="true" />

                <div className="tl-readout" aria-hidden="true">
                    <span className="tl-readout-year">{formatYear(year)}</span>
                    <span className="tl-readout-active">
                        {activeCount} civilization{activeCount === 1 ? '' : 's'}
                    </span>
                </div>
            </div>
        </div>
    );
}
