import { useState, useCallback, useEffect } from "react";
import {
  fetchStudyHistoryItem,
  fetchStudyReferences,
  type StudyHistoryItem,
  type StudyReference,
} from "../../api/study";
import { QUAL_BY_ID, type QualificationDef } from "../../lib/qualifications";
import QualificationBrowser from "./QualificationBrowser";
import StudyContent from "./StudyContent";
import StudyHistory from "./StudyHistory";
import ReferenceBrowser from "./ReferenceBrowser";
import MobilePaneTabs from "../ui/MobilePaneTabs";

type MobilePane = "left" | "middle" | "refs";

export default function StudyView() {
  const [selectedQual, setSelectedQual] = useState<QualificationDef | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>("left");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [activeHistoryId, setActiveHistoryId] = useState<number | null>(null);
  const [loadedContent, setLoadedContent] = useState<{ contentType: string; content: string } | null>(null);

  // Reference state
  const [references, setReferences] = useState<StudyReference[]>([]);
  const [refsLoading, setRefsLoading] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  // Fetch references when qual changes
  useEffect(() => {
    if (!selectedQual) {
      setReferences([]);
      setSelectedDocIds(new Set());
      return;
    }

    setRefsLoading(true);
    fetchStudyReferences(selectedQual.id)
      .then((res) => {
        setReferences(res.data);
        // Default: all selected
        setSelectedDocIds(new Set(res.data.map((r) => r.document_id)));
      })
      .catch(() => {
        setReferences([]);
        setSelectedDocIds(new Set());
      })
      .finally(() => setRefsLoading(false));
  }, [selectedQual?.id]);

  const handleSelectQual = (qual: QualificationDef) => {
    setSelectedQual(qual);
    setActiveHistoryId(null);
    setLoadedContent(null);
    setMobilePane("middle");
  };

  const handleHistorySelect = useCallback(async (item: StudyHistoryItem) => {
    try {
      const res = await fetchStudyHistoryItem(item.id);
      const detail = res.data;

      // Switch qual if different
      if (!selectedQual || selectedQual.id !== detail.qual_id) {
        const qual = QUAL_BY_ID.get(detail.qual_id);
        if (qual) setSelectedQual(qual);
      }

      setActiveHistoryId(detail.id);
      setLoadedContent({ contentType: detail.content_type, content: detail.content });
      setMobilePane("middle");
    } catch {
      // Failed to load
    }
  }, [selectedQual]);

  const handleGenerationComplete = useCallback((id: number | null) => {
    setHistoryRefreshKey((k) => k + 1);
    if (id != null) setActiveHistoryId(id);
  }, []);

  // When all refs selected, pass undefined (full RAG, cache-eligible).
  // When subset selected, pass the array.
  const selectedDocIdsArray =
    selectedDocIds.size > 0 && selectedDocIds.size < references.length
      ? [...selectedDocIds]
      : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col md:grid md:grid-cols-[280px_1fr_300px]">
      <MobilePaneTabs
        tabs={[
          { id: "left", label: "Study" },
          { id: "middle", label: "Content" },
          { id: "refs", label: "References" },
        ]}
        active={mobilePane}
        onChange={(id) => setMobilePane(id as MobilePane)}
      />

      {/* Left panel: Qual dropdown + Study History */}
      <div
        className={`${
          mobilePane === "left" ? "flex" : "hidden"
        } min-h-0 flex-col overflow-hidden border-b border-border md:flex md:border-b-0 md:border-r`}
      >
        <QualificationBrowser selected={selectedQual} onSelect={handleSelectQual} />
        <div className="flex-1 min-h-0 overflow-hidden">
          <StudyHistory
            refreshKey={historyRefreshKey}
            activeId={activeHistoryId}
            onSelect={handleHistorySelect}
          />
        </div>
      </div>

      {/* Middle panel: Study toolbar + content */}
      <div
        className={`${
          mobilePane === "middle" ? "flex" : "hidden"
        } min-h-0 flex-col overflow-hidden border-b border-border md:flex md:border-b-0 md:border-r`}
      >
        <StudyContent
          qual={selectedQual}
          loadedContent={loadedContent}
          onGenerationComplete={handleGenerationComplete}
          selectedDocIds={selectedDocIdsArray}
        />
      </div>

      {/* Right panel: Reference browser */}
      <div
        className={`${
          mobilePane === "refs" ? "flex" : "hidden"
        } min-h-0 flex-col overflow-hidden md:flex`}
      >
        <ReferenceBrowser
          references={references}
          selectedIds={selectedDocIds}
          onSelectionChange={setSelectedDocIds}
          loading={refsLoading}
        />
      </div>
    </div>
  );
}
