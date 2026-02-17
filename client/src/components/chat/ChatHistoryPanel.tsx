import { useState, useEffect } from "react";
import { useStore } from "../../store";
import { fetchChatSessions, deleteChatSession } from "../../api/chat";
import type { ChatSession } from "../../types/chat";

interface Props {
  onSessionSelect?: () => void;
}

export default function ChatHistoryPanel({ onSessionSelect }: Props) {
  const { chatSessionId, setChatSessionId } = useStore();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const loadSessions = async () => {
    try {
      const res = await fetchChatSessions();
      setSessions(res.data || []);
    } catch {
      // API may not be available yet
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleNew = () => {
    setChatSessionId(null);
    onSessionSelect?.();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteChatSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (chatSessionId === id) setChatSessionId(null);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      <div className="p-3 border-b border-border">
        <button
          onClick={handleNew}
          className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + New Chat
        </button>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-0.5">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setChatSessionId(s.id);
              onSessionSelect?.();
            }}
            onMouseEnter={() => setHoveredId(s.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between group ${
              chatSessionId === s.id
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-foreground hover:bg-accent"
            }`}
          >
            <span className="truncate">{s.title || "Untitled chat"}</span>
            {hoveredId === s.id && (
              <span
                onClick={(e) => handleDelete(s.id, e)}
                className="text-muted-foreground hover:text-destructive shrink-0 ml-2"
                title="Delete"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            )}
          </button>
        ))}
        {sessions.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No chat history yet</p>
        )}
      </div>
    </div>
  );
}
