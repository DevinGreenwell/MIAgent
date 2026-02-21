import { useStore } from "../../store";
import { useCollections } from "../../api/hooks";
import { COLLECTION_COLORS } from "../../lib/documents";

const COLLECTION_DESCRIPTIONS: Record<string, string> = {
  cfr: "Code of Federal Regulations — Title 33 & 46 maritime rules",
  nvic: "Navigation and Vessel Inspection Circulars — USCG policy guidance",
  msm: "Marine Safety Manual — Inspection procedures and standards",
  prg: "Policy, Rules & Guidance — Technical and design standards",
  mtn: "Marine Technical Notes — Technical guidance and advisories",
  "policy-letter": "Policy Letters — Official USCG policy directives",
  "io-guidance": "Inspector & Officer Guidance — Field inspection procedures",
  "class-rules": "Classification Society Rules — ABS, DNV, Lloyd's standards",
  imo: "International Maritime Organization — SOLAS, MARPOL conventions",
};

const BORDER_COLORS: Record<string, string> = {
  cfr: "border-l-blue-500",
  nvic: "border-l-green-500",
  "policy-letter": "border-l-purple-500",
  prg: "border-l-orange-500",
  mtn: "border-l-teal-500",
  "io-guidance": "border-l-pink-500",
  "class-rules": "border-l-indigo-500",
  msm: "border-l-yellow-500",
  imo: "border-l-red-500",
};

export default function CollectionCards() {
  const setFilter = useStore((s) => s.setFilter);
  const { data: collections, isLoading } = useCollections();

  if (isLoading) {
    return (
      <div className="p-3 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  const items = collections?.data || [];

  return (
    <div className="p-3 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
      {items.map((c) => (
        <button
          key={c.slug}
          onClick={() => setFilter("collection", c.slug)}
          className={`text-left border border-border rounded-lg p-4 border-l-4 ${BORDER_COLORS[c.slug] || "border-l-gray-500"} hover:bg-muted/50 transition-colors cursor-pointer`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${COLLECTION_COLORS[c.slug] || "bg-gray-800 text-gray-300"}`}>
              {c.slug.toUpperCase()}
            </span>
            <span className="text-sm font-medium text-foreground">{c.name}</span>
          </div>
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
            {COLLECTION_DESCRIPTIONS[c.slug] || c.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {c.doc_count.toLocaleString()} document{c.doc_count !== 1 ? "s" : ""}
          </p>
        </button>
      ))}
    </div>
  );
}
