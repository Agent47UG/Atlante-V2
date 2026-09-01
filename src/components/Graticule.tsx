import { useMemo } from 'react';
import * as THREE from 'three';
import { latLonToVec3 } from '../lib/geo';

interface GraticuleProps {
    radius: number;
    color?: string;
    opacity?: number;
    /** Spacing between meridians, in degrees. */
    meridianStep?: number;
    /** Spacing between parallels, in degrees. */
    parallelStep?: number;
    /** Sampling density along each line, in degrees. */
    sampleStep?: number;
}

export default function Graticule({
    radius,
    color = '#bbbbbb',
    opacity = 0.4,
    meridianStep = 4,
    parallelStep = 4.5,
    sampleStep = 2,
}: GraticuleProps) {
    const geometry = useMemo(() => {
        const positions: number[] = [];

        const pushSegment = (lat1: number, lon1: number, lat2: number, lon2: number) => {
            const a = latLonToVec3(lat1, lon1, radius);
            const b = latLonToVec3(lat2, lon2, radius);
            positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        };

        // Meridians (vertical lines): constant longitude, latitude sweeps pole to pole.
        for (let lon = -180; lon < 180; lon += meridianStep) {
            for (let lat = -90; lat < 90; lat += sampleStep) {
                pushSegment(lat, lon, Math.min(lat + sampleStep, 90), lon);
            }
        }

        // Parallels (horizontal lines): constant latitude, longitude wraps the globe.
        for (let lat = -90 + parallelStep; lat < 90; lat += parallelStep) {
            for (let lon = -180; lon < 180; lon += sampleStep) {
                pushSegment(lat, lon, lat, Math.min(lon + sampleStep, 180));
            }
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3),
        );
        return geom;
    }, [radius, meridianStep, parallelStep, sampleStep]);

    return (
        <lineSegments geometry={geometry}>
            <lineBasicMaterial
                color={color}
                transparent
                opacity={opacity}
                depthWrite={false}
            />
        </lineSegments>
    );
}
