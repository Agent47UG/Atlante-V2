// ─────────────────────────────────────────────────────────────────────────────
// Meteors — shooting stars that live inside the 3D star scene.
//
// Rendered within the Starfield <Canvas>, whose camera sits at the origin and
// copies the globe's orientation every frame. Each meteor is placed at a fixed
// world position out among the stars, so as the earth (and therefore the sky
// camera) rotates, the meteor pans WITH the starfield — it reads as a physical
// object suspended in space rather than a flat screen overlay. On top of that
// it glides a short arc and fades, giving the streak.
//
// A small fixed pool of billboarded, gradient-mapped quads is animated
// imperatively in useFrame (no per-frame React state). Disabled for users who
// prefer reduced motion.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const POOL = 16;
const RADIUS = 78; // distance out among the stars (dome sits at 100)

interface Slot {
    active: boolean;
    birth: number; // performance.now() ms
    duration: number; // ms
    dist: number; // world units travelled over its life
    length: number; // streak length, world units
    width: number; // streak thickness, world units
    start: THREE.Vector3;
    dir: THREE.Vector3;
}

// A comet streak baked into a canvas: a teardrop needle — a point at the tail
// widening to a small rounded, hot leading head — with a defined core and a
// soft edge, so it reads as a crisp streak rather than a round blob.
function makeStreakTexture(): THREE.Texture {
    const W = 512;
    const H = 64;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(W, H);
    const data = img.data;

    const headPos = 0.86; // leading head position along the length

    for (let y = 0; y < H; y++) {
        const v = ((y + 0.5) / H - 0.5) * 2; // -1..1 across the width
        for (let x = 0; x < W; x++) {
            const u = (x + 0.5) / W; // 0 tail .. 1 leading tip

            // Teardrop half-width: a point at the tail, widening toward the
            // head, then a small rounded cap at the leading tip — so it reads
            // as a streak rather than a round egg.
            let hw: number;
            if (u <= headPos) {
                hw = Math.pow(u / headPos, 0.6);
            } else {
                const k = (u - headPos) / (1 - headPos);
                hw = Math.sqrt(Math.max(0, 1 - k * k));
            }

            // Defined core with a soft edge across the width.
            const r = hw > 0 ? Math.abs(v) / hw : 2;
            const across = r < 1 ? Math.pow(1 - r * r, 1.6) : 0;

            // Bright at the head, fading down the tail.
            const along = u <= headPos ? Math.pow(u / headPos, 1.5) : 1;

            // A tight hot head keeps the leading point crisp.
            const dh = u - headPos;
            const headGlow = Math.exp(
                -(dh * dh) / (2 * 0.03 * 0.03) - (v * v) / (2 * 0.3 * 0.3),
            );

            const a = Math.min(1, across * along + headGlow * 0.7);

            // Warm toward the tail, white-hot at the head.
            const warm = 1 - u;
            const idx = (y * W + x) * 4;
            data[idx] = 255;
            data[idx + 1] = Math.round(255 - warm * 14);
            data[idx + 2] = Math.round(255 - warm * 48);
            data[idx + 3] = Math.round(a * 255);
        }
    }

    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 8;
    return tex;
}

