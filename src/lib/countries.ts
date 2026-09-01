// Shared country-geometry helpers backed by the world-atlas TopoJSON. Both the
// darkened country fills and the civilization markers use these so the lookup
// (and its caches) happen once per location.
import { feature } from 'topojson-client';
import { geoContains, geoCentroid } from 'd3-geo';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import worldTopo from 'world-atlas/countries-110m.json';

let cachedFeatures: Feature<Polygon | MultiPolygon>[] | null = null;
export function getCountryFeatures(): Feature<Polygon | MultiPolygon>[] {
    if (cachedFeatures) return cachedFeatures;
    const topo = worldTopo as unknown as Topology<{ countries: GeometryCollection }>;
    const collection = feature(topo, topo.objects.countries) as unknown as {
        features: Feature<Polygon | MultiPolygon>[];
    };
    cachedFeatures = collection.features;
    return cachedFeatures;
}

// Cache each point → its country feature (points are fixed, so the expensive
// geoContains only runs once per location, ever).
const countryCache = new Map<string, Feature<Polygon | MultiPolygon> | null>();
export function countryFor(lat: number, lon: number): Feature<Polygon | MultiPolygon> | null {
    const key = `${lat},${lon}`;
    let found = countryCache.get(key);
    if (found === undefined) {
        found = getCountryFeatures().find((f) => geoContains(f, [lon, lat])) ?? null;
        countryCache.set(key, found);
    }
    return found;
}

// Spherical centroid [lon, lat] of the country containing a point, or null.
const centroidCache = new Map<string, [number, number] | null>();
export function countryCentroid(lat: number, lon: number): [number, number] | null {
    const key = `${lat},${lon}`;
    let c = centroidCache.get(key);
    if (c === undefined) {
        const country = countryFor(lat, lon);
        c = country ? (geoCentroid(country) as [number, number]) : null;
        centroidCache.set(key, c);
    }
    return c;
}

// Human-readable name of the country containing a point, or null.
export function countryName(lat: number, lon: number): string | null {
    const country = countryFor(lat, lon);
    const props = country?.properties as { name?: string } | null | undefined;
    return props?.name ?? null;
}
