import { lazy, Suspense } from "react";
import { useStore } from "./store";
import Header from "./components/layout/Header";
import SearchBar from "./components/search/SearchBar";
import FilterPanel from "./components/search/FilterPanel";
import DocumentTable from "./components/search/DocumentTable";
import Pagination from "./components/search/Pagination";
import CollectionCards from "./components/search/CollectionCards";
import DocumentDetail from "./components/document/DocumentDetail";
import PdfViewer from "./components/document/PdfViewer";

const ChatView = lazy(() => import("./components/chat/ChatView"));
const EngineRoomView = lazy(() => import("./components/viewer/EngineRoomView"));

function SearchView() {
  const { selectedDocumentId, pdfOpen, searchQuery, filters } = useStore();
  const showCards = !searchQuery && !filters.collection;

  return (
    <div className="grid grid-cols-[280px_1fr_1fr] h-full">
      {/* Left panel: Search + Filters */}
      <div className="flex flex-col h-full overflow-auto border-r border-border p-4 space-y-3">
        <SearchBar />
        <FilterPanel />
      </div>

      {/* Middle panel: Collection cards or document list */}
      <div className="flex flex-col h-full overflow-hidden border-r border-border">
        {showCards ? (
          <div className="flex-1 overflow-auto">
            <CollectionCards />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto">
              <DocumentTable />
            </div>
            <Pagination />
          </>
        )}
      </div>

      {/* Right panel: Document detail or empty state */}
      <div className="flex flex-col h-full overflow-auto">
        {selectedDocumentId ? (
          pdfOpen ? <PdfViewer /> : <DocumentDetail />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a document to view details
          </div>
        )}
      </div>
    </div>
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
