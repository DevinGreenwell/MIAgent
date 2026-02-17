import { useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

export interface GltfPart {
  name: string;
  depth: number;
  meshCount: number;
  object: THREE.Object3D;
}

/** Names to skip — generic/auto-generated names from modeling tools. */
const SKIP_NAMES = new Set([
  "group",
  "scene",
  "root",
  "active",
  "default",
  "layer0",
  "sketchup_camera",
  "sketchup camera",
]);

function isGenericName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (!lower || SKIP_NAMES.has(lower)) return true;
  // Skip names that are just numbers or "group_N" / "mesh_N" patterns
  if (/^(group|mesh|object|node)_?\d*$/i.test(lower)) return true;
  // Skip numeric/symbolic labels: "123", "1_61", "*1", "*1_2", etc.
  if (/^[*\d_]+$/.test(lower)) return true;
  // Skip "Default_*" names from SketchUp
  if (/^default/i.test(lower)) return true;
  return false;
}

function countMeshes(obj: THREE.Object3D): number {
  let count = 0;
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) count++;
  });
  return count;
}

/**
 * Clone a scene deeply, including cloning materials so we can
 * modify them without polluting the useGLTF cache.
 */
function cloneScene(source: THREE.Object3D): THREE.Object3D {
  const cloned = source.clone(true);
  cloned.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((m) => m.clone());
      } else if (mesh.material) {
        mesh.material = mesh.material.clone();
      }
    }
  });
  return cloned;
}

/**
 * Traverse the scene graph to discover named groups/meshes.
 * Collects nodes that have meaningful names and contain mesh descendants.
 */
function discoverParts(root: THREE.Object3D): GltfPart[] {
  const parts: GltfPart[] = [];
  const seen = new Map<string, number>();

  function walk(node: THREE.Object3D, depth: number) {
    if (node.name && !isGenericName(node.name)) {
      const meshes = countMeshes(node);
      if (meshes > 0) {
        // Track name occurrences for dedup display
        const count = (seen.get(node.name) || 0) + 1;
        seen.set(node.name, count);

        parts.push({
          name: node.name,
          depth,
          meshCount: meshes,
          object: node,
        });
      }
    }

    for (const child of node.children) {
      walk(child, depth + 1);
    }
  }

  for (const child of root.children) {
    walk(child, 0);
  }

  return parts;
}

/**
 * Hook that loads a GLTF model, clones it, discovers named parts,
 * and computes fit scale/offset for rendering.
 */
export function useGltfParts(
  path: string,
  targetSize: [number, number, number],
  targetHeight?: number,
) {
  const { scene } = useGLTF(path);

  const result = useMemo(() => {
    const clonedScene = cloneScene(scene);

    // Compute bounding box for fit
    const box = new THREE.Box3().setFromObject(clonedScene);
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

    const centerOffset: [number, number, number] = [
      -center.x * s,
      -box.min.y * s,
      -center.z * s,
    ];

    const parts = discoverParts(clonedScene);

    return { clonedScene, parts, fitScale: s, centerOffset };
  }, [scene, targetSize, targetHeight]);

  return result;
}