export default function Meteors() {
    const { camera } = useThree();
    const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
    const tex = useMemo(makeStreakTexture, []);
    const slots = useRef<Slot[]>(
        Array.from({ length: POOL }, () => ({
            active: false,
            birth: 0,
            duration: 0,
            dist: 0,
            length: 0,
            width: 0,
            start: new THREE.Vector3(),
            dir: new THREE.Vector3(),
        })),
    );

    // Scratch vectors reused every frame / spawn to avoid allocations.
    const tmp = useMemo(
        () => ({
            f: new THREE.Vector3(),
            r: new THREE.Vector3(),
            u: new THREE.Vector3(),
            x: new THREE.Vector3(),
            y: new THREE.Vector3(),
            z: new THREE.Vector3(),
            pos: new THREE.Vector3(),
            m: new THREE.Matrix4(),
        }),
        [],
    );

    // Spawn scheduler — one meteor roughly every 10s, with a little variance
    // so it never feels metronomic.
    useEffect(() => {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        let timer = 0;
        const spawn = () => {
            const slot = slots.current.find((s) => !s.active);
            if (slot) {
                // Camera basis (the sky camera only ever rotates about origin).
                tmp.f.set(0, 0, -1).applyQuaternion(camera.quaternion);
                tmp.r.set(1, 0, 0).applyQuaternion(camera.quaternion);
                tmp.u.set(0, 1, 0).applyQuaternion(camera.quaternion);

                // Place it somewhere in the current field of view.
                const yaw = (Math.random() - 0.5) * 1.1; // ~±31°
                const pitch = (Math.random() - 0.5) * 0.7; // ~±20°
                tmp.z
                    .copy(tmp.f)
                    .addScaledVector(tmp.r, Math.tan(yaw))
                    .addScaledVector(tmp.u, Math.tan(pitch))
                    .normalize();
                slot.start.copy(tmp.z).multiplyScalar(RADIUS);

                // Travel near-horizontal, left or right, with a touch of drift.
                const leftward = Math.random() < 0.5;
                slot.dir
                    .copy(tmp.r)
                    .multiplyScalar(leftward ? -1 : 1)
                    .addScaledVector(tmp.u, (Math.random() - 0.5) * 0.22)
                    .normalize();

                slot.length = 3.5 + Math.random() * 3.5;
                slot.width = slot.length * (0.06 + Math.random() * 0.03);
                slot.dist = RADIUS * (0.28 + Math.random() * 0.22);
                slot.duration = 1090 + Math.random() * 860;
                slot.birth = performance.now();
                slot.active = true;
            }
            timer = window.setTimeout(spawn, 9000 + Math.random() * 2000);
        };
        timer = window.setTimeout(spawn, 5000);
        return () => window.clearTimeout(timer);
    }, [camera, tmp]);

    useFrame(() => {
        const now = performance.now();
        for (let i = 0; i < POOL; i++) {
            const s = slots.current[i];
            const mesh = meshRefs.current[i];
            if (!mesh) continue;
            if (!s.active) {
                if (mesh.visible) mesh.visible = false;
                continue;
            }
            const t = (now - s.birth) / s.duration;
            if (t >= 1) {
                s.active = false;
                mesh.visible = false;
                continue;
            }

            // Glide along the travel direction.
            tmp.pos.copy(s.start).addScaledVector(s.dir, t * s.dist);
            mesh.position.copy(tmp.pos);

            // Billboard toward the camera (origin), length aligned to travel.
            tmp.z.copy(tmp.pos).multiplyScalar(-1).normalize();
            tmp.x.copy(s.dir).addScaledVector(tmp.z, -s.dir.dot(tmp.z)).normalize();
            tmp.y.copy(tmp.z).cross(tmp.x);
            tmp.m.makeBasis(tmp.x, tmp.y, tmp.z);
            mesh.quaternion.setFromRotationMatrix(tmp.m);
            mesh.scale.set(s.length, s.width, 1);

            // Fade in quickly, ease out over the tail of its life.
            const fadeIn = Math.min(1, t / 0.15);
            const fadeOut = t > 0.55 ? Math.max(0, 1 - (t - 0.55) / 0.45) : 1;
            (mesh.material as THREE.MeshBasicMaterial).opacity =
                Math.min(fadeIn, fadeOut) * 0.9;
            mesh.visible = true;
        }
    });

    return (
        <group>
            {Array.from({ length: POOL }).map((_, i) => (
                <mesh
                    key={i}
                    ref={(el) => {
                        meshRefs.current[i] = el;
                    }}
                    visible={false}
                    frustumCulled={false}
                    renderOrder={5}
                >
                    <planeGeometry args={[1, 1]} />
                    <meshBasicMaterial
                        map={tex}
                        transparent
                        opacity={0}
                        blending={THREE.AdditiveBlending}
                        depthTest={false}
                        depthWrite={false}
                        toneMapped={false}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            ))}
        </group>
    );
}
