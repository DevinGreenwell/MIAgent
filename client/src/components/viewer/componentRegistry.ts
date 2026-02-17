export interface LayoutEntry {
  position: [number, number, number];
  /** Dimensions [x, y, z]. For GLTF models, used as the target bounding box to fit into. */
  size: [number, number, number];
  shape: "box" | "cylinder";
  system: string;
  /** Optional path to a .glb model in /public/models/ */
  model?: string;
  /** Euler rotation for GLTF model [x, y, z] in radians */
  modelRotation?: [number, number, number];
  /** Override target height (meters) for GLTF model — scales uniformly by Y only */
  modelHeight?: number;
  /** Key into DETAILED_RENDERERS for compound geometry */
  detailed?: string;
}

/**
 * Map of component names to detailed renderer keys.
 * Components listed here get compound geometry instead of simple primitives.
 */
export const DETAILED_MAP: Record<string, string> = {
  "main-engine": "mainEngine",
  "emergency-generator": "generator",
  "main-switchboard": "switchboard",
  "fuel-oil-tank-port": "fuelTank",
  "exhaust-trunk": "exhaustTrunk",
  "exhaust-silencer": "silencer",
  turbocharger: "turbocharger",
  "fuel-oil-service-pump": "pump",
  "fuel-oil-purifier": "pump",
  "bilge-pump-main": "pump",
  "bilge-pump-emergency": "pump",
  "sw-cooling-pump": "pump",
  "fw-cooling-pump": "pump",
  "fire-pump": "pump",
  "air-compressor-1": "pump",
  "air-compressor-2": "pump",
};

