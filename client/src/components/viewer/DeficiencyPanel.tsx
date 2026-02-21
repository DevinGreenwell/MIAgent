import { useStore } from "../../store";
import { useComponent, useSystems } from "../../api/components";
import { useQuery } from "@tanstack/react-query";
import type { ApiResponse } from "../../types/api";
import type { ComponentDeficiency } from "../../types/components";

interface SystemDeficiency extends ComponentDeficiency {
  component_name: string;
  mesh_name: string;
}

const BASE = "/api/v1";

async function fetchAllDeficiencies(system?: number): Promise<ApiResponse<SystemDeficiency[]>> {
  const qs = system ? `?system=${system}` : "";
  const res = await fetch(`${BASE}/deficiencies${qs}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const SEVERITY_STYLES: Record<string, { bg: string; label: string }> = {
  critical: { bg: "bg-red-600", label: "CRITICAL" },
  serious: { bg: "bg-orange-500", label: "SERIOUS" },
  moderate: { bg: "bg-yellow-500", label: "MODERATE" },
  minor: { bg: "bg-muted-foreground", label: "MINOR" },
};

function SeverityBadge({ severity }: { severity: string }) {
  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.minor;
  return (
    <span className={`${style.bg} text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0`}>
      {style.label}
    </span>
  );
}

function DeficiencyCard({
  d,
  showComponent,
  onComponentClick,
}: {
  d: SystemDeficiency | ComponentDeficiency;
  showComponent?: boolean;
  onComponentClick?: (mesh: string) => void;
}) {
  const meshName = "mesh_name" in d ? d.mesh_name : undefined;
  const componentName = "component_name" in d ? d.component_name : undefined;

  return (
    <div className="border border-border rounded-md p-2.5 space-y-1.5">
      <div className="flex items-start gap-2">
        <SeverityBadge severity={d.severity} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-tight">{d.title}</p>
          {showComponent && componentName && meshName && onComponentClick && (
            <button
              onClick={() => onComponentClick(meshName)}
              className="text-xs text-primary hover:underline mt-0.5"
            >
              {componentName}
            </button>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono shrink-0">{d.code}</span>
      </div>
      {d.description && (
        <p className="text-xs text-muted-foreground leading-relaxed">{d.description}</p>
      )}
      {d.cfr_reference && (
        <p className="text-[10px] text-muted-foreground">
          <span className="font-medium">Ref:</span> {d.cfr_reference}
        </p>
      )}
      {d.remediation && (
        <p className="text-[10px] text-foreground/80">
          <span className="font-medium">Action:</span> {d.remediation}
        </p>
      )}
    </div>
  );
}

/** Shows deficiencies for a selected component. */
function ComponentDeficiencyView() {
  const selectedComponent = useStore((s) => s.selectedComponent);
  const setSelectedComponent = useStore((s) => s.setSelectedComponent);
  const { data, isLoading } = useComponent(selectedComponent);

  if (!selectedComponent) return null;
  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading...</div>;

  const comp = data?.data;
  if (!comp) return null;

  const displayName = selectedComponent
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const bySeverity = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  comp.deficiencies.forEach((d) => {
    if (d.severity in bySeverity) bySeverity[d.severity as keyof typeof bySeverity]++;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{displayName}</p>
          <p className="text-xs text-muted-foreground">{comp.deficiencies.length} deficiencies</p>
        </div>
        <button
          onClick={() => setSelectedComponent(null)}
          className="text-muted-foreground hover:text-foreground text-sm px-1"
        >
          ×
        </button>
      </div>

      {/* Severity summary */}
      <div className="flex gap-2 text-[10px]">
        {bySeverity.critical > 0 && (
          <span className="bg-red-600/10 text-red-500 px-1.5 py-0.5 rounded font-medium">
            {bySeverity.critical} Critical
          </span>
        )}
        {bySeverity.serious > 0 && (
          <span className="bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded font-medium">
            {bySeverity.serious} Serious
          </span>
        )}
        {bySeverity.moderate > 0 && (
          <span className="bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded font-medium">
            {bySeverity.moderate} Moderate
          </span>
        )}
        {bySeverity.minor > 0 && (
          <span className="bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded font-medium">
            {bySeverity.minor} Minor
          </span>
        )}
      </div>

      {comp.inspection_notes && (
        <div className="bg-accent/50 rounded-md p-2">
          <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Inspection Notes</p>
          <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">{comp.inspection_notes}</p>
        </div>
      )}

      <div className="space-y-2">
        {comp.deficiencies.map((d) => (
          <DeficiencyCard key={d.id} d={d} />
        ))}
      </div>
    </div>
  );
}

/** Shows ALL deficiencies organized by system when no component is selected. */
function AllDeficienciesView() {
  const selectedSystem = useStore((s) => s.selectedSystem);
  const setSelectedComponent = useStore((s) => s.setSelectedComponent);
  const { data: systemsData } = useSystems();
  const { data, isLoading } = useQuery({
    queryKey: ["allDeficiencies", selectedSystem],
    queryFn: () => fetchAllDeficiencies(selectedSystem ?? undefined),
  });

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading deficiencies...</div>;

  const deficiencies = data?.data || [];
  const systems = systemsData?.data || [];

  // Group by system
  const grouped: Record<string, SystemDeficiency[]> = {};
  deficiencies.forEach((d) => {
    const sysName = ("system_name" in d ? (d as Record<string, unknown>).system_name : "Unknown") as string;
    if (!grouped[sysName]) grouped[sysName] = [];
    grouped[sysName].push(d);
  });

  const bySeverity = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  deficiencies.forEach((d) => {
    if (d.severity in bySeverity) bySeverity[d.severity as keyof typeof bySeverity]++;
  });

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">
          {selectedSystem
            ? `${systems.find((s) => s.id === selectedSystem)?.name || ""} Deficiencies`
            : "All Deficiencies"}
        </p>
        <p className="text-xs text-muted-foreground">{deficiencies.length} items</p>
      </div>

      {/* Severity summary */}
      <div className="flex gap-2 text-[10px] flex-wrap">
        {bySeverity.critical > 0 && (
          <span className="bg-red-600/10 text-red-500 px-1.5 py-0.5 rounded font-medium">
            {bySeverity.critical} Critical
          </span>
        )}
        {bySeverity.serious > 0 && (
          <span className="bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded font-medium">
            {bySeverity.serious} Serious
          </span>
        )}
        {bySeverity.moderate > 0 && (
          <span className="bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded font-medium">
            {bySeverity.moderate} Moderate
          </span>
        )}
        {bySeverity.minor > 0 && (
          <span className="bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded font-medium">
            {bySeverity.minor} Minor
          </span>
        )}
      </div>

      {Object.entries(grouped).map(([sysName, defs]) => {
        const sys = systems.find((s) => s.name === sysName);
        return (
          <div key={sysName}>
            <div className="flex items-center gap-2 mb-1.5">
              {sys && (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: sys.color }}
                />
              )}
              <p className="text-xs font-semibold text-foreground">{sysName}</p>
              <span className="text-[10px] text-muted-foreground">({defs.length})</span>
            </div>
            <div className="space-y-2 mb-3">
              {defs.map((d) => (
                <DeficiencyCard
                  key={d.id}
                  d={d}
                  showComponent
                  onComponentClick={setSelectedComponent}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DeficiencyPanel() {
  const selectedComponent = useStore((s) => s.selectedComponent);

  return (
    <div className="h-full overflow-auto bg-card p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Inspection Deficiencies
      </p>
      {selectedComponent ? <ComponentDeficiencyView /> : <AllDeficienciesView />}
    </div>
  );
}
