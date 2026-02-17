import { useState, useEffect } from "react";
import { useStore } from "../../store";
import { useSystems, useComponents } from "../../api/components";
import { LAYOUT, displayName } from "./componentRegistry";

/** Expandable system node with its child components. */
function SystemNode({ system }: { system: { id: number; name: string; color: string; component_count: number } }) {
  const { selectedComponent, setSelectedComponent, selectedSystem, setSelectedSystem } = useStore();
  const { data: components } = useComponents(system.id);
  const [expanded, setExpanded] = useState(false);

  // Auto-expand when selected component belongs to this system
  useEffect(() => {
    if (selectedComponent && LAYOUT[selectedComponent]?.system === system.name) {
      setExpanded(true);
    }
  }, [selectedComponent, system.name]);

  const meshNames = components?.data
    ?.map((c) => c.mesh_name)
    .filter((m) => m in LAYOUT) ?? [];

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent/50 transition-colors ${
          selectedSystem === system.id ? "bg-accent/30 font-medium text-foreground" : "text-muted-foreground"
        }`}
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: system.color }}
        />
        <span className="flex-1 text-left">{system.name}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{system.component_count}</span>
        <svg
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {expanded && (
        <div className="ml-5 border-l border-border">
          {meshNames.map((meshName) => {
            const isSelected = selectedComponent === meshName;
            return (
              <button
                key={meshName}
                onClick={() => {
                  setSelectedComponent(isSelected ? null : meshName);
                  setSelectedSystem(isSelected ? null : system.id);
                }}
                className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${
                  isSelected
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                {displayName(meshName)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SystemTree() {
  const { data: systems } = useSystems();

  if (!systems?.data) return null;

  return (
    <div className="py-2">
      <p className="text-sm font-semibold text-foreground px-3 pb-2">Systems</p>
      <div>
        {systems.data.map((s) => (
          <SystemNode key={s.id} system={s} />
        ))}
      </div>
    </div>
  );
}
