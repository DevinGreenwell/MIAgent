import type { ChatSource } from "../../types/chat";
import { useStore } from "../../store";
import { COLLECTION_COLORS, formatDocId, formatTitle } from "../../lib/documents";

export default function SourceCitation({ source }: { source: ChatSource }) {
  const setSelectedDocumentId = useStore((s) => s.setSelectedDocumentId);
  const setActiveView = useStore((s) => s.setActiveView);

  const docLabel = formatDocId(source.document_id);

  return (
    <button
      onClick={() => { setSelectedDocumentId(source.id); setActiveView("search"); }}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border hover:opacity-80 transition-opacity ${
        COLLECTION_COLORS[source.collection_id] || "bg-muted text-muted-foreground border-border"
      }`}
    >
      <span className="font-semibold whitespace-nowrap">{docLabel}</span>
      {source.title && source.title !== docLabel && (
        <span className="opacity-75 truncate max-w-[120px]">{formatTitle(source.title)}</span>
      )}
    </button>
  );
}
