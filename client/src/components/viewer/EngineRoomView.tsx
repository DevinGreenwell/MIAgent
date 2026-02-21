import { lazy, Suspense, useState } from "react";
import { useStore } from "../../store";
import SystemTree from "./SystemTree";
import ModelPartTree from "./ModelPartTree";
import ComponentDocs from "./ComponentDocs";
import DeficiencyPanel from "./DeficiencyPanel";
import MobilePaneTabs from "../ui/MobilePaneTabs";

const InspectViewer = lazy(() => import("./InspectViewer"));

type InspectPane = "viewer" | "systems" | "deficiencies";

export default function EngineRoomView() {
  const selectedComponent = useStore((s) => s.selectedComponent);
  const [mobilePane, setMobilePane] = useState<InspectPane>("viewer");

  return (
    <div className="flex h-full min-h-0 flex-col md:grid md:grid-cols-[280px_1fr_340px]">
      <MobilePaneTabs
        tabs={[
          { id: "viewer", label: "Viewer" },
          { id: "systems", label: "Systems" },
          { id: "deficiencies", label: "Deficiencies" },
        ]}
        active={mobilePane}
        onChange={(id) => setMobilePane(id as InspectPane)}
      />

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
