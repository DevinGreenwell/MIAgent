import { useStore } from "../../store";
import { useSystems } from "../../api/components";

export default function SystemLegend() {
  const { selectedSystem, setSelectedSystem } = useStore();
  const { data: systems } = useSystems();

  if (!systems?.data) return null;

  return (
    <div className="p-4">
      <p className="text-sm font-semibold text-foreground mb-2">Systems</p>
      <div className="space-y-0.5">
        {systems.data.map((s) => (
          <button
            key={s.id}
            onClick={() =>
              setSelectedSystem(selectedSystem === s.id ? null : s.id)
            }
            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-accent ${
              selectedSystem === s.id ? "bg-accent font-medium text-foreground" : "text-muted-foreground"
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span>{s.name}</span>
            <span className="text-muted-foreground ml-auto text-xs">{s.component_count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
