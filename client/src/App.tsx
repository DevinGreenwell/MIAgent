import { lazy, Suspense, useEffect, useState } from "react";
import { useStore } from "./store";
import Header from "./components/layout/Header";
import SearchBar from "./components/search/SearchBar";
import FilterPanel from "./components/search/FilterPanel";
import DocumentTable from "./components/search/DocumentTable";
import Pagination from "./components/search/Pagination";
import CollectionCards from "./components/search/CollectionCards";
import DocumentDetail from "./components/document/DocumentDetail";
import MobilePaneTabs from "./components/ui/MobilePaneTabs";

const PdfViewer = lazy(() => import("./components/document/PdfViewer"));

const ChatView = lazy(() => import("./components/chat/ChatView"));
const EngineRoomView = lazy(() => import("./components/viewer/EngineRoomView"));
const StudyView = lazy(() => import("./components/study/StudyView"));

type SearchPane = "filters" | "documents" | "detail";

function SearchView() {
  const { selectedDocumentId, pdfOpen, searchQuery, filters } = useStore();
  const showCards = !searchQuery && !filters.collection;
  const [mobilePane, setMobilePane] = useState<SearchPane>("documents");

  useEffect(() => {
    if (selectedDocumentId) {
      setMobilePane("detail");
    }
  }, [selectedDocumentId]);

  return (
    <div className="flex h-full min-h-0 flex-col md:grid md:grid-cols-[280px_1fr_1fr]">
      <MobilePaneTabs
        tabs={[
          { id: "filters", label: "Filters" },
          { id: "documents", label: "References" },
          { id: "detail", label: "Details" },
        ]}
        active={mobilePane}
        onChange={(id) => setMobilePane(id as SearchPane)}
      />

      {/* Left panel: Search + Filters */}
      <div className={`${mobilePane === "filters" ? "flex" : "hidden"} min-h-0 flex-col overflow-auto border-b border-border p-4 space-y-3 md:flex md:border-b-0 md:border-r`}>
        <SearchBar />
        <FilterPanel />
      </div>

      {/* Middle panel: Collection cards or document list */}
      <div className={`${mobilePane === "documents" ? "flex" : "hidden"} min-h-0 flex-col overflow-hidden border-b border-border md:flex md:border-b-0 md:border-r`}>
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
      <div className={`${mobilePane === "detail" ? "flex" : "hidden"} min-h-0 flex-col overflow-auto md:flex`}>
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
      {activeView === "study" && <StudyView />}
    </Suspense>
  );
}

export default function App() {
  return (
    <div className="flex h-full min-h-dvh flex-col">
      <Header />
      <main className="flex-1 min-h-0 overflow-hidden">
        <ViewContent />
      </main>
    </div>
  );
}
