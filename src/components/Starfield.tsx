import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { skyOrientation } from './skyOrientation';
import Meteors from './Meteors';

// Equirectangular star map. Drop any image into src/assets/space/ and it is
// picked up automatically.
const spaceTextures = import.meta.glob<string>(
    '../assets/space/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}',
    { eager: true, import: 'default', query: '?url' },
);
const spaceTextureUrl = Object.values(spaceTextures)[0] as string | undefined;

// Mirrors the globe camera's orientation so the sky stays locked to the earth.
function SkyCamera() {
    const { camera } = useThree();
    useFrame(() => {
        camera.quaternion.copy(skyOrientation);
    });
    return null;
}

// Equirectangular star map wrapped onto the inside of a large sphere. Fades in
// gently once the texture has finished loading.
function SkyDome({ url }: { url: string }) {
    const texture = useLoader(THREE.TextureLoader, url);
    const matRef = useRef<THREE.MeshBasicMaterial>(null);
    useMemo(() => {
        texture.colorSpace = THREE.SRGBColorSpace;
    }, [texture]);
    useFrame((_, delta) => {
        const mat = matRef.current;
        if (!mat || mat.opacity >= 1) return;

        mat.opacity = Math.min(1, mat.opacity + delta / 5);
    });
    return (
        <mesh frustumCulled={false}>
            <sphereGeometry args={[100, 60, 40]} />
            <meshBasicMaterial
                ref={matRef}
                map={texture}
                side={THREE.BackSide}
                depthWrite={false}
                transparent
                opacity={0}
            />
        </mesh>
    );
}

/** Full-viewport starfield whose camera mirrors the globe, so the stars move
 *  only when the earth moves. */
export default function Starfield() {
    return (
        <div className="starfield" aria-hidden="true">
            <Canvas
                camera={{ position: [0, 0, 0], fov: 75, near: 0.1, far: 200 }}
                gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
                dpr={1}
            >
                <SkyCamera />
                {spaceTextureUrl && (
                    <Suspense fallback={null}>
                        <SkyDome url={spaceTextureUrl} />
                    </Suspense>
                )}
                <Meteors />
            </Canvas>
        </div>
    );
}
