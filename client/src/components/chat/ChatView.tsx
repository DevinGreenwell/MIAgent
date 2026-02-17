import { useState, useEffect } from "react";
import { useStore } from "../../store";
import { fetchChatSession } from "../../api/chat";
import type { ChatMessage } from "../../types/chat";
import ChatHistoryPanel from "./ChatHistoryPanel";
import ChatPane from "./ChatPane";

type ChatMobilePane = "history" | "chat";

export default function ChatView() {
  const { chatSessionId } = useStore();
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const [sessionKey, setSessionKey] = useState(0);
  const [mobilePane, setMobilePane] = useState<ChatMobilePane>("chat");

  useEffect(() => {
    if (chatSessionId) {
      fetchChatSession(chatSessionId)
        .then((res) => {
          setInitialMessages(res.data?.messages || []);
          setSessionKey((k) => k + 1);
        })
        .catch(() => {
          setInitialMessages([]);
          setSessionKey((k) => k + 1);
        });
    } else {
      setInitialMessages([]);
      setSessionKey((k) => k + 1);
    }
  }, [chatSessionId]);

  useEffect(() => {
    setMobilePane("chat");
  }, [chatSessionId]);

  return (
    <div className="flex h-full min-h-0 flex-col md:grid md:grid-cols-[280px_1fr]">
      <div className="flex gap-1 border-b border-border bg-card p-2 md:hidden">
        <button
          onClick={() => setMobilePane("chat")}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
            mobilePane === "chat"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-accent"
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setMobilePane("history")}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
            mobilePane === "history"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-accent"
          }`}
        >
          History
        </button>
      </div>

      <div className={`${mobilePane === "history" ? "flex" : "hidden"} min-h-0 flex-col md:flex`}>
        <ChatHistoryPanel onSessionSelect={() => setMobilePane("chat")} />
      </div>
      <div className={`${mobilePane === "chat" ? "flex" : "hidden"} min-h-0 flex-col md:flex`}>
        <ChatPane key={sessionKey} initialMessages={initialMessages} />
      </div>
    </div>
  );
}
