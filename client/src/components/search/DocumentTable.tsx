import { useStore } from "../../store";
import { useDocuments, useSearch } from "../../api/hooks";

const COLLECTION_COLORS: Record<string, string> = {
  cfr: "bg-blue-900/50 text-blue-300",
  nvic: "bg-green-900/50 text-green-300",
  "policy-letter": "bg-purple-900/50 text-purple-300",
  prg: "bg-orange-900/50 text-orange-300",
  mtn: "bg-teal-900/50 text-teal-300",
  "io-guidance": "bg-pink-900/50 text-pink-300",
  "class-rules": "bg-indigo-900/50 text-indigo-300",
  msm: "bg-yellow-900/50 text-yellow-300",
  imo: "bg-red-900/50 text-red-300",
};

export default function DocumentTable() {
  const { searchQuery, filters, page, selectedDocumentId, setSelectedDocumentId } = useStore();

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
      {rows.map((doc) => (
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
              <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {doc.part_title
                  ? doc.part_title
                  : <>
                      {doc.document_id}
                      {doc.year ? ` · ${doc.year}` : ""}
                    </>
                }
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
