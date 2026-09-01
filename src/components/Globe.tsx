import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import Graticule from './Graticule';
import CountryLines from './CountryLines';
import CountryFill from './CountryFill';
import { skyOrientation } from './skyOrientation';
import { latLonToVec3 } from '../lib/geo';
import { countryCentroid } from '../lib/countries';
import type { Civilization } from '../data/types';
import { civilizationIntensity } from '../data/new-data/civilizations';

const RADIUS = 1;
const IDLE_MS = 1500;
const CAMERA_DISTANCE = 3.6;
// When an event is selected the camera lifts above the country by this angle so
// the country rotates downward and reads as the ground (not dead-centre).
const SELECT_TILT = THREE.MathUtils.degToRad(-60);

interface GlobeProps {
    civilizations?: Civilization[];
    selectedCivId?: string | null;
    onSelectCiv?: (id: string) => void;
    /** Current timeline year — drives civilization glow. */
    year?: number;
    /** When true the globe zooms and drops so the civilization reads as the ground. */
    groundMode?: boolean;
    /** Fired once the globe has finished flying back to the default framing. */
    onGroundSettled?: () => void;
}

/** A thin ring that always faces the camera, drawing the globe's silhouette outline. */
function GlobeOutline({ radius, color = '#3a3a35' }: { radius: number; color?: string }) {
    const { camera } = useThree();

    const lineObject = useMemo(() => {
        const segments = 256;
        const positions = new Float32Array((segments + 1) * 3);
        for (let i = 0; i <= segments; i++) {
            const t = (i / segments) * Math.PI * 2;
            positions[i * 3] = Math.cos(t) * radius;
            positions[i * 3 + 1] = Math.sin(t) * radius;
            positions[i * 3 + 2] = 0;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.LineBasicMaterial({
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.85,
        });
        return new THREE.Line(g, mat);
    }, [radius, color]);

    useFrame(() => {
        lineObject.quaternion.copy(camera.quaternion);
    });

    return <primitive object={lineObject} />;
}

/** Darker great circle at latitude 0. */
function Equator({ radius, color = '#a1a1a1' }: { radius: number; color?: string }) {
    const geometry = useMemo(() => {
        const segments = 360;
        const positions: number[] = [];
        for (let i = 0; i < segments; i++) {
            const lon1 = -180 + (i / segments) * 360;
            const lon2 = -180 + ((i + 1) / segments) * 360;
            const a = latLonToVec3(0, lon1, radius);
            const b = latLonToVec3(0, lon2, radius);
            positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        return g;
    }, [radius]);

    return (
        <lineSegments geometry={geometry}>
            <lineBasicMaterial color={color} transparent opacity={0.75} depthWrite={false} />
        </lineSegments>
    );
}

/** Soft, flat dots at each pole that fade out at the edges (radial gradient sprite). */
function PoleDots({ radius, color = '#3a3a35' }: { radius: number; color?: string }) {
    const texture = useMemo(() => {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const c = new THREE.Color(color);
        const r = Math.round(c.r * 255);
        const g = Math.round(c.g * 255);
        const b = Math.round(c.b * 255);
        const gradient = ctx.createRadialGradient(
            size / 2, size / 2, 0,
            size / 2, size / 2, size / 2,
        );
        gradient.addColorStop(0.0, `rgba(${r},${g},${b},0.8)`);
        gradient.addColorStop(0.45, `rgba(${r},${g},${b},0.44)`);
        gradient.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
    }, [color]);

    const dotScale = radius * 0.01;

    return (
        <>
            {/* North pole: circle tangent to the sphere, lying flat on the surface. */}
            <mesh position={[0, radius * 1.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[dotScale, 48]} />
                <meshBasicMaterial map={texture} transparent depthWrite={false} />
            </mesh>
            {/* South pole. */}
            <mesh position={[0, -radius * 1.001, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <circleGeometry args={[dotScale, 48]} />
                <meshBasicMaterial map={texture} transparent depthWrite={false} />
            </mesh>
        </>
    );
}

/** Flat cartographic marker: crisp filled dot + thin ring, in white so it can
 *  be tinted per-civilization via the material colour. */
function makeMarkerTexture(opts: { ringOnly?: boolean } = {}) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2;
    const cy = size / 2;

    if (!opts.ringOnly) {
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.17, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.4, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = opts.ringOnly ? 3 : 2;
    ctx.globalAlpha = opts.ringOnly ? 1 : 0.9;
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
}

interface CivMarkersProps {
    radius: number;
    civilizations: Civilization[];
    selectedCivId: string | null;
    year: number;
    onSelectCiv?: (id: string) => void;
}

function CivMarkers({ radius, civilizations, selectedCivId, year, onSelectCiv }: CivMarkersProps) {
    const baseTex = useMemo(() => makeMarkerTexture(), []);

    const baseSize = radius * 0.032;
    const faceNormal = (pos: THREE.Vector3) =>
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize());

    return (
        <>
            {civilizations.map((civ) => {
                const intensity = civilizationIntensity(civ, year);
                // Hide the marker for the selected civilization (and inactive ones).
                if (intensity <= 0.02 || civ.id === selectedCivId) return null;
                // Center the marker horizontally on the country (centroid
                // longitude), but keep the civ's own latitude vertically.
                const centroid = countryCentroid(civ.lat, civ.lon);
                const pos = centroid
                    ? latLonToVec3(civ.lat, centroid[0], radius)
                    : latLonToVec3(civ.lat, civ.lon, radius);
                const size = baseSize;
                return (
                    <mesh
                        key={civ.id}
                        position={pos}
                        quaternion={faceNormal(pos)}
                        renderOrder={2}
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelectCiv?.(civ.id);
                        }}
                        onPointerOver={(e) => {
                            e.stopPropagation();
                            document.body.style.cursor = 'pointer';
                        }}
                        onPointerOut={() => {
                            document.body.style.cursor = '';
                        }}
                    >
                        <planeGeometry args={[size * 2, size * 2]} />
                        <meshBasicMaterial
                            map={baseTex}
                            color="#000000"
                            transparent
                            depthWrite={false}
                            depthTest={false}
                            opacity={0.45 + 0.55 * intensity}
                        />
                    </mesh>
                );
            })}
        </>
    );
}

interface CameraControllerProps {
    controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
    target: THREE.Vector3 | null;
    idleTimerRef: React.MutableRefObject<number | null>;
    groundMode: boolean;
}

function CameraController({ controlsRef, target, idleTimerRef, groundMode }: CameraControllerProps) {
    const { camera } = useThree();
    const targetRef = useRef<THREE.Vector3 | null>(null);
    const prevGround = useRef(groundMode);
    const recentering = useRef(false);

    useEffect(() => {
        targetRef.current = target ? target.clone() : null;
        if (target && controlsRef.current) {
            // Suppress auto-rotation while flying to a location.
            recentering.current = false;
            controlsRef.current.autoRotate = false;
            if (idleTimerRef.current !== null) {
                window.clearTimeout(idleTimerRef.current);
                idleTimerRef.current = null;
            }
        }
    }, [target, controlsRef, idleTimerRef]);

    // Returning to the globe: glide the camera back onto the equatorial plane so
    // the earth re-centres vertically instead of lingering at the civilization's
    // latitude. Longitude (the horizontal heading) is preserved. Auto-rotation
    // stays suppressed until the flight settles.
    useEffect(() => {
        const wasGround = prevGround.current;
        prevGround.current = groundMode;
        if (!wasGround || groundMode || target) return;
        const p = camera.position;
        const level = new THREE.Vector3(p.x, 0, p.z);
        if (level.lengthSq() < 1e-6) level.set(0, 0, 1);
        level.normalize().multiplyScalar(CAMERA_DISTANCE);
        targetRef.current = level;
        recentering.current = true;
        if (controlsRef.current) controlsRef.current.autoRotate = false;
        if (idleTimerRef.current !== null) {
            window.clearTimeout(idleTimerRef.current);
            idleTimerRef.current = null;
        }
    }, [groundMode, target, camera, controlsRef, idleTimerRef]);

    useFrame(() => {
        const t = targetRef.current;
        if (!t) return;
        const distance = camera.position.distanceTo(t);
        if (distance < 0.002) {
            camera.position.copy(t);
            camera.lookAt(0, 0, 0);
            targetRef.current = null;
            // Once re-centred, let the globe drift again after a short beat.
            if (recentering.current) {
                recentering.current = false;
                const controls = controlsRef.current;
                if (controls) {
                    if (idleTimerRef.current !== null) {
                        window.clearTimeout(idleTimerRef.current);
                    }
                    idleTimerRef.current = window.setTimeout(() => {
                        controls.autoRotate = true;
                    }, IDLE_MS);
                }
            }
            return;
        }
        // Slerp the camera along a great-circle arc around the origin so it
        // never tunnels through the globe when flying between antipodal points.
        const from = camera.position;
        const fromLen = from.length();
        const toLen = t.length();
        const fromDir = from.clone().normalize();
        const toDir = t.clone().normalize();
        const dot = THREE.MathUtils.clamp(fromDir.dot(toDir), -1, 1);
        const angle = Math.acos(dot);
        const alpha = 0.08;

        if (angle < 1e-4) {
            // Same direction — just lerp the radius.
            const r = THREE.MathUtils.lerp(fromLen, toLen, alpha);
            from.copy(fromDir).multiplyScalar(r);
        } else {
            const sinA = Math.sin(angle);
            const targetR = THREE.MathUtils.lerp(fromLen, toLen, alpha);
            const a = Math.sin((1 - alpha) * angle) / sinA;
            const b = Math.sin(alpha * angle) / sinA;
            from.copy(fromDir).multiplyScalar(a).addScaledVector(toDir, b).normalize().multiplyScalar(targetR);
        }
        camera.lookAt(0, 0, 0);
        controlsRef.current?.update();
    });

    return null;
}

// Publishes the globe camera orientation so the background starfield can mirror it.
function SkyPublisher() {
    useFrame(({ camera }) => {
        skyOrientation.copy(camera.quaternion);
    });
    return null;
}

// In ground mode the globe becomes a full-bleed "ground": it zooms up (via the
// camera, so it stays crisp) until its dome covers the full viewport width, and
// is shifted down (via the camera's view offset — NOT a CSS transform, which
// would clip the drawing buffer) so the horizon sits around mid-screen with sky
// above for the connections. Both are derived from the live aspect ratio so it
// pins to the bottom on any screen.
const HORIZON_FRACTION = 0.8; // where the globe's limb sits, from the top

// On-screen size (CSS px) of the default centred globe box — mirrors the CSS
// `.globe-stage` size `min(90vmin, 900px)`. Used to keep the globe at the same
// apparent size whether its canvas is boxed or full-bleed.
function defaultGlobeBox() {
    return Math.min(0.9 * Math.min(window.innerWidth, window.innerHeight), 900);
}

function GroundController({
    groundMode,
    onSettled,
}: {
    groundMode: boolean;
    onSettled?: () => void;
}) {
    const { camera, size } = useThree();
    const target = useRef({ zoom: 1, offY: 0 });
    const cur = useRef({ zoom: 1, offY: 0 });
    // True while the view sits (or rests) in the default globe framing. Flipped
    // false the moment we start grounding, so returning to default fires
    // `onSettled` exactly once — used to defer the full-bleed→boxed container
    // swap until the globe has finished flying back (no mid-animation clipping).
    const settledRef = useRef(true);
    const onSettledRef = useRef(onSettled);
    onSettledRef.current = onSettled;
    // Last canvas height, so in-flight framing can be rescaled when the container
    // swaps between the centred box and full-bleed (keeps apparent size steady).
    const prevH = useRef(size.height);

    useEffect(() => {
        const cam = camera as THREE.PerspectiveCamera;
        if (groundMode) {
            settledRef.current = false;
            const w = size.width;
            const h = size.height;
            // Screen-space radius (px) of the unit sphere at zoom = 1.
            const fovY = THREE.MathUtils.degToRad(cam.fov);
            const radiusAtZoom1 = (1 / (CAMERA_DISTANCE * Math.tan(fovY / 2))) * (h / 2);

            // Smallest radius that both covers the bottom corners and keeps the
            // horizon at HORIZON_FRACTION from the top.
            const oneMinusHf = 1 - HORIZON_FRACTION;
            const rNeeded = ((w / 2) ** 2 + (oneMinusHf * h) ** 2) / (2 * oneMinusHf * h);

            target.current = {
                zoom: Math.max(1, rNeeded / radiusAtZoom1),
                // Push the globe centre from mid-canvas down to (horizon + R).
                offY: HORIZON_FRACTION * h + rNeeded - h / 2,
            };
        } else {
            // Keep the globe at the centred-box on-screen size even while the
            // container is still full-bleed during the exit outro. At zoom = 1 the
            // globe scales with canvas height, so a full-bleed canvas renders it
            // larger and it visibly pops smaller when the container snaps back to
            // the box. boxHeight / canvasHeight cancels that — it is 1 in the box
            // and < 1 full-bleed, so the apparent size matches across the swap.
            target.current = { zoom: defaultGlobeBox() / size.height, offY: 0 };
        }
    }, [groundMode, size.width, size.height, camera]);

    useFrame(() => {
        const cam = camera as THREE.PerspectiveCamera;
        const t = target.current;
        const c = cur.current;
        const w = size.width;
        const h = size.height;

        // The container swaps between the centred box and full-bleed instantly,
        // resizing the canvas. Apparent radius ∝ canvasHeight × zoom and the view
        // offset is in canvas px, so rescale the in-flight values inversely to keep
        // the globe's on-screen size and framing continuous across the swap.
        if (h !== prevH.current && prevH.current > 0) {
            c.zoom *= prevH.current / h;
            c.offY *= h / prevH.current;
        }
        prevH.current = h;

        // Rest state: cur has reached the default framing (offY 0). Fire onSettled
        // once so the container can drop its full-bleed layout with no size jump.
        if (
            t.offY === 0 &&
            c.offY === 0 &&
            Math.abs(c.zoom - t.zoom) < 1e-3 &&
            !cam.view?.enabled
        ) {
            if (!settledRef.current) {
                settledRef.current = true;
                onSettledRef.current?.();
            }
            if (cam.zoom !== c.zoom) {
                cam.zoom = c.zoom;
                cam.updateProjectionMatrix();
            }
            return;
        }

        c.zoom += (t.zoom - c.zoom) * 0.12;
        c.offY += (t.offY - c.offY) * 0.12;
        if (Math.abs(t.zoom - c.zoom) < 0.001) c.zoom = t.zoom;
        if (Math.abs(t.offY - c.offY) < 0.3) c.offY = t.offY;

        cam.zoom = c.zoom;
        if (c.offY !== 0) {
            // Negative offsetY shifts the rendered scene downward on screen.
            cam.setViewOffset(w, h, 0, -c.offY, w, h);
        } else if (cam.view?.enabled) {
            cam.clearViewOffset();
        }
        cam.updateProjectionMatrix();
    });

    return null;
}

function Scene({ civilizations, selectedCivId, onSelectCiv, year, groundMode, onGroundSettled }: GlobeProps) {
    const controlsRef = useRef<OrbitControlsImpl | null>(null);
    const idleTimer = useRef<number | null>(null);
    const selectedCiv = useMemo(() => {
        if (!selectedCivId || !civilizations) return null;
        return civilizations.find((c) => c.id === selectedCivId) ?? null;
    }, [selectedCivId, civilizations]);
    const selectedTarget = useMemo(() => {
        if (!selectedCiv) return null;
        // Look at the civilization from above: tilt the camera direction toward
        // the north pole so it rotates down into the "ground" position.
        const dir = latLonToVec3(selectedCiv.lat, selectedCiv.lon, 1).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const axis = new THREE.Vector3().crossVectors(dir, up);
        if (axis.lengthSq() > 1e-6) {
            axis.normalize();
            dir.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, SELECT_TILT));
        }
        return dir.multiplyScalar(CAMERA_DISTANCE);
    }, [selectedCiv]);

    // Every civilization active at the current year (plus the selected one) has
    // its country darkened on the globe.
    const fillCivs = useMemo(() => {
        const map = new Map<string, { id: string; lat: number; lon: number }>();
        if (civilizations) {
            for (const c of civilizations) {
                if (civilizationIntensity(c, year ?? 0) > 0.02) {
                    map.set(c.id, { id: c.id, lat: c.lat, lon: c.lon });
                }
            }
        }
        if (selectedCiv) {
            map.set(selectedCiv.id, { id: selectedCiv.id, lat: selectedCiv.lat, lon: selectedCiv.lon });
        }
        return [...map.values()];
    }, [civilizations, year, selectedCiv]);

    // Keep the latest groundMode readable inside stable event handlers.
    const groundRef = useRef(false);
    groundRef.current = !!groundMode;

    useEffect(() => {
        const controls = controlsRef.current;
        if (!controls) return;

        const onStart = () => {
            if (idleTimer.current !== null) {
                window.clearTimeout(idleTimer.current);
                idleTimer.current = null;
            }
            controls.autoRotate = false;
        };

        const onEnd = () => {
            if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
            // While a civilization is selected the globe stays locked — never
            // resume auto-rotation.
            if (groundRef.current) return;
            idleTimer.current = window.setTimeout(() => {
                controls.autoRotate = true;
            }, IDLE_MS);
        };

        controls.addEventListener('start', onStart);
        controls.addEventListener('end', onEnd);
        return () => {
            controls.removeEventListener('start', onStart);
            controls.removeEventListener('end', onEnd);
            if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
        };
    }, []);

    // Selecting a civilization locks the globe: stop auto-rotation and disable
    // user rotation. Deselecting restores free rotation + idle auto-rotate.
    useEffect(() => {
        const controls = controlsRef.current;
        if (!controls) return;
        if (groundMode) {
            if (idleTimer.current !== null) {
                window.clearTimeout(idleTimer.current);
                idleTimer.current = null;
            }
            controls.autoRotate = false;
            controls.enableRotate = false;
        } else {
            controls.enableRotate = true;
            // Auto-rotation resumes once CameraController finishes gliding the
            // globe back to its centred, level framing (see recenter flight).
        }
    }, [groundMode]);

    return (
        <>
            <SkyPublisher />

            {/* Solid sphere matching the paper background. Hides back-side lines. */}
            <mesh>
                <sphereGeometry args={[RADIUS * 0.998, 64, 64]} />
                <meshBasicMaterial color="#e8e6dc" />
            </mesh>

            <Graticule radius={RADIUS} />
            <Equator radius={RADIUS * 1.0005} />
            <CountryFill radius={RADIUS * 1.0008} civs={fillCivs} />
            <CountryLines radius={RADIUS * 1.001} />
            <PoleDots radius={RADIUS * 1.002} />

            <GlobeOutline radius={RADIUS} />
            <GlobeOutline radius={RADIUS * 1.06} color="#919191" />

            {civilizations && (
                <CivMarkers
                    radius={RADIUS * 1.02}
                    civilizations={civilizations}
                    selectedCivId={selectedCivId ?? null}
                    year={year ?? 0}
                    onSelectCiv={onSelectCiv}
                />
            )}

            <CameraController
                controlsRef={controlsRef}
                target={selectedTarget}
                idleTimerRef={idleTimer}
                groundMode={groundMode ?? false}
            />

            <GroundController groundMode={groundMode ?? false} onSettled={onGroundSettled} />

            <OrbitControls
                ref={controlsRef}
                enableZoom={false}
                enablePan={false}
                rotateSpeed={0.5}
                autoRotate
                autoRotateSpeed={0.35}
                minPolarAngle={0}
                maxPolarAngle={Math.PI}
            />
        </>
    );
}

export default function Globe({ civilizations, selectedCivId, onSelectCiv, year, groundMode, onGroundSettled }: GlobeProps) {
    return (
        <Canvas
            camera={{ position: [0, 0, 3.6], fov: 38 }}
            gl={{ antialias: true, alpha: true }}
            dpr={[1, 2]}
            flat
        >
            <Scene
                civilizations={civilizations}
                selectedCivId={selectedCivId}
                onSelectCiv={onSelectCiv}
                year={year}
                groundMode={groundMode}
                onGroundSettled={onGroundSettled}
            />
        </Canvas>
    );
}
