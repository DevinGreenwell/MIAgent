import { useState, useEffect } from "react";
import { useStore } from "../../store";
import { fetchChatSession } from "../../api/chat";
import type { ChatMessage } from "../../types/chat";
import ChatHistoryPanel from "./ChatHistoryPanel";
import ChatPane from "./ChatPane";

export default function ChatView() {
  const { chatSessionId } = useStore();
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const [sessionKey, setSessionKey] = useState(0);

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

  return (
    <div className="grid grid-cols-[280px_1fr] h-full">
      <ChatHistoryPanel />
      <ChatPane key={sessionKey} initialMessages={initialMessages} />
    </div>
  );
}
