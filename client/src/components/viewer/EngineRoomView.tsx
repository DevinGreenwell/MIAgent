import { lazy, Suspense, useState } from "react";
import { useStore } from "../../store";
import SystemTree from "./SystemTree";
import ModelPartTree from "./ModelPartTree";
import ComponentDocs from "./ComponentDocs";
import DeficiencyPanel from "./DeficiencyPanel";

const InspectViewer = lazy(() => import("./InspectViewer"));

type InspectPane = "viewer" | "systems" | "deficiencies";

export default function EngineRoomView() {
  const { selectedComponent } = useStore();
  const [mobilePane, setMobilePane] = useState<InspectPane>("viewer");

  return (
    <div className="flex h-full min-h-0 flex-col md:grid md:grid-cols-[280px_1fr_340px]">
      <div className="flex gap-1 border-b border-border bg-card p-2 md:hidden">
        <button
          onClick={() => setMobilePane("viewer")}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
            mobilePane === "viewer"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-accent"
          }`}
        >
          Viewer
        </button>
        <button
          onClick={() => setMobilePane("systems")}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
            mobilePane === "systems"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-accent"
          }`}
        >
          Systems
        </button>
        <button
          onClick={() => setMobilePane("deficiencies")}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
            mobilePane === "deficiencies"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-accent"
          }`}
        >
          Deficiencies
        </button>
      </div>

      {/* Left panel: system tree + selected component references */}
      <div className={`${mobilePane === "systems" ? "flex" : "hidden"} min-h-0 flex-col overflow-auto border-b border-border bg-card md:flex md:border-b-0 md:border-r`}>
        <SystemTree />
        {selectedComponent && (
          <>
            <div className="mx-4 border-t border-border" />
            <ModelPartTree />
            <div className="mx-4 border-t border-border" />
            <div className="pt-3">
              <ComponentDocs />
            </div>
          </>
        )}
      </div>

      {/* Middle: 3D inspector */}
      <div className={`${mobilePane === "viewer" ? "flex" : "hidden"} min-h-0 flex-col md:flex`}>
        <div className="min-h-[44vh] flex-1 md:min-h-0">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading 3D viewer...
            </div>
          }
        >
          <InspectViewer />
        </Suspense>
        </div>
      </div>

      {/* Right: inspection deficiencies */}
      <div className={`${mobilePane === "deficiencies" ? "flex" : "hidden"} min-h-0 flex-col overflow-auto bg-card md:flex md:border-l md:border-border`}>
        <DeficiencyPanel />
      </div>
    </div>
  );
}
