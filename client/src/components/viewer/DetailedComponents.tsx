/**
 * Compound geometry for the 5 most prominent engine room components.
 * Each replaces a simple box/cylinder with a multi-part group.
 */
import type { MeshStandardMaterialParameters } from "three";
import { rawSteel, darkRubber, glassMaterial, insulationWrap, paintedSteel } from "./materials";

interface DetailProps {
  baseMat: MeshStandardMaterialParameters;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/** Main Engine — multi-cylinder diesel with crankcase, heads, flywheel, manifold. */
export function DetailedMainEngine({ baseMat, castShadow = true, receiveShadow = true }: DetailProps) {
  const cs = castShadow;
  const rs = receiveShadow;
  const cylCount = 6;
  const cylSpacing = 0.38;
  const crankcaseW = cylCount * cylSpacing + 0.4;

  return (
    <group>
      {/* Crankcase / engine block */}
      <mesh position={[0, 0, 0]} castShadow={cs} receiveShadow={rs}>
        <boxGeometry args={[crankcaseW, 1.4, 1.2]} />
        <meshStandardMaterial {...baseMat} />
      </mesh>

      {/* Cylinder heads row */}
      {Array.from({ length: cylCount }, (_, i) => {
        const x = -crankcaseW / 2 + 0.4 + i * cylSpacing;
        return (
          <mesh key={`head-${i}`} position={[x, 0.85, 0]} castShadow={cs}>
            <boxGeometry args={[0.28, 0.3, 1.0]} />
            <meshStandardMaterial {...baseMat} />
          </mesh>
        );
      })}

      {/* Exhaust manifold (top, running along heads) */}
      <mesh position={[0, 1.15, 0]} castShadow={cs} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, crankcaseW - 0.3, 12]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>

      {/* Exhaust runner stubs */}
      {Array.from({ length: cylCount }, (_, i) => {
        const x = -crankcaseW / 2 + 0.4 + i * cylSpacing;
        return (
          <mesh key={`runner-${i}`} position={[x, 1.05, 0]} castShadow={cs}>
            <cylinderGeometry args={[0.04, 0.04, 0.15, 8]} />
            <meshStandardMaterial {...rawSteel()} />
          </mesh>
        );
      })}

      {/* Flywheel (aft end) */}
      <mesh position={[crankcaseW / 2 + 0.12, 0, 0]} castShadow={cs} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.55, 0.12, 24]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>

      {/* Oil pan */}
      <mesh position={[0, -0.85, 0]} castShadow={cs} receiveShadow={rs}>
        <boxGeometry args={[crankcaseW - 0.2, 0.15, 1.3]} />
        <meshStandardMaterial {...paintedSteel("#2a2a2a")} />
      </mesh>

      {/* Foundation bolts (4 corners) */}
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={`bolt-${i}`} position={[sx * (crankcaseW / 2 - 0.15), -0.7, sz * 0.5]} castShadow={cs}>
          <cylinderGeometry args={[0.03, 0.03, 0.4, 6]} />
          <meshStandardMaterial {...rawSteel()} />
        </mesh>
      ))}

      {/* Turbocharger housing (attached to manifold end) */}
      <group position={[-crankcaseW / 2 - 0.15, 1.15, 0]}>
        {/* Compressor scroll */}
        <mesh castShadow={cs}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshStandardMaterial {...rawSteel()} />
        </mesh>
        {/* Inlet */}
        <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow={cs}>
          <cylinderGeometry args={[0.08, 0.1, 0.15, 10]} />
          <meshStandardMaterial {...rawSteel()} />
        </mesh>
      </group>

      {/* Engine bed / mounting rails */}
      <mesh position={[0, -0.98, 0.5]} receiveShadow={rs} castShadow={cs}>
        <boxGeometry args={[crankcaseW + 0.5, 0.08, 0.15]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>
      <mesh position={[0, -0.98, -0.5]} receiveShadow={rs} castShadow={cs}>
        <boxGeometry args={[crankcaseW + 0.5, 0.08, 0.15]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>
    </group>
  );
}

