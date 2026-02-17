import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, Grid } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useStore } from "../../store";
import { LAYOUT } from "./componentRegistry";
import { useGltfParts } from "./useGltfParts";
import ComponentModel from "./ComponentModel";

/**
 * Helper component rendered only for GLTF models. Uses useGltfParts
 * to compute a sub-component orbit target and updates controls.
 */
function SubComponentTargetUpdater({
  model,
  targetSize,
  targetHeight,
  selectedPart,
  controlsRef,
  defaultTarget,
}: {
  model: string;
  targetSize: [number, number, number];
  targetHeight?: number;
  selectedPart: string | null;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  defaultTarget: THREE.Vector3;
}) {
  const { parts, fitScale, centerOffset } = useGltfParts(model, targetSize, targetHeight);

  const subTarget = useMemo(() => {
    if (!selectedPart) return null;

    const part = parts.find((p) => p.name === selectedPart);
    if (!part) return null;

    const box = new THREE.Box3().setFromObject(part.object);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const [ox, oy, oz] = centerOffset;
    return new THREE.Vector3(
      center.x * fitScale + ox,
      center.y * fitScale + oy,
      center.z * fitScale + oz,
    );
  }, [selectedPart, parts, fitScale, centerOffset]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const target = subTarget ?? defaultTarget;
    controls.target.copy(target);
    controls.update();
  }, [subTarget, defaultTarget, controlsRef]);

  return null;
}

function InspectScene({ meshName }: { meshName: string }) {
  const entry = LAYOUT[meshName];
  const selectedSubComponent = useStore((s) => s.selectedSubComponent);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const cameraDistance = useMemo(() => {
    if (!entry) return 4;
    const maxDim = Math.max(...entry.size);
    return maxDim * 2.5 + 1;
  }, [entry]);

  const defaultTarget = useMemo(
    () => new THREE.Vector3(0, (entry?.size[1] ?? 1) / 2, 0),
    [entry],
  );

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 4]} intensity={1} castShadow />
      <directionalLight position={[-3, 4, -2]} intensity={0.4} />

      <ComponentModel meshName={meshName} selectedPart={selectedSubComponent} />

      {entry?.model && (
        <SubComponentTargetUpdater
          model={entry.model}
          targetSize={entry.size}
          targetHeight={entry.modelHeight}
          selectedPart={selectedSubComponent}
          controlsRef={controlsRef}
          defaultTarget={defaultTarget}
        />
      )}

      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.4}
        scale={10}
        blur={2}
        far={4}
      />

      <Grid
        position={[0, -0.01, 0]}
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#444"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#666"
        fadeDistance={15}
        infiniteGrid
      />

      <OrbitControls
        ref={controlsRef}
        enablePan
        maxDistance={cameraDistance * 2}
        minDistance={cameraDistance * 0.3}
        target={defaultTarget}
        maxPolarAngle={Math.PI * 0.85}
      />

      <Environment preset="studio" background={false} />
    </>
  );
}

export default function InspectViewer() {
  const { selectedComponent, selectedSubComponent } = useStore();

  return (
    <div className="relative h-full">
      {selectedComponent ? (
        <>
          <Canvas
            camera={{ position: [4, 3, 4], fov: 45 }}
            shadows
            gl={{ antialias: true }}
          >
            <InspectScene meshName={selectedComponent} />
          </Canvas>
          {selectedSubComponent && (
            <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-medium shadow-lg pointer-events-none">
              {selectedSubComponent.replace(/_/g, " ")}
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <p className="text-sm">Select a component to inspect</p>
          </div>
        </div>
      )}
    </div>
  );
}
