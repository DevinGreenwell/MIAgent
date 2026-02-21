import { useStore } from "../../store";
import { useDocuments, useSearch } from "../../api/hooks";
import { COLLECTION_COLORS, formatDocId, formatTitle, titleCase } from "../../lib/documents";

export default function DocumentTable() {
  const searchQuery = useStore((s) => s.searchQuery);
  const filters = useStore((s) => s.filters);
  const page = useStore((s) => s.page);
  const selectedDocumentId = useStore((s) => s.selectedDocumentId);
  const setSelectedDocumentId = useStore((s) => s.setSelectedDocumentId);

  const params = { ...filters, page, limit: 25 };
  const { data: docs, isLoading } = searchQuery
    ? useSearch({ ...params, q: searchQuery })
    : useDocuments(params);

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Loading documents...</div>;
  }

  const rows = docs?.data || [];

  if (rows.length === 0) {
    return <div className="p-4 text-muted-foreground">No documents found.</div>;
  }

  return (
    <div className="divide-y divide-border">
      {rows.map((doc) => {
        const docLabel = formatDocId(doc.document_id);
        return (
          <button
            key={doc.id}
            onClick={() => setSelectedDocumentId(doc.id === selectedDocumentId ? null : doc.id)}
            className={`w-full text-left px-4 py-3 hover:bg-accent transition-colors ${
              doc.id === selectedDocumentId ? "bg-primary/10 border-l-4 border-primary" : ""
            }`}
          >
            <div className="flex items-start gap-2">
              <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${COLLECTION_COLORS[doc.collection_id] || "bg-muted text-muted-foreground"}`}>
                {doc.collection_id.toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{docLabel}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {doc.part_title ? titleCase(doc.part_title) : formatTitle(doc.title)}
                  {doc.year ? ` · ${doc.year}` : ""}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
