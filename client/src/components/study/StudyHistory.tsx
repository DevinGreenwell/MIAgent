import { useEffect, useState, useCallback } from "react";
import { fetchStudyHistory, deleteStudyHistoryItem, type StudyHistoryItem } from "../../api/study";
import { QUAL_BY_ID } from "../../lib/qualifications";

const CONTENT_TYPE_LABELS: Record<string, string> = {
  flashcards: "Flashcards",
  quiz: "Quiz",
  scenario: "Scenarios",
  slideshow: "Slideshow",
};

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr + "Z"); // SQLite datetimes are UTC
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

interface Props {
  refreshKey: number;
  activeId: number | null;
  onSelect: (item: StudyHistoryItem) => void;
}

export default function StudyHistory({ refreshKey, activeId, onSelect }: Props) {
  const [items, setItems] = useState<StudyHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchStudyHistory()
      .then((res) => setItems(res.data))
      .catch((err) => { console.warn("Failed to load study history:", err); setItems([]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [refreshKey, load]);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await deleteStudyHistoryItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.warn("Failed to delete study history item:", err);
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading history...</span>
        </div>
      </div>
    );
  }

  // Group by qual_id
  const grouped = new Map<string, StudyHistoryItem[]>();
  for (const item of items) {
    const arr = grouped.get(item.qual_id) || [];
    arr.push(item);
    grouped.set(item.qual_id, arr);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3">
        <h2 className="text-sm font-semibold text-foreground">Study History</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No study materials generated yet. Select a qualification and generate content to see it here.
          </div>
        ) : (
          <div className="p-2 space-y-3">
            {[...grouped.entries()].map(([qualId, qualItems]) => {
              const qual = QUAL_BY_ID.get(qualId);
              return (
                <div key={qualId}>
                  <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {qual?.label ?? qualId}
                  </div>
                  <div className="space-y-0.5">
                    {qualItems.map((item) => {
                      const isActive = item.id === activeId;
                      return (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelect(item)}
                          onKeyDown={(e) => { if (e.key === "Enter") onSelect(item); }}
                          className={`group flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors ${
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "hover:bg-accent text-foreground"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium truncate">
                              {CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}
                              {item.topic ? `: ${item.topic}` : ""}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {relativeTime(item.created_at)}
                            </div>
                          </div>
                          <button
                            onClick={(e) => handleDelete(e, item.id)}
                            className="ml-2 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
                            title="Delete"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
