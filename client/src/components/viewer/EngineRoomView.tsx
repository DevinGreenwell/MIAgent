import { lazy, Suspense } from "react";
import { useStore } from "../../store";
import SystemTree from "./SystemTree";
import ModelPartTree from "./ModelPartTree";
import ComponentDocs from "./ComponentDocs";
import DeficiencyPanel from "./DeficiencyPanel";

const InspectViewer = lazy(() => import("./InspectViewer"));

export default function EngineRoomView() {
  const { selectedComponent } = useStore();

  return (
    <div className="grid grid-cols-[280px_1fr_340px] h-full">
      {/* Left panel: system tree + selected component references */}
      <div className="h-full overflow-auto border-r border-border bg-card">
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
      <div className="h-full">
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

      {/* Right: inspection deficiencies */}
      <div className="h-full overflow-auto border-l border-border">
        <DeficiencyPanel />
      </div>
    </div>
  );
}
