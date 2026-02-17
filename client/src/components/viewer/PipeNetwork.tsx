/**
 * Pipe runs connecting engine room systems.
 * Uses TubeGeometry with CatmullRomCurve3 for smooth pipe paths.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { copper, rawSteel, paintedSteel } from "./materials";
import type { MeshStandardMaterialParameters } from "three";

interface PipeRun {
  points: [number, number, number][];
  radius: number;
  material: MeshStandardMaterialParameters;
  flanges?: boolean;
}

function Pipe({ points, radius, material, flanges = true }: PipeRun) {
  const { tubeGeo, flangePositions } = useMemo(() => {
    const vecs = points.map((p) => new THREE.Vector3(...p));
    const curve = new THREE.CatmullRomCurve3(vecs, false, "catmullrom", 0.3);
    const geo = new THREE.TubeGeometry(curve, Math.max(8, points.length * 6), radius, 8, false);
    const positions = flanges
      ? [vecs[0], vecs[vecs.length - 1]]
      : [];
    return { tubeGeo: geo, flangePositions: positions };
  }, [points, radius, flanges]);

  return (
    <group>
      <mesh geometry={tubeGeo} castShadow>
        <meshStandardMaterial {...material} />
      </mesh>
      {flangePositions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <torusGeometry args={[radius * 1.8, radius * 0.5, 6, 12]} />
          <meshStandardMaterial {...rawSteel()} />
        </mesh>
      ))}
    </group>
  );
}

/** All pipe runs organized by system. */
export default function PipeNetwork() {
  const fuelMat = copper();
  const exhaustMat = rawSteel();
  const coolingMat = paintedSteel("#3080c0");
  const bilgeMat = paintedSteel("#4a8a3a");
  const airMat = paintedSteel("#c4872f");

  const r = 0.035; // standard pipe radius

  return (
    <group>
      {/* ── Fuel Oil System ── */}
      {/* Port tank → service pump */}
      <Pipe
        points={[[-2.2, 0.5, 2], [-1.8, 0.3, 2], [-1.5, 0.3, 2]]}
        radius={r}
        material={fuelMat}
      />
      {/* Service pump → purifier */}
      <Pipe
        points={[[-1.5, 0.3, 2], [-1.5, 0.4, 2], [-1.5, 0.5, 2]]}
        radius={r}
        material={fuelMat}
      />
      {/* Purifier → engine */}
      <Pipe
        points={[[-1.5, 0.5, 2], [-1.2, 0.6, 1.6], [-0.8, 0.7, 1.3], [-0.3, 0.8, 0]]}
        radius={r}
        material={fuelMat}
      />
      {/* Heater → engine */}
      <Pipe
        points={[[-1.5, 0.3, -2], [-1.0, 0.5, -1.6], [-0.5, 0.7, -1.3], [-0.3, 0.8, 0]]}
        radius={r}
        material={fuelMat}
      />

      {/* ── Exhaust System ── */}
      {/* Engine top → turbocharger → trunk → silencer */}
      <Pipe
        points={[
          [0, 1.3, 0],
          [0, 1.5, 0.3],
          [0, 1.8, 0.5],
        ]}
        radius={0.08}
        material={exhaustMat}
        flanges={false}
      />
      <Pipe
        points={[
          [0, 1.8, 0.5],
          [0, 2.4, 0.3],
          [0, 3, 0],
        ]}
        radius={0.1}
        material={exhaustMat}
        flanges={false}
      />
      <Pipe
        points={[
          [0, 3, 0],
          [0, 3.8, 0],
          [0, 4.5, 0],
        ]}
        radius={0.12}
        material={exhaustMat}
        flanges={false}
      />

      {/* ── Cooling Water System ── */}
      {/* SW pump → heat exchanger */}
      <Pipe
        points={[[3, 0.2, -2], [3.2, 0.25, -1.8], [3.5, 0.3, -1.6]]}
        radius={r}
        material={coolingMat}
      />
      {/* FW pump → heat exchanger */}
      <Pipe
        points={[[3, 0.2, -1.2], [3.2, 0.25, -1.4], [3.5, 0.3, -1.6]]}
        radius={r}
        material={coolingMat}
      />
      {/* Heat exchanger → expansion tank */}
      <Pipe
        points={[[3.5, 0.5, -1.6], [3.5, 0.8, -1.6], [3.5, 1.2, -1.6]]}
        radius={0.025}
        material={coolingMat}
      />
      {/* Heat exchanger → engine */}
      <Pipe
        points={[[3.5, 0.3, -1.6], [2.8, 0.4, -1.4], [2.0, 0.6, -1.3], [0.5, 0.8, -1.2]]}
        radius={r}
        material={coolingMat}
      />

      {/* ── Bilge System ── */}
      {/* Port well → main pump */}
      <Pipe
        points={[[0, -0.5, 3], [0.5, -0.3, 2.8], [1.5, 0, 2.6], [2, 0.2, 2.5]]}
        radius={0.03}
        material={bilgeMat}
      />
      {/* Stbd well → emergency pump */}
      <Pipe
        points={[[0, -0.5, -3], [0.5, -0.3, -2.8], [1.5, 0, -2.6], [2, 0.2, -2.5]]}
        radius={0.03}
        material={bilgeMat}
      />
      {/* Main pump → OWS */}
      <Pipe
        points={[[2, 0.2, 2.5], [2.5, 0.25, 2.5], [3, 0.3, 2.5]]}
        radius={0.03}
        material={bilgeMat}
      />

      {/* ── Starting Air System ── */}
      {/* Compressor 1 → air receiver */}
      <Pipe
        points={[[-2.5, 0.5, -2.5], [-2.3, 0.5, -2.7], [-2, 0.5, -2.8]]}
        radius={0.03}
        material={airMat}
      />
      {/* Compressor 2 → air receiver */}
      <Pipe
        points={[[-2.5, 0.5, -3.2], [-2.3, 0.5, -3.0], [-2, 0.5, -2.8]]}
        radius={0.03}
        material={airMat}
      />
      {/* Air receiver → engine */}
      <Pipe
        points={[[-2, 0.5, -2.8], [-1.5, 0.6, -2.2], [-1, 0.7, -1.5], [-0.3, 0.8, -1.2]]}
        radius={r}
        material={airMat}
      />
    </group>
  );
}
