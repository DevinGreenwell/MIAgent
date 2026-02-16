import { useState, useRef, useEffect } from "react";
import { useStore } from "../../store";
import { sendChatMessage } from "../../api/chat";
import type { ChatMessage as ChatMessageType } from "../../types/chat";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import ChatSuggestions from "./ChatSuggestions";

interface Props {
  initialMessages?: ChatMessageType[];
}

export default function ChatPane({ initialMessages }: Props) {
  const { chatSessionId, setChatSessionId, selectedComponent } = useStore();
  const [messages, setMessages] = useState<ChatMessageType[]>(initialMessages || []);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    const userMsg: ChatMessageType = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await sendChatMessage({
        message: text,
        sessionId: chatSessionId || undefined,
        componentContext: selectedComponent || undefined,
      });

      setChatSessionId(res.data.sessionId);
      const assistantMsg: ChatMessageType = {
        role: "assistant",
        content: res.data.message,
        sources: res.data.sources,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessageType = {
        role: "assistant",
        content: "Sorry, I encountered an error processing your request.",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const isEmpty = messages.length === 0 && !loading;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollRef} className={`flex-1 min-h-0 overflow-y-auto ${isEmpty ? "flex items-center justify-center" : ""}`}>
        {isEmpty ? (
          <div className="w-full max-w-3xl mx-auto px-4">
            <ChatSuggestions onSelect={sendMessage} />
          </div>
        ) : (
          <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-4">
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-sm">Thinking...</span>
              </div>
            )}
          </div>
        )}
      </div>

      <ChatInput onSend={sendMessage} disabled={loading} />
    </div>
  );
}
