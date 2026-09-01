import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import worldTopo from 'world-atlas/countries-110m.json';
import { ringToSegments } from '../lib/geo';

interface CountryLinesProps {
    radius: number;
    color?: string;
    opacity?: number;
    /** Line thickness in pixels. */
    linewidth?: number;
}

export default function CountryLines({
    radius,
    color = '#868686',
    opacity = 0.65,
    linewidth = 0.4,
}: CountryLinesProps) {
    const { size } = useThree();

    const object = useMemo(() => {
        const topo = worldTopo as unknown as Topology<{
            countries: GeometryCollection;
        }>;
        const collection = feature(topo, topo.objects.countries) as unknown as {
            features: Feature<Polygon | MultiPolygon>[];
        };

        const positions: number[] = [];
        for (const f of collection.features) {
            const geom = f.geometry;
            if (!geom) continue;
            const polygons: number[][][][] =
                geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
            for (const polygon of polygons) {
                for (const ring of polygon) {
                    ringToSegments(ring, radius, positions);
                }
            }
        }

        const geometry = new LineSegmentsGeometry();
        geometry.setPositions(positions);

        const material = new LineMaterial({
            color: new THREE.Color(color).getHex(),
            linewidth,
            transparent: true,
            opacity,
            depthWrite: false,
            worldUnits: false,
        });

        return new LineSegments2(geometry, material);
    }, [radius, color, opacity, linewidth]);

    useEffect(() => {
        (object.material as LineMaterial).resolution.set(size.width, size.height);
    }, [object, size.width, size.height]);

    return <primitive object={object} />;
}
