import { useMemo, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { ThreeEvent } from "@react-three/fiber";
import type { MeshStandardMaterialParameters } from "three";
import { LAYOUT, DETAILED_MAP } from "./componentRegistry";
import type { LayoutEntry } from "./componentRegistry";
import { SYSTEM_MATERIALS } from "./materials";
import { useGltfParts } from "./useGltfParts";
import { useStore } from "../../store";
import {
  DetailedMainEngine,
  DetailedGenerator,
  DetailedSwitchboard,
  DetailedFuelTank,
  DetailedExhaustTrunk,
  DetailedSilencer,
  DetailedTurbocharger,
  DetailedPump,
} from "./DetailedComponents";

/** Shared dim material for non-selected meshes. */
const DIM_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#888888",
  transparent: true,
  opacity: 0.08,
  depthWrite: false,
});

/** Names to skip when walking up to find a named ancestor. */
const SKIP_ANCESTORS = new Set(["scene", "root", "group"]);

function isGenericName(name: string): boolean {
  if (!name) return true;
  const lower = name.toLowerCase().trim();
  if (SKIP_ANCESTORS.has(lower)) return true;
  if (/^(group|mesh|object|node)_?\d*$/i.test(lower)) return true;
  // Skip numeric/symbolic labels: "123", "1_61", "*1", "*1_2", etc.
  if (/^[*\d_]+$/.test(lower)) return true;
  if (/^default/i.test(lower)) return true;
  return false;
}

/**
 * Walk up from a clicked mesh to find the nearest named ancestor group.
 */
function findNamedAncestor(obj: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = obj;
  while (current) {
    if (current.name && !isGenericName(current.name)) {
      return current.name;
    }
    current = current.parent;
  }
  return null;
}

/**
 * Render a GLTF model with sub-component selection support.
 * Clones the scene, discovers named parts, and dims non-selected meshes.
 */
function GltfModelWithParts({
  path,
  targetSize,
  targetHeight,
  rotation,
  selectedPart,
}: {
  path: string;
  targetSize: [number, number, number];
  targetHeight?: number;
  rotation?: [number, number, number];
  selectedPart?: string | null;
}) {
  const { clonedScene, parts, fitScale, centerOffset } = useGltfParts(
    path,
    targetSize,
    targetHeight,
  );
  const originalMaterials = useRef<Map<THREE.Mesh, THREE.Material | THREE.Material[]>>(new Map());
  const setSelectedSubComponent = useStore((s) => s.setSelectedSubComponent);

  // Store original materials on first render
  useEffect(() => {
    const map = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          map.set(mesh, mesh.material.map((m) => m));
        } else {
          map.set(mesh, mesh.material);
        }
      }
    });
    originalMaterials.current = map;
  }, [clonedScene]);

  // Apply highlighting when selectedPart changes
  useEffect(() => {
    if (!selectedPart) {
      // Restore all original materials
      originalMaterials.current.forEach((mat, mesh) => {
        mesh.material = mat as THREE.Material;
      });
      return;
    }

    // Find the selected node
    const selectedNode = parts.find((p) => p.name === selectedPart)?.object;
    if (!selectedNode) return;

    // Collect meshes that belong to the selected node
    const selectedMeshes = new Set<THREE.Mesh>();
    selectedNode.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        selectedMeshes.add(child as THREE.Mesh);
      }
    });

    // Apply dim/highlight materials
    originalMaterials.current.forEach((originalMat, mesh) => {
      if (selectedMeshes.has(mesh)) {
        // Restore original material for selected meshes
        mesh.material = originalMat as THREE.Material;
      } else {
        // Dim non-selected meshes
        mesh.material = DIM_MATERIAL;
      }
    });
  }, [selectedPart, parts, clonedScene]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const clickedObj = e.object;
      const name = findNamedAncestor(clickedObj);
      if (name) {
        // Toggle: if already selected, deselect
        setSelectedSubComponent(
          name === selectedPart ? null : name,
        );
      }
    },
    [selectedPart, setSelectedSubComponent],
  );

  return (
    <group position={centerOffset} rotation={rotation}>
      <group scale={[fitScale, fitScale, fitScale]}>
        <primitive object={clonedScene} onClick={handleClick} />
      </group>
    </group>
  );
}

