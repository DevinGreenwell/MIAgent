import type { ChatSource } from "../../types/chat";
import { useStore } from "../../store";

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

export default function SourceCitation({ source }: { source: ChatSource }) {
  const { setSelectedDocumentId, setActiveView } = useStore();

  return (
    <button
      onClick={() => { setSelectedDocumentId(source.id); setActiveView("search"); }}
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium hover:opacity-80 transition-opacity ${
        COLLECTION_COLORS[source.collection_id] || "bg-muted text-muted-foreground"
      }`}
      title={source.title}
    >
      {source.document_id.split("/").pop()}
    </button>
  );
}
