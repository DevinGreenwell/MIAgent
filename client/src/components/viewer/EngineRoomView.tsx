import { lazy, Suspense } from "react";
import { useStore } from "../../store";
import SystemLegend from "./SystemLegend";
import ComponentDocs from "./ComponentDocs";
import ChatPane from "../chat/ChatPane";

const EngineRoomViewer = lazy(() => import("./EngineRoomViewer"));

export default function EngineRoomView() {
  const { selectedComponent } = useStore();

  return (
    <div className="grid grid-cols-[300px_1fr_340px] h-full">
      {/* Left panel: systems + selected component docs */}
      <div className="h-full overflow-auto border-r border-border bg-card">
        <SystemLegend />
        {selectedComponent && (
          <>
            <div className="mx-4 border-t border-border" />
            <div className="pt-3">
              <ComponentDocs />
            </div>
          </>
        )}
      </div>

      {/* Middle: 3D viewer */}
      <div className="h-full">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading 3D viewer...
            </div>
          }
        >
          <EngineRoomViewer />
        </Suspense>
      </div>

      {/* Right: chat */}
      <div className="h-full border-l border-border">
        <ChatPane />
      </div>
    </div>
  );
}
