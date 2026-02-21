import type { ComponentDocument } from "../../types/components";
import { useStore } from "../../store";

const RELEVANCE_STYLES: Record<string, string> = {
  primary: "border-l-4 border-l-primary bg-primary/10",
  secondary: "border-l-4 border-l-muted-foreground bg-muted",
  reference: "border-l-4 border-l-border bg-card",
};

export default function CfrReferenceCard({
  document: doc,
}: {
  document: ComponentDocument;
}) {
  const setSelectedDocumentId = useStore((s) => s.setSelectedDocumentId);
  const setActiveView = useStore((s) => s.setActiveView);

  return (
    <div
      className={`rounded-lg p-3 border border-border ${
        RELEVANCE_STYLES[doc.relevance] || RELEVANCE_STYLES.reference
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{doc.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{doc.document_id}</p>
          {doc.cfr_reference && (
            <p className="text-xs text-primary mt-0.5">{doc.cfr_reference}</p>
          )}
        </div>
        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
          {doc.relevance}
        </span>
      </div>
      <button
        onClick={() => {
          setSelectedDocumentId(doc.id);
          setActiveView("search");
        }}
        className="mt-2 text-xs text-primary hover:underline"
      >
        View document →
      </button>
    </div>
  );
}