/**
 * Render a GLTF model without sub-component support (used in orbit view).
 */
export function GltfModel({
  path,
  targetSize,
  targetHeight,
  rotation,
}: {
  path: string;
  targetSize: [number, number, number];
  targetHeight?: number;
  rotation?: [number, number, number];
}) {
  const { scene } = useGLTF(path);

  const { fitScale, centerOffset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    let s: number;
    if (targetHeight != null) {
      s = targetHeight / size.y;
    } else {
      const sx = targetSize[0] / size.x;
      const sy = targetSize[1] / size.y;
      const sz = targetSize[2] / size.z;
      s = Math.min(sx, sy, sz);
    }

    const off: [number, number, number] = [
      -center.x * s,
      -box.min.y * s,
      -center.z * s,
    ];

    return { fitScale: s, centerOffset: off };
  }, [scene, targetSize, targetHeight]);

  return (
    <group position={centerOffset} rotation={rotation}>
      <group scale={[fitScale, fitScale, fitScale]}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

/** Render the detailed compound geometry for a component. */
export function DetailedGeometry({
  type,
  baseMat,
}: {
  type: string;
  baseMat: MeshStandardMaterialParameters;
}) {
  const props = { baseMat };
  switch (type) {
    case "mainEngine":
      return <DetailedMainEngine {...props} />;
    case "generator":
      return <DetailedGenerator {...props} />;
    case "switchboard":
      return <DetailedSwitchboard {...props} />;
    case "fuelTank":
      return <DetailedFuelTank {...props} />;
    case "exhaustTrunk":
      return <DetailedExhaustTrunk {...props} />;
    case "silencer":
      return <DetailedSilencer {...props} />;
    case "turbocharger":
      return <DetailedTurbocharger {...props} />;
    case "pump":
      return <DetailedPump {...props} />;
    default:
      return null;
  }
}

/** Simple geometry fallback for components without detailed models. */
export function SimpleGeometry({
  entry,
  baseMat,
}: {
  entry: LayoutEntry;
  baseMat: MeshStandardMaterialParameters;
}) {
  return (
    <mesh castShadow receiveShadow>
      {entry.shape === "cylinder" ? (
        <cylinderGeometry
          args={[entry.size[0] / 2, entry.size[0] / 2, entry.size[1], 16]}
        />
      ) : (
        <boxGeometry args={entry.size} />
      )}
      <meshStandardMaterial {...baseMat} />
    </mesh>
  );
}

/**
 * Renders a single component centered at origin.
 * Looks up the LAYOUT entry and renders the correct model type
 * (GLTF with part selection, detailed compound geometry, or simple geometry fallback).
 */
export default function ComponentModel({
  meshName,
  selectedPart,
}: {
  meshName: string;
  selectedPart?: string | null;
}) {
  const entry = LAYOUT[meshName];
  if (!entry) return null;

  const baseMat = SYSTEM_MATERIALS[entry.system] || SYSTEM_MATERIALS.Propulsion;
  const detailedType = entry.detailed || DETAILED_MAP[meshName];

  if (entry.model) {
    return (
      <GltfModelWithParts
        path={entry.model}
        targetSize={entry.size}
        targetHeight={entry.modelHeight}
        rotation={entry.modelRotation}
        selectedPart={selectedPart}
      />
    );
  }

  if (detailedType) {
    return <DetailedGeometry type={detailedType} baseMat={baseMat} />;
  }

  return <SimpleGeometry entry={entry} baseMat={baseMat} />;
}
