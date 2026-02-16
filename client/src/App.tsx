import { lazy, Suspense } from "react";
import { useStore } from "./store";
import Header from "./components/layout/Header";
import PaneContainer from "./components/layout/PaneContainer";
import SearchBar from "./components/search/SearchBar";
import FilterPanel from "./components/search/FilterPanel";
import DocumentTable from "./components/search/DocumentTable";
import Pagination from "./components/search/Pagination";
import DocumentDetail from "./components/document/DocumentDetail";
import PdfViewer from "./components/document/PdfViewer";

const ChatView = lazy(() => import("./components/chat/ChatView"));
const EngineRoomView = lazy(() => import("./components/viewer/EngineRoomView"));

function SearchView() {
  const { selectedDocumentId, pdfOpen } = useStore();

  return (
    <PaneContainer layout={selectedDocumentId ? "two-col" : "single"}>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-border space-y-3">
          <SearchBar />
          <FilterPanel />
        </div>
        <div className="flex-1 overflow-auto">
          <DocumentTable />
        </div>
        <Pagination />
      </div>

      {selectedDocumentId && (
        <div className="flex flex-col h-full overflow-auto">
          {pdfOpen ? <PdfViewer /> : <DocumentDetail />}
        </div>
      )}
    </PaneContainer>
  );
}

function ViewContent() {
  const { activeView } = useStore();

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Loading...
        </div>
      }
    >
      {activeView === "chat" && <ChatView />}
      {activeView === "viewer" && <EngineRoomView />}
      {activeView === "search" && <SearchView />}
    </Suspense>
  );
}

export default function App() {
  return (
    <div className="h-full flex flex-col">
      <Header />
      <main className="flex-1 overflow-hidden">
        <ViewContent />
      </main>
    </div>
  );
}
