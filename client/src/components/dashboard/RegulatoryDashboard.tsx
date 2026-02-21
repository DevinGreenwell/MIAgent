import { useStore } from "../../store";
import { useComponent } from "../../api/components";
import InspectionChecklist from "./InspectionChecklist";
import CfrReferenceCard from "./CfrReferenceCard";
import DeficiencyList from "./DeficiencyList";

export default function RegulatoryDashboard() {
  const selectedComponent = useStore((s) => s.selectedComponent);
  const setSelectedComponent = useStore((s) => s.setSelectedComponent);
  const { data, isLoading } = useComponent(selectedComponent);

  if (!selectedComponent) return null;
  if (isLoading)
    return <div className="p-4 text-muted-foreground">Loading component data...</div>;

  const comp = data?.data;
  if (!comp) return <div className="p-4 text-muted-foreground">Component not found.</div>;

  return (
    <div className="p-4 space-y-6 overflow-auto">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: comp.system_color }}
            />
            <span className="text-xs font-medium text-muted-foreground uppercase">
              {comp.system_name}
            </span>
          </div>
          <h2 className="text-xl font-bold text-foreground mt-1">
            {comp.display_name}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{comp.description}</p>
        </div>
        <button
          onClick={() => setSelectedComponent(null)}
          className="text-muted-foreground hover:text-foreground text-xl"
        >
          ×
        </button>
      </div>

      {comp.inspection_notes && (
        <InspectionChecklist notes={comp.inspection_notes} />
      )}

      {comp.documents.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Regulatory References
          </h3>
          <div className="space-y-2">
            {comp.documents.map((doc) => (
              <CfrReferenceCard key={doc.id} document={doc} />
            ))}
          </div>
        </div>
      )}

      {comp.deficiencies.length > 0 && (
        <DeficiencyList deficiencies={comp.deficiencies} />
      )}
    </div>
  );
}
