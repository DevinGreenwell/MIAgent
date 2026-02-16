import { useState } from "react";
import { Html } from "@react-three/drei";
import { useStore } from "../../store";
import { useSystems } from "../../api/components";

interface LayoutEntry {
  position: [number, number, number];
  size: [number, number, number];
  shape: "box" | "cylinder";
  system: string;
}

const LAYOUT: Record<string, LayoutEntry> = {
  "main-engine": {
    position: [0, 1, 0],
    size: [3, 2, 1.5],
    shape: "box",
    system: "Propulsion",
  },
  "reduction-gear": {
    position: [2.5, 0.5, 0],
    size: [1, 1, 1],
    shape: "box",
    system: "Propulsion",
  },
  "propeller-shaft": {
    position: [4, 0.3, 0],
    size: [2, 0.2, 0.2],
    shape: "cylinder",
    system: "Propulsion",
  },
  "thrust-bearing": {
    position: [3.5, 0.3, 0],
    size: [0.5, 0.5, 0.5],
    shape: "cylinder",
    system: "Propulsion",
  },
  "engine-bed": {
    position: [0, -0.2, 0],
    size: [4, 0.3, 2],
    shape: "box",
    system: "Propulsion",
  },

  "fuel-oil-tank-port": {
    position: [-3, 0.5, 2],
    size: [1.5, 1, 1],
    shape: "box",
    system: "Fuel Oil",
  },
  "fuel-oil-tank-stbd": {
    position: [-3, 0.5, -2],
    size: [1.5, 1, 1],
    shape: "box",
    system: "Fuel Oil",
  },
  "fuel-oil-service-pump": {
    position: [-1.5, 0.3, 2],
    size: [0.4, 0.6, 0.4],
    shape: "cylinder",
    system: "Fuel Oil",
  },
  "fuel-oil-purifier": {
    position: [-1.5, 0.5, 1],
    size: [0.5, 0.8, 0.5],
    shape: "cylinder",
    system: "Fuel Oil",
  },
  "fuel-oil-heater": {
    position: [-1.5, 0.3, -1],
    size: [0.4, 0.5, 0.4],
    shape: "box",
    system: "Fuel Oil",
  },

  "bilge-pump-main": {
    position: [2, 0.2, 2.5],
    size: [0.5, 0.4, 0.5],
    shape: "cylinder",
    system: "Bilge",
  },
  "bilge-pump-emergency": {
    position: [2, 0.2, -2.5],
    size: [0.5, 0.4, 0.5],
    shape: "cylinder",
    system: "Bilge",
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
    position: [-4, 1, 0],
    size: [0.3, 2, 2],
    shape: "box",
    system: "Electrical",
  },
  "emergency-generator": {
    position: [-4, 0.5, -3],
    size: [1, 1, 0.8],
    shape: "box",
    system: "Electrical",
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
  },
  turbocharger: {
    position: [0, 2.2, 0.5],
    size: [0.5, 0.5, 0.5],
    shape: "cylinder",
    system: "Exhaust",
  },
  "exhaust-silencer": {
    position: [0, 4.5, 0],
    size: [0.6, 0.8, 0.6],
    shape: "cylinder",
    system: "Exhaust",
  },

  "sw-cooling-pump": {
    position: [3, 0.2, -2],
    size: [0.4, 0.4, 0.4],
    shape: "cylinder",
    system: "Cooling Water",
  },
  "fw-cooling-pump": {
    position: [3, 0.2, -1.2],
    size: [0.4, 0.4, 0.4],
    shape: "cylinder",
    system: "Cooling Water",
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
  },
  "air-compressor-2": {
    position: [-2.5, 0.5, -3.2],
    size: [0.6, 0.8, 0.5],
    shape: "box",
    system: "Starting Air",
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
  },
};

const SYSTEM_COLORS: Record<string, string> = {
  Propulsion: "#4a90d9",
  "Fuel Oil": "#e6a23c",
  Bilge: "#67c23a",
  Electrical: "#f56c6c",
  Exhaust: "#909399",
  "Cooling Water": "#409eff",
  "Starting Air": "#e6a23c",
  "Fire Safety": "#f56c6c",
};

function ComponentMesh({
  name,
  entry,
}: {
  name: string;
  entry: LayoutEntry;
}) {
  const {
    selectedComponent,
    setSelectedComponent,
    highlightedComponents,
    selectedSystem,
  } = useStore();
  const { data: systems } = useSystems();
  const [hovered, setHovered] = useState(false);

  const isSelected = selectedComponent === name;
  const isHighlighted = highlightedComponents.includes(name);

  // Get system color
  const systemData = systems?.data.find((s) => s.name === entry.system);
  const baseColor = systemData?.color || SYSTEM_COLORS[entry.system] || "#999";

  // Filter by selected system
  if (
    selectedSystem !== null &&
    systemData &&
    systemData.id !== selectedSystem
  ) {
    return null;
  }

  const color = isSelected ? "#ffffff" : isHighlighted ? "#ffcc00" : baseColor;
  const opacity = isSelected ? 1 : hovered ? 0.9 : 0.7;
  const scale: [number, number, number] = isSelected ? [1.05, 1.05, 1.05] : [1, 1, 1];

  return (
    <group position={entry.position}>
      <mesh
        scale={scale}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedComponent(isSelected ? null : name);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "default";
        }}
      >
        {entry.shape === "cylinder" ? (
          <cylinderGeometry
            args={[entry.size[0] / 2, entry.size[0] / 2, entry.size[1], 16]}
          />
        ) : (
          <boxGeometry args={entry.size} />
        )}
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          emissive={isSelected ? baseColor : "#000"}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>
      {(isSelected || hovered) && (
        <ComponentLabel name={name} entry={entry} />
      )}
    </group>
  );
}

function ComponentLabel({
  name,
  entry,
}: {
  name: string;
  entry: LayoutEntry;
}) {
  const displayName = name
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Html position={[0, entry.size[1] / 2 + 0.3, 0]} center>
      <div className="bg-card/90 backdrop-blur px-2 py-1 rounded shadow-lg text-xs whitespace-nowrap pointer-events-none border border-border">
        <p className="font-medium text-foreground">{displayName}</p>
        <p className="text-muted-foreground">{entry.system}</p>
      </div>
    </Html>
  );
}

export default function SchematicEngineRoom() {
  return (
    <group>
      {Object.entries(LAYOUT).map(([name, entry]) => (
        <ComponentMesh key={name} name={name} entry={entry} />
      ))}
    </group>
  );
}
