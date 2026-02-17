import { useState } from "react";
import { Html } from "@react-three/drei";
import { useStore } from "../../store";
import { useSystems } from "../../api/components";
import { SYSTEM_MATERIALS } from "./materials";
import { LAYOUT, DETAILED_MAP, displayName } from "./componentRegistry";
import type { LayoutEntry } from "./componentRegistry";
import { GltfModel, DetailedGeometry, SimpleGeometry } from "./ComponentModel";
import type { MeshStandardMaterialParameters } from "three";

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

  // Get system data and base material
  const systemData = systems?.data.find((s) => s.name === entry.system);
  const baseMat = SYSTEM_MATERIALS[entry.system] || SYSTEM_MATERIALS.Propulsion;

  // Filter by selected system
  if (
    selectedSystem !== null &&
    systemData &&
    systemData.id !== selectedSystem
  ) {
    return null;
  }

  // Compute visual state overrides
  const matOverrides: Partial<MeshStandardMaterialParameters> = {};
  if (isSelected) {
    matOverrides.emissive = baseMat.color as string;
    matOverrides.emissiveIntensity = 0.5;
  } else if (isHighlighted) {
    matOverrides.emissive = "#ffcc00";
    matOverrides.emissiveIntensity = 0.4;
  } else if (hovered) {
    matOverrides.emissiveIntensity = 0.15;
    matOverrides.emissive = baseMat.color as string;
  }

  const effectiveMat = { ...baseMat, ...matOverrides };
  const scale: [number, number, number] = isSelected
    ? [1.03, 1.03, 1.03]
    : [1, 1, 1];

  const detailedType = entry.detailed || DETAILED_MAP[name];

  return (
    <group position={entry.position}>
      <group
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
        {entry.model ? (
          <GltfModel
            path={entry.model}
            targetSize={entry.size}
            targetHeight={entry.modelHeight}
            rotation={entry.modelRotation}
          />
        ) : detailedType ? (
          <DetailedGeometry type={detailedType} baseMat={effectiveMat} />
        ) : (
          <SimpleGeometry entry={entry} baseMat={effectiveMat} />
        )}
      </group>
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
  return (
    <Html position={[0, entry.size[1] / 2 + 0.3, 0]} center>
      <div className="bg-card/90 backdrop-blur px-2 py-1 rounded shadow-lg text-xs whitespace-nowrap pointer-events-none border border-border">
        <p className="font-medium text-foreground">{displayName(name)}</p>
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
