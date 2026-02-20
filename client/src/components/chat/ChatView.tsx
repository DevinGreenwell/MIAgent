import { useState, useEffect, useRef } from "react";
import { useStore } from "../../store";
import { fetchChatSession } from "../../api/chat";
import type { ChatMessage } from "../../types/chat";
import ChatHistoryPanel from "./ChatHistoryPanel";
import ChatPane from "./ChatPane";
import MobilePaneTabs from "../ui/MobilePaneTabs";

type ChatMobilePane = "history" | "chat";

export default function ChatView() {
  const { chatSessionId } = useStore();
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const [sessionKey, setSessionKey] = useState(0);
  const [mobilePane, setMobilePane] = useState<ChatMobilePane>("chat");

  // Track sessions created by the active ChatPane so we don't remount it
  const ownedSessionRef = useRef<string | null>(null);

  useEffect(() => {
    // If this session was just created by the current ChatPane (first message
    // in a new chat), skip the fetch+remount — the ChatPane already has the
    // messages in its own state.
    if (chatSessionId && chatSessionId === ownedSessionRef.current) {
      return;
    }

    if (chatSessionId) {
      fetchChatSession(chatSessionId)
        .then((res) => {
          setInitialMessages(res.data?.messages || []);
          setSessionKey((k) => k + 1);
          // After loading an existing session, clear ownership so future
          // changes (e.g. the user picks another session) still reload.
          ownedSessionRef.current = null;
        })
        .catch(() => {
          setInitialMessages([]);
          setSessionKey((k) => k + 1);
          ownedSessionRef.current = null;
        });
    } else {
      setInitialMessages([]);
      setSessionKey((k) => k + 1);
      ownedSessionRef.current = null;
    }
  }, [chatSessionId]);

  useEffect(() => {
    setMobilePane("chat");
  }, [chatSessionId]);

  /** Called by ChatPane when it creates a new session during streaming. */
  const handleSessionCreated = (id: string) => {
    ownedSessionRef.current = id;
  };

  return (
    <div className="flex h-full min-h-0 flex-col md:grid md:grid-cols-[280px_1fr]">
      <MobilePaneTabs
        tabs={[
          { id: "chat", label: "Chat" },
          { id: "history", label: "History" },
        ]}
        active={mobilePane}
        onChange={(id) => setMobilePane(id as ChatMobilePane)}
      />

      <div className={`${mobilePane === "history" ? "flex" : "hidden"} min-h-0 flex-col md:flex`}>
        <ChatHistoryPanel onSessionSelect={() => setMobilePane("chat")} />
      </div>
      <div className={`${mobilePane === "chat" ? "flex" : "hidden"} min-h-0 flex-col md:flex`}>
        <ChatPane
          key={sessionKey}
          initialMessages={initialMessages}
          onSessionCreated={handleSessionCreated}
        />
      </div>
    </div>
  );
}
