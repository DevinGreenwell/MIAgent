import type { MeshStandardMaterialParameters } from "three";

/** PBR material presets for realistic engine room surfaces. */

export function paintedSteel(
  color: string,
): MeshStandardMaterialParameters {
  return {
    color,
    metalness: 0.6,
    roughness: 0.4,
  };
}

export function rawSteel(): MeshStandardMaterialParameters {
  return {
    color: "#8a8a8a",
    metalness: 0.85,
    roughness: 0.25,
  };
}

export function copper(): MeshStandardMaterialParameters {
  return {
    color: "#b87333",
    metalness: 0.9,
    roughness: 0.2,
  };
}

export function darkRubber(): MeshStandardMaterialParameters {
  return {
    color: "#1a1a1a",
    metalness: 0,
    roughness: 0.9,
  };
}

export function deckPlate(): MeshStandardMaterialParameters {
  return {
    color: "#4a4a4a",
    metalness: 0.7,
    roughness: 0.5,
  };
}

export function hullSteel(): MeshStandardMaterialParameters {
  return {
    color: "#3a3a3e",
    metalness: 0.75,
    roughness: 0.35,
  };
}

export function glassMaterial(): MeshStandardMaterialParameters {
  return {
    color: "#aaddff",
    metalness: 0.1,
    roughness: 0.05,
    transparent: true,
    opacity: 0.3,
  };
}

export function insulationWrap(): MeshStandardMaterialParameters {
  return {
    color: "#c0c0b0",
    metalness: 0,
    roughness: 0.95,
  };
}

/** Map system names to their PBR material preset. */
export const SYSTEM_MATERIALS: Record<
  string,
  MeshStandardMaterialParameters
> = {
  Propulsion: paintedSteel("#3a6ea5"),
  "Fuel Oil": paintedSteel("#c4872f"),
  Bilge: paintedSteel("#4a8a3a"),
  Electrical: paintedSteel("#c44040"),
  Exhaust: rawSteel(),
  "Cooling Water": paintedSteel("#3080c0"),
  "Starting Air": paintedSteel("#c4872f"),
  "Fire Safety": paintedSteel("#cc3333"),
};
