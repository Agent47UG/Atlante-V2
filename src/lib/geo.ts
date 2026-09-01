import * as THREE from 'three';

/** Convert lat/lon (degrees) on a sphere of given radius to a THREE.Vector3. */
export function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
}

/**
 * Convert a flat array of [lon, lat] coordinate rings into pairs of vertices
 * suitable for THREE.LineSegments (each edge becomes two vertices).
 */
export function ringToSegments(
    ring: number[][],
    radius: number,
    out: number[],
): void {
    for (let i = 0; i < ring.length - 1; i++) {
        const [lon1, lat1] = ring[i];
        const [lon2, lat2] = ring[i + 1];
        const a = latLonToVec3(lat1, lon1, radius);
        const b = latLonToVec3(lat2, lon2, radius);
        out.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
}
