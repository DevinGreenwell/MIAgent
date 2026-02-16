import { useStore } from "../../store";
import { useSystems } from "../../api/components";

export default function ViewerControls() {
  const { selectedSystem, setSelectedSystem } = useStore();
  const { data: systems } = useSystems();

  return (
    <div className="bg-card/90 backdrop-blur rounded-lg shadow-lg p-2 border border-border">
      <select
        value={selectedSystem ?? ""}
        onChange={(e) =>
          setSelectedSystem(e.target.value ? Number(e.target.value) : null)
        }
        className="w-full px-2 py-1 text-xs border border-border rounded bg-input text-foreground"
      >
        <option value="">All Systems</option>
        {(systems?.data || []).map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