/** Emergency Generator — gen-set with alternator, control panel, exhaust. */
export function DetailedGenerator({ baseMat, castShadow = true, receiveShadow = true }: DetailProps) {
  const cs = castShadow;
  const rs = receiveShadow;

  return (
    <group>
      {/* Engine block */}
      <mesh position={[0, 0, 0]} castShadow={cs} receiveShadow={rs}>
        <boxGeometry args={[0.7, 0.7, 0.55]} />
        <meshStandardMaterial {...baseMat} />
      </mesh>

      {/* Alternator */}
      <mesh position={[0.55, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow={cs}>
        <cylinderGeometry args={[0.28, 0.28, 0.35, 16]} />
        <meshStandardMaterial {...paintedSteel("#2a5aa0")} />
      </mesh>

      {/* Control panel */}
      <mesh position={[0, 0.15, 0.35]} castShadow={cs}>
        <boxGeometry args={[0.5, 0.3, 0.04]} />
        <meshStandardMaterial {...paintedSteel("#333")} />
      </mesh>

      {/* Indicator lights on panel */}
      {[-0.12, 0, 0.12].map((x, i) => (
        <mesh key={i} position={[x, 0.2, 0.375]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial
            color={["#00ff00", "#ffaa00", "#ff0000"][i]}
            emissive={["#00ff00", "#ffaa00", "#ff0000"][i]}
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}

      {/* Exhaust outlet */}
      <mesh position={[0, 0.5, 0]} castShadow={cs}>
        <cylinderGeometry args={[0.06, 0.06, 0.3, 10]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>

      {/* Base/skid */}
      <mesh position={[0.15, -0.42, 0]} receiveShadow={rs}>
        <boxGeometry args={[1.2, 0.08, 0.7]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>

      {/* Cooling fan guard */}
      <mesh position={[-0.42, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow={cs}>
        <torusGeometry args={[0.2, 0.015, 6, 16]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>
    </group>
  );
}

/** Main Switchboard — electrical panel with circuit breakers. */
export function DetailedSwitchboard({ baseMat, castShadow = true, receiveShadow = true }: DetailProps) {
  const cs = castShadow;
  const rs = receiveShadow;
  const panelCount = 4;
  const panelW = 0.45;
  const totalW = panelCount * panelW + 0.1;

  return (
    <group>
      {/* Cabinet body */}
      <mesh position={[0, 0, 0]} castShadow={cs} receiveShadow={rs}>
        <boxGeometry args={[0.25, 1.8, totalW]} />
        <meshStandardMaterial {...baseMat} />
      </mesh>

      {/* Individual panel sections */}
      {Array.from({ length: panelCount }, (_, i) => {
        const z = -totalW / 2 + panelW / 2 + 0.05 + i * panelW;
        return (
          <group key={i}>
            {/* Panel face */}
            <mesh position={[0.135, 0, z]} castShadow={cs}>
              <boxGeometry args={[0.02, 1.6, panelW - 0.04]} />
              <meshStandardMaterial {...paintedSteel("#383838")} />
            </mesh>
            {/* Breaker handles */}
            {Array.from({ length: 5 }, (_, j) => (
              <mesh key={j} position={[0.16, 0.5 - j * 0.25, z]}>
                <boxGeometry args={[0.03, 0.06, 0.08]} />
                <meshStandardMaterial {...paintedSteel("#222")} />
              </mesh>
            ))}
            {/* Status indicator */}
            <mesh position={[0.16, 0.75, z]}>
              <sphereGeometry args={[0.015, 6, 6]} />
              <meshStandardMaterial
                color="#00cc44"
                emissive="#00cc44"
                emissiveIntensity={1.2}
              />
            </mesh>
          </group>
        );
      })}

      {/* Cable tray above */}
      <mesh position={[0, 1.1, 0]} castShadow={cs}>
        <boxGeometry args={[0.15, 0.06, totalW + 0.4]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>

      {/* Cable tray below */}
      <mesh position={[0, -0.85, 0]}>
        <boxGeometry args={[0.15, 0.06, totalW + 0.4]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>

      {/* Warning label */}
      <mesh position={[0.14, 0.9, 0]}>
        <boxGeometry args={[0.005, 0.08, 0.25]} />
        <meshStandardMaterial color="#ffcc00" emissive="#ffcc00" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

/** Fuel Oil Tank with manhole, sight glass, and pipe stubs. */
export function DetailedFuelTank({ baseMat, castShadow = true, receiveShadow = true }: DetailProps) {
  const cs = castShadow;
  const rs = receiveShadow;

  return (
    <group>
      {/* Tank body */}
      <mesh position={[0, 0, 0]} castShadow={cs} receiveShadow={rs}>
        <boxGeometry args={[1.3, 0.85, 0.85]} />
        <meshStandardMaterial {...baseMat} />
      </mesh>

      {/* Manhole cover (top) */}
      <mesh position={[0, 0.47, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow={cs}>
        <cylinderGeometry args={[0.15, 0.15, 0.04, 16]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>
      {/* Manhole rim */}
      <mesh position={[0, 0.44, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.15, 0.02, 8, 16]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>

      {/* Sight glass (side) */}
      <mesh position={[0, 0, 0.44]} rotation={[Math.PI / 2, 0, 0]} castShadow={cs}>
        <cylinderGeometry args={[0.06, 0.06, 0.04, 12]} />
        <meshStandardMaterial {...glassMaterial()} />
      </mesh>

      {/* Level gauge */}
      <mesh position={[0.3, 0, 0.44]} castShadow={cs}>
        <boxGeometry args={[0.03, 0.6, 0.02]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>
      {/* Gauge glass */}
      <mesh position={[0.3, 0, 0.455]}>
        <boxGeometry args={[0.02, 0.55, 0.005]} />
        <meshStandardMaterial {...glassMaterial()} />
      </mesh>

      {/* Inlet pipe stub (top) */}
      <mesh position={[-0.4, 0.35, 0]} castShadow={cs}>
        <cylinderGeometry args={[0.04, 0.04, 0.2, 8]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>
      {/* Outlet pipe stub (bottom) */}
      <mesh position={[0.4, -0.35, 0]} rotation={[0, 0, Math.PI / 2]} castShadow={cs}>
        <cylinderGeometry args={[0.04, 0.04, 0.15, 8]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>

      {/* Tank legs */}
      {[[-0.5, -0.3], [-0.5, 0.3], [0.5, -0.3], [0.5, 0.3]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, -0.55, lz]} castShadow={cs}>
          <boxGeometry args={[0.06, 0.25, 0.06]} />
          <meshStandardMaterial {...rawSteel()} />
        </mesh>
      ))}
    </group>
  );
}

/** Exhaust Trunk with flanged sections, insulation, and silencer. */
export function DetailedExhaustTrunk({ baseMat, castShadow = true, receiveShadow = true }: DetailProps) {
  const cs = castShadow;
  const rs = receiveShadow;
  const insul = insulationWrap();

  return (
    <group>
      {/* Lower trunk section */}
      <mesh position={[0, -0.4, 0]} castShadow={cs} receiveShadow={rs}>
        <cylinderGeometry args={[0.22, 0.22, 1.2, 16]} />
        <meshStandardMaterial {...baseMat} />
      </mesh>

      {/* Flange ring (lower) */}
      <mesh position={[0, 0.2, 0]}>
        <torusGeometry args={[0.22, 0.025, 8, 16]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>

      {/* Upper trunk section with insulation */}
      <mesh position={[0, 0.8, 0]} castShadow={cs}>
        <cylinderGeometry args={[0.25, 0.25, 0.8, 16]} />
        <meshStandardMaterial {...insul} />
      </mesh>

      {/* Flange ring (upper) */}
      <mesh position={[0, 1.2, 0]}>
        <torusGeometry args={[0.25, 0.025, 8, 16]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>

      {/* Expansion joint bellows */}
      <mesh position={[0, 0.2, 0]} castShadow={cs}>
        <cylinderGeometry args={[0.28, 0.28, 0.1, 16]} />
        <meshStandardMaterial {...darkRubber()} />
      </mesh>

      {/* Flange bolts (decorative) */}
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const r = 0.22;
        return (
          <mesh key={i} position={[Math.cos(angle) * r, 0.2, Math.sin(angle) * r]}>
            <sphereGeometry args={[0.015, 6, 6]} />
            <meshStandardMaterial {...rawSteel()} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Silencer — expanded section at top of exhaust. */
export function DetailedSilencer({ baseMat, castShadow = true, receiveShadow = true }: DetailProps) {
  const cs = castShadow;
  const rs = receiveShadow;
  const insul = insulationWrap();

  return (
    <group>
      {/* Inlet transition */}
      <mesh position={[0, -0.3, 0]} castShadow={cs} receiveShadow={rs}>
        <cylinderGeometry args={[0.22, 0.3, 0.2, 16]} />
        <meshStandardMaterial {...baseMat} />
      </mesh>
      {/* Main silencer body */}
      <mesh position={[0, 0.1, 0]} castShadow={cs}>
        <cylinderGeometry args={[0.3, 0.3, 0.6, 16]} />
        <meshStandardMaterial {...insul} />
      </mesh>
      {/* Outlet transition */}
      <mesh position={[0, 0.5, 0]} castShadow={cs}>
        <cylinderGeometry args={[0.3, 0.18, 0.2, 16]} />
        <meshStandardMaterial {...baseMat} />
      </mesh>
      {/* Support bracket */}
      <mesh position={[0.35, 0, 0]} castShadow={cs}>
        <boxGeometry args={[0.04, 0.5, 0.04]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>
    </group>
  );
}

/** Turbocharger — compressor scroll + turbine housing. */
export function DetailedTurbocharger({ baseMat, castShadow = true, receiveShadow = true }: DetailProps) {
  const cs = castShadow;
  const rs = receiveShadow;

  return (
    <group>
      {/* Center bearing housing */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow={cs} receiveShadow={rs}>
        <cylinderGeometry args={[0.12, 0.12, 0.3, 16]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>

      {/* Compressor volute (cold side) */}
      <mesh position={[-0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow={cs}>
        <cylinderGeometry args={[0.18, 0.12, 0.12, 16]} />
        <meshStandardMaterial {...baseMat} />
      </mesh>

      {/* Turbine volute (hot side) */}
      <mesh position={[0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow={cs}>
        <cylinderGeometry args={[0.18, 0.12, 0.12, 16]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>

      {/* Air inlet pipe */}
      <mesh position={[-0.22, 0.15, 0.12]} rotation={[Math.PI / 4, 0, 0]} castShadow={cs}>
        <cylinderGeometry args={[0.06, 0.06, 0.15, 10]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>

      {/* Exhaust outlet pipe */}
      <mesh position={[0.22, 0.15, -0.12]} rotation={[-Math.PI / 4, 0, 0]} castShadow={cs}>
        <cylinderGeometry args={[0.06, 0.06, 0.15, 10]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>
    </group>
  );
}

/** Generic pump — motor + impeller housing + flanged connections. */
export function DetailedPump({ baseMat, castShadow = true, receiveShadow = true }: DetailProps) {
  const cs = castShadow;
  const rs = receiveShadow;

  return (
    <group>
      {/* Motor body */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow={cs} receiveShadow={rs}>
        <cylinderGeometry args={[0.13, 0.13, 0.3, 12]} />
        <meshStandardMaterial {...baseMat} />
      </mesh>

      {/* Impeller housing (volute) */}
      <mesh position={[0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow={cs}>
        <cylinderGeometry args={[0.16, 0.13, 0.08, 12]} />
        <meshStandardMaterial {...baseMat} />
      </mesh>

      {/* Inlet flange */}
      <mesh position={[0.22, 0, 0.18]} rotation={[Math.PI / 2, 0, 0]} castShadow={cs}>
        <cylinderGeometry args={[0.06, 0.06, 0.08, 8]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>

      {/* Outlet flange (top) */}
      <mesh position={[0.22, 0.16, 0]} castShadow={cs}>
        <cylinderGeometry args={[0.05, 0.05, 0.06, 8]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>

      {/* Base plate */}
      <mesh position={[0.1, -0.16, 0]} receiveShadow={rs}>
        <boxGeometry args={[0.45, 0.03, 0.25]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>

      {/* Coupling guard */}
      <mesh position={[0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.1, 0.01, 6, 12]} />
        <meshStandardMaterial {...rawSteel()} />
      </mesh>
    </group>
  );
}