export const LAYOUT: Record<string, LayoutEntry> = {
  "main-engine": {
    position: [0, 0, 0],
    size: [5, 1.8, 2.5],
    shape: "box",
    system: "Propulsion",
    model: "/models/3Dmodel_dieselEngine.glb",
  },
  "reduction-gear": {
    position: [3.2, 0.5, 0],
    size: [1, 1, 1],
    shape: "box",
    system: "Propulsion",
    model: "/models/3Dmodel_reductionGear.glb",
  },
  "propeller-shaft": {
    position: [5, 0.3, 0],
    size: [2, 0.2, 0.2],
    shape: "cylinder",
    system: "Propulsion",
  },
  "thrust-bearing": {
    position: [4.2, 0.3, 0],
    size: [0.5, 0.5, 0.5],
    shape: "cylinder",
    system: "Propulsion",
  },
  "engine-bed": {
    position: [0, -0.2, 0],
    size: [5.5, 0.3, 3],
    shape: "box",
    system: "Propulsion",
  },

  "fuel-oil-tank-port": {
    position: [-3, 0.5, 2],
    size: [1.5, 1, 1],
    shape: "box",
    system: "Fuel Oil",
    detailed: "fuelTank",
  },
  "fuel-oil-service-pump": {
    position: [-1.5, 0.3, 2],
    size: [0.4, 0.6, 0.4],
    shape: "cylinder",
    system: "Fuel Oil",
    detailed: "pump",
  },
  "fuel-oil-purifier": {
    position: [-1.5, 0.5, 2],
    size: [0.5, 0.8, 0.5],
    shape: "cylinder",
    system: "Fuel Oil",
    detailed: "pump",
  },
  "fuel-oil-heater": {
    position: [-1.5, 0.3, -2],
    size: [0.4, 0.5, 0.4],
    shape: "box",
    system: "Fuel Oil",
  },

  "bilge-pump-main": {
    position: [2, 0.2, 2.5],
    size: [0.5, 0.4, 0.5],
    shape: "cylinder",
    system: "Bilge",
    detailed: "pump",
  },
  "bilge-pump-emergency": {
    position: [2, 0.2, -2.5],
    size: [0.5, 0.4, 0.5],
    shape: "cylinder",
    system: "Bilge",
    detailed: "pump",
  },
  "bilge-well-port": {
    position: [0, -0.5, 3],
    size: [0.6, 0.3, 0.6],
    shape: "box",
    system: "Bilge",
  },
  "bilge-well-stbd": {
    position: [0, -0.5, -3],
    size: [0.6, 0.3, 0.6],
    shape: "box",
    system: "Bilge",
  },
  "oily-water-separator": {
    position: [3, 0.3, 2.5],
    size: [0.6, 0.7, 0.4],
    shape: "cylinder",
    system: "Bilge",
  },

  "main-switchboard": {
    position: [5, 0, -3],
    size: [2, 2, 0.5],
    shape: "box",
    system: "Electrical",
    model: "/models/3Dmodel_electricalPanel.glb",
    modelHeight: 2,
    modelRotation: [0, Math.PI / 2, 0],
  },
  "emergency-generator": {
    position: [-4.5, 0, -3],
    size: [2, 1.6, 1.3],
    shape: "box",
    system: "Electrical",
    model: "/models/3Dmodel_generator.glb",
    modelHeight: 1.56,
    modelRotation: [0, Math.PI, 0],
  },
  "shore-connection": {
    position: [-4.5, 0.5, 2],
    size: [0.3, 0.5, 0.3],
    shape: "box",
    system: "Electrical",
  },
  "battery-bank": {
    position: [-4.5, 0.3, 1],
    size: [0.5, 0.3, 0.5],
    shape: "box",
    system: "Electrical",
  },

  "exhaust-trunk": {
    position: [0, 3, 0],
    size: [0.5, 2, 0.5],
    shape: "cylinder",
    system: "Exhaust",
    detailed: "exhaustTrunk",
  },
  turbocharger: {
    position: [0, 1.8, 0.5],
    size: [0.5, 0.5, 0.5],
    shape: "cylinder",
    system: "Exhaust",
    detailed: "turbocharger",
  },
  "exhaust-silencer": {
    position: [0, 4.5, 0],
    size: [0.6, 0.8, 0.6],
    shape: "cylinder",
    system: "Exhaust",
    detailed: "silencer",
  },

  "sw-cooling-pump": {
    position: [3, 0.2, -2],
    size: [0.4, 0.4, 0.4],
    shape: "cylinder",
    system: "Cooling Water",
    detailed: "pump",
  },
  "fw-cooling-pump": {
    position: [3, 0.2, -1.2],
    size: [0.4, 0.4, 0.4],
    shape: "cylinder",
    system: "Cooling Water",
    detailed: "pump",
  },
  "heat-exchanger": {
    position: [3.5, 0.3, -1.6],
    size: [0.8, 0.4, 0.5],
    shape: "box",
    system: "Cooling Water",
  },
  "expansion-tank": {
    position: [3.5, 1.5, -1.6],
    size: [0.3, 0.4, 0.3],
    shape: "cylinder",
    system: "Cooling Water",
  },

  "air-compressor-1": {
    position: [-2.5, 0.5, -2.5],
    size: [0.6, 0.8, 0.5],
    shape: "box",
    system: "Starting Air",
    detailed: "pump",
  },
  "air-compressor-2": {
    position: [-2.5, 0.5, -3.2],
    size: [0.6, 0.8, 0.5],
    shape: "box",
    system: "Starting Air",
    detailed: "pump",
  },
  "air-receiver": {
    position: [-2, 0.5, -2.8],
    size: [0.4, 1, 0.4],
    shape: "cylinder",
    system: "Starting Air",
  },

  "co2-bank": {
    position: [-4, 0.5, 3],
    size: [0.8, 1.2, 0.4],
    shape: "box",
    system: "Fire Safety",
  },
  "fire-pump": {
    position: [4, 0.2, 2],
    size: [0.5, 0.4, 0.4],
    shape: "cylinder",
    system: "Fire Safety",
    detailed: "pump",
  },
};

/** Convert a mesh name like "fuel-oil-tank-port" to "Fuel Oil Tank Port". */
export function displayName(meshName: string): string {
  return meshName
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
