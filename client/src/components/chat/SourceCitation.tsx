import type { ChatSource } from "../../types/chat";
import { useStore } from "../../store";
import { COLLECTION_COLORS, formatDocId, formatTitle } from "../../lib/documents";

export default function SourceCitation({ source }: { source: ChatSource }) {
  const { setSelectedDocumentId, setActiveView } = useStore();

  const docLabel = formatDocId(source.document_id);

  return (
    <button
      onClick={() => { setSelectedDocumentId(source.id); setActiveView("search"); }}
      className={`flex flex-col items-start px-2.5 py-1.5 rounded-lg text-xs border hover:opacity-80 transition-opacity ${
        COLLECTION_COLORS[source.collection_id] || "bg-muted text-muted-foreground border-border"
      }`}
    >
      <span className="font-semibold">{docLabel}</span>
      {source.title && source.title !== docLabel && (
        <span className="opacity-75 text-[11px] leading-tight">{formatTitle(source.title)}</span>
      )}
    </button>
  );
}
