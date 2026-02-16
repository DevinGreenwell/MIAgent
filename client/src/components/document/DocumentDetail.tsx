import { useStore } from "../../store";
import { useDocument } from "../../api/hooks";
import { getPdfUrl } from "../../api/client";

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

export default function DocumentDetail() {
  const { selectedDocumentId, setSelectedDocumentId, setPdfOpen } = useStore();
  const { data, isLoading } = useDocument(selectedDocumentId);

  if (!selectedDocumentId) return null;
  if (isLoading) return <div className="p-4 text-muted-foreground">Loading...</div>;

  const doc = data?.data;
  if (!doc) return <div className="p-4 text-muted-foreground">Document not found.</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <span
            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
              COLLECTION_COLORS[doc.collection_id] || "bg-muted text-muted-foreground"
            }`}
          >
            {doc.collection_id.toUpperCase()}
          </span>
          <h2 className="text-xl font-bold text-foreground mt-1">{doc.title}</h2>
          {doc.part_title ? (
            <p className="text-sm text-muted-foreground mt-0.5">{doc.part_title}</p>
          ) : (
            <p className="text-sm text-muted-foreground mt-0.5">{doc.document_id}</p>
          )}
        </div>
        <button
          onClick={() => setSelectedDocumentId(null)}
          className="text-muted-foreground hover:text-foreground text-xl"
        >
          ×
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setPdfOpen(true)}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:opacity-90"
        >
          View PDF
        </button>
        <a
          href={getPdfUrl(doc.id)}
          download
          className="px-3 py-1.5 border border-border rounded text-sm text-foreground hover:bg-accent"
        >
          Download
        </a>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {doc.year && (
          <div>
            <span className="text-muted-foreground">Year:</span> {doc.year}
          </div>
        )}
        {doc.revision && (
          <div>
            <span className="text-muted-foreground">Revision:</span> {doc.revision}
          </div>
        )}
        {doc.status && (
          <div>
            <span className="text-muted-foreground">Status:</span> {doc.status}
          </div>
        )}
        {doc.subcategory && (
          <div>
            <span className="text-muted-foreground">Category:</span> {doc.subcategory}
          </div>
        )}
      </div>

      {doc.topics.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Topics</h3>
          <div className="flex flex-wrap gap-1">
            {doc.topics.map((t) => (
              <span
                key={t.id}
                className="px-2 py-0.5 bg-blue-900/30 text-blue-300 rounded-full text-xs"
              >
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {doc.vessel_types.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Vessel Types
          </h3>
          <div className="flex flex-wrap gap-1">
            {doc.vessel_types.map((v) => (
              <span
                key={v.id}
                className="px-2 py-0.5 bg-green-900/30 text-green-300 rounded-full text-xs"
              >
                {v.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {doc.cfr_sections.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            CFR References
          </h3>
          <div className="space-y-1">
            {doc.cfr_sections.map((s) => (
              <div key={s.id} className="text-sm">
                <span className="font-medium">{s.label}</span>
                <span className="text-muted-foreground ml-1">— {s.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {doc.related.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Related Documents
          </h3>
          <div className="space-y-1">
            {doc.related.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedDocumentId(r.id)}
                className="block text-sm text-primary hover:underline"
              >
                {r.title}{" "}
                <span className="text-muted-foreground">({r.relationship_type})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
