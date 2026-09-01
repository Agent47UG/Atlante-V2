import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { geoEquirectangular, geoPath } from 'd3-geo';
import type { GeoPath, GeoPermissibleObjects } from 'd3-geo';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { countryFor } from '../lib/countries';

interface CivPoint {
    id: string;
    lat: number;
    lon: number;
}

interface CountryFillProps {
    radius: number;
    /** Civilizations whose countries should be darkened. */
    civs: CivPoint[];
    color?: string;
    opacity?: number;
}

const TEX_WIDTH = 2048;
const TEX_HEIGHT = 1024;
// Seconds to fade a country fully in (or out). Kept short so scrubbing the
// timeline stays snappy while still softening the transition.
const FADE_DURATION = 0.35;

interface FillCountry {
    feature: Feature<Polygon | MultiPolygon>;
    /** Current animated alpha in [0,1]. */
    alpha: number;
    /** Where alpha is heading: 1 while present, 0 once removed. */
    target: number;
}

export default function CountryFill({
    radius,
    civs,
    color = '#1f1a12',
    opacity = 0.45,
}: CountryFillProps) {
    // Persistent canvas/texture reused across renders so we can repaint it as
    // countries fade in and out instead of rebuilding from scratch.
    const canvas = useMemo(() => {
        const c = document.createElement('canvas');
        c.width = TEX_WIDTH;
        c.height = TEX_HEIGHT;
        return c;
    }, []);

    const texture = useMemo(() => {
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.anisotropy = 4;
        return tex;
    }, [canvas]);

    const path = useMemo<GeoPath<unknown, GeoPermissibleObjects>>(() => {
        const ctx = canvas.getContext('2d');
        // Equirectangular projection mapping [-180,180] x [-90,90] -> [0,W] x [0,H].
        const projection = geoEquirectangular()
            .scale(TEX_WIDTH / (2 * Math.PI))
            .translate([TEX_WIDTH / 2, TEX_HEIGHT / 2])
            .precision(0.1);
        return geoPath(projection, ctx ?? undefined);
    }, [canvas]);

    // Country id -> its fade state. Persists across renders.
    const countriesRef = useRef<Map<string, FillCountry>>(new Map());
    // Forces at least one repaint after the membership set changes.
    const dirtyRef = useRef(true);

    // Only reconcile the membership set when the SET of countries changes (not
    // on every year tick), so scrubbing within a stable membership stays cheap.
    const key = useMemo(() => civs.map((c) => c.id).sort().join('|'), [civs]);

    useEffect(() => {
        const map = countriesRef.current;
        const present = new Set<string>();
        for (const c of civs) {
            const country = countryFor(c.lat, c.lon);
            if (!country) continue;
            const id = String(country.id ?? `${c.lat},${c.lon}`);
            present.add(id);
            const existing = map.get(id);
            if (existing) {
                existing.target = 1;
            } else {
                map.set(id, { feature: country, alpha: 0, target: 1 });
            }
        }
        // Anything no longer present fades back out.
        for (const [id, entry] of map) {
            if (!present.has(id)) entry.target = 0;
        }
        dirtyRef.current = true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    const repaint = () => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, TEX_WIDTH, TEX_HEIGHT);
        ctx.fillStyle = color;
        for (const entry of countriesRef.current.values()) {
            if (entry.alpha <= 0) continue;
            ctx.globalAlpha = entry.alpha;
            ctx.beginPath();
            path(entry.feature);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        texture.needsUpdate = true;
    };

    useFrame((_, delta) => {
        const map = countriesRef.current;
        const step = FADE_DURATION > 0 ? delta / FADE_DURATION : 1;
        let animating = false;
        for (const [id, entry] of map) {
            if (entry.alpha !== entry.target) {
                if (entry.alpha < entry.target) {
                    entry.alpha = Math.min(entry.target, entry.alpha + step);
                } else {
                    entry.alpha = Math.max(entry.target, entry.alpha - step);
                }
                animating = true;
            }
            // Drop fully-faded, removed countries so the map doesn't grow.
            if (entry.target === 0 && entry.alpha <= 0) map.delete(id);
        }
        if (animating || dirtyRef.current) {
            repaint();
            dirtyRef.current = false;
        }
    });

    useEffect(() => {
        return () => {
            texture.dispose();
        };
    }, [texture]);

    // Three.js SphereGeometry default UVs map:
    //   u=0   -> -X axis   (lon = ±180)
    //   u=0.5 -> +X axis   (lon = 0)
    //   u=0.25 -> +Z axis  (lon = -90)
    //   u=0.75 -> -Z axis  (lon = +90)
    // Our latLonToVec3 puts lon=0 at +X, lon=-90 at +Z, lon=180 at -X — exactly
    // matching the equirectangular texture above. No rotation needed.
    return (
        <mesh renderOrder={1}>
            <sphereGeometry args={[radius, 128, 64]} />
            <meshBasicMaterial
                map={texture}
                transparent
                opacity={opacity}
                depthWrite={false}
                side={THREE.FrontSide}
            />
        </mesh>
    );
}


