import { useStore } from "../../store";
import { useComponent } from "../../api/components";

export default function ComponentDocs() {
  const { selectedComponent, setSelectedComponent, setSelectedDocumentId, setActiveView } = useStore();
  const { data, isLoading } = useComponent(selectedComponent);

  if (!selectedComponent) return null;
  if (isLoading) return <div className="px-4 py-2 text-sm text-muted-foreground">Loading...</div>;

  const comp = data?.data;
  if (!comp) return null;

  const displayName = selectedComponent
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const handleDocClick = (docId: number) => {
    setSelectedDocumentId(docId);
    setActiveView("search");
  };

  return (
    <div className="px-4 pb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-foreground">{displayName}</p>
        <button
          onClick={() => setSelectedComponent(null)}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ×
        </button>
      </div>

      {comp.description && (
        <p className="text-xs text-muted-foreground mb-3">{comp.description}</p>
      )}

      {comp.documents.length > 0 ? (
        <ul className="space-y-1">
          {comp.documents.map((doc) => (
            <li key={doc.id}>
              <button
                onClick={() => handleDocClick(doc.id)}
                className="w-full text-left text-sm text-primary hover:underline flex items-start gap-2"
              >
                <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full bg-primary" />
                <span>
                  {doc.title}
                  {doc.cfr_reference && (
                    <span className="text-muted-foreground text-xs ml-1">({doc.cfr_reference})</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No supporting documents found.</p>
      )}

      {comp.deficiencies.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Common Deficiencies</p>
          <ul className="space-y-1">
            {comp.deficiencies.map((d) => (
              <li key={d.id} className="flex items-start gap-2 text-xs text-foreground">
                <span className={`shrink-0 mt-1 px-1 rounded font-bold text-[10px] leading-tight ${
                  d.severity === "critical" ? "bg-red-600 text-white" :
                  d.severity === "serious" ? "bg-orange-500 text-white" :
                  d.severity === "moderate" ? "bg-yellow-500 text-white" :
                  "bg-muted-foreground text-white"
                }`}>
                  {d.severity[0].toUpperCase()}
                </span>
                <span>{d.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
