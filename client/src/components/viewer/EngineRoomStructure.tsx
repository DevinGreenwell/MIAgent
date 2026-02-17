import { useMemo } from "react";
import * as THREE from "three";
import { deckPlate, hullSteel, rawSteel } from "./materials";

/** Dimensions of the engine room enclosure. */
const ROOM = {
  width: 14, // port-stbd (z axis)
  length: 16, // fwd-aft (x axis)
  height: 7, // keel to overhead
  wallThickness: 0.12,
  deckY: -0.7, // deck level
  frameSpacing: 2.5,
  frameWidth: 0.1,
  frameFlange: 0.3,
  frameDepth: 0.35,
};

const CATWALK = {
  y: 2.2,
  width: 1.2,
  railHeight: 1,
  railThickness: 0.04,
  grateThickness: 0.04,
};

function DeckFloor() {
  const mat = deckPlate();
  return (
    <mesh
      position={[0, ROOM.deckY - 0.1, 0]}
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[ROOM.length, ROOM.width]} />
      <meshStandardMaterial {...mat} side={THREE.DoubleSide} />
    </mesh>
  );
}

function HullWalls() {
  const mat = { ...hullSteel(), transparent: true, opacity: 0.35, side: THREE.DoubleSide };
  const halfL = ROOM.length / 2;
  const halfW = ROOM.width / 2;
  const h = ROOM.height;
  const cy = ROOM.deckY + h / 2;

  return (
    <group>
      {/* Port wall */}
      <mesh position={[0, cy, halfW]} receiveShadow>
        <planeGeometry args={[ROOM.length, h]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* Starboard wall */}
      <mesh position={[0, cy, -halfW]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[ROOM.length, h]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* Forward bulkhead */}
      <mesh position={[halfL, cy, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM.width, h]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* Aft bulkhead */}
      <mesh position={[-halfL, cy, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM.width, h]} />
        <meshStandardMaterial {...mat} />
      </mesh>
    </group>
  );
}

function Overhead() {
  const mat = { ...hullSteel(), transparent: true, opacity: 0.15, side: THREE.DoubleSide };
  return (
    <mesh position={[0, ROOM.deckY + ROOM.height, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[ROOM.length, ROOM.width]} />
      <meshStandardMaterial {...mat} />
    </mesh>
  );
}

function StructuralFrames() {
  const mat = rawSteel();
  const frames: JSX.Element[] = [];
  const halfW = ROOM.width / 2;
  const startX = -ROOM.length / 2 + ROOM.frameSpacing;
  const endX = ROOM.length / 2;

  for (let x = startX; x < endX; x += ROOM.frameSpacing) {
    // Port side vertical frame
    frames.push(
      <group key={`frame-p-${x}`} position={[x, ROOM.deckY, halfW - 0.06]}>
        {/* Web (vertical part) */}
        <mesh position={[0, ROOM.height / 2, 0]} castShadow>
          <boxGeometry args={[ROOM.frameWidth, ROOM.height, ROOM.frameDepth]} />
          <meshStandardMaterial {...mat} />
        </mesh>
        {/* Flange (horizontal cap) */}
        <mesh position={[0, ROOM.height / 2, -ROOM.frameDepth / 2]} castShadow>
          <boxGeometry args={[ROOM.frameFlange, ROOM.height, ROOM.frameWidth]} />
          <meshStandardMaterial {...mat} />
        </mesh>
      </group>,
    );
    // Starboard side vertical frame
    frames.push(
      <group key={`frame-s-${x}`} position={[x, ROOM.deckY, -halfW + 0.06]}>
        <mesh position={[0, ROOM.height / 2, 0]} castShadow>
          <boxGeometry args={[ROOM.frameWidth, ROOM.height, ROOM.frameDepth]} />
          <meshStandardMaterial {...mat} />
        </mesh>
        <mesh position={[0, ROOM.height / 2, ROOM.frameDepth / 2]} castShadow>
          <boxGeometry args={[ROOM.frameFlange, ROOM.height, ROOM.frameWidth]} />
          <meshStandardMaterial {...mat} />
        </mesh>
      </group>,
    );
  }
  return <group>{frames}</group>;
}

function Catwalk({ side }: { side: "port" | "stbd" }) {
  const mat = rawSteel();
  const z = side === "port" ? ROOM.width / 2 - CATWALK.width / 2 - 0.5 : -(ROOM.width / 2 - CATWALK.width / 2 - 0.5);

  // Grate geometry — a thin box representing the walkway platform
  const grateGeo = useMemo(() => {
    const geo = new THREE.BoxGeometry(ROOM.length - 2, CATWALK.grateThickness, CATWALK.width);
    return geo;
  }, []);

  return (
    <group position={[0, CATWALK.y, z]}>
      {/* Walkway platform */}
      <mesh geometry={grateGeo} castShadow receiveShadow>
        <meshStandardMaterial {...mat} transparent opacity={0.6} />
      </mesh>
      {/* Inner railing */}
      <mesh position={[0, CATWALK.railHeight / 2, side === "port" ? -CATWALK.width / 2 : CATWALK.width / 2]}>
        <boxGeometry args={[ROOM.length - 2, CATWALK.railThickness, CATWALK.railThickness]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* Railing posts */}
      {Array.from({ length: 8 }, (_, i) => {
        const x = -ROOM.length / 2 + 2 + i * ((ROOM.length - 4) / 7);
        return (
          <mesh key={i} position={[x, CATWALK.railHeight / 2, side === "port" ? -CATWALK.width / 2 : CATWALK.width / 2]}>
            <boxGeometry args={[CATWALK.railThickness, CATWALK.railHeight, CATWALK.railThickness]} />
            <meshStandardMaterial {...mat} />
          </mesh>
        );
      })}
    </group>
  );
}

function LightFixtures() {
  const fixturePositions: [number, number, number][] = [
    [-4, ROOM.deckY + ROOM.height - 0.3, 0],
    [0, ROOM.deckY + ROOM.height - 0.3, 0],
    [4, ROOM.deckY + ROOM.height - 0.3, 0],
    [-4, ROOM.deckY + ROOM.height - 0.3, 3],
    [0, ROOM.deckY + ROOM.height - 0.3, 3],
    [4, ROOM.deckY + ROOM.height - 0.3, 3],
    [-4, ROOM.deckY + ROOM.height - 0.3, -3],
    [0, ROOM.deckY + ROOM.height - 0.3, -3],
    [4, ROOM.deckY + ROOM.height - 0.3, -3],
  ];

  return (
    <group>
      {fixturePositions.map((pos, i) => (
        <group key={i} position={pos}>
          {/* Fixture housing */}
          <mesh>
            <boxGeometry args={[0.8, 0.06, 0.15]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#ffe8c0"
              emissiveIntensity={2}
              toneMapped={false}
            />
          </mesh>
          {/* Point light from fixture */}
          <pointLight
            color="#ffe8c0"
            intensity={0.8}
            distance={8}
            decay={2}
            position={[0, -0.1, 0]}
          />
        </group>
      ))}
    </group>
  );
}

export default function EngineRoomStructure() {
  return (
    <group>
      <DeckFloor />
      <HullWalls />
      <Overhead />
      <StructuralFrames />
      <Catwalk side="port" />
      <Catwalk side="stbd" />
      <LightFixtures />
    </group>
  );
}
