import * as THREE from 'three';

// Orientation published by the globe camera and consumed by the starfield so the
// background sky stays locked to the globe's rotation.
export const skyOrientation = new THREE.Quaternion();
