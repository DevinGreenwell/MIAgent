import { useState, useRef, useEffect, useCallback } from "react";
import { useStore } from "../../store";
import { streamChatMessage } from "../../api/chat";
import type { ChatMessage as ChatMessageType, ChatSource } from "../../types/chat";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import ChatSuggestions from "./ChatSuggestions";
import LoadingDots from "../ui/LoadingDots";

interface Props {
  initialMessages?: ChatMessageType[];
  onSessionCreated?: (id: string) => void;
}

export default function ChatPane({ initialMessages, onSessionCreated }: Props) {
  const { chatSessionId, setChatSessionId, selectedComponent } = useStore();
  const [messages, setMessages] = useState<ChatMessageType[]>(initialMessages || []);
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Use refs to accumulate stream data without React batching issues
  const streamTextRef = useRef("");
  const streamSourcesRef = useRef<ChatSource[] | undefined>(undefined);

  const scrollTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  // Debounce scroll during streaming to avoid 10+/sec layout thrashing
  useEffect(() => {
    clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(scrollToBottom, streamingText ? 80 : 0);
    return () => clearTimeout(scrollTimerRef.current);
  }, [messages, streamingText, scrollToBottom]);

  const sendMessage = async (text: string) => {
    const userMsg: ChatMessageType = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setStreamingText("");
    streamTextRef.current = "";
    streamSourcesRef.current = undefined;

    try {
      await streamChatMessage(
        {
          message: text,
          sessionId: chatSessionId || undefined,
          componentContext: selectedComponent || undefined,
        },
        {
          onMeta: (meta) => {
            // Tell ChatView this session was created here so it won't remount us
            if (!chatSessionId && meta.sessionId) {
              onSessionCreated?.(meta.sessionId);
            }
            setChatSessionId(meta.sessionId);
            streamSourcesRef.current = meta.sources;
          },
          onChunk: (chunk) => {
            streamTextRef.current += chunk;
            setStreamingText(streamTextRef.current);
          },
          onDone: () => {
            const finalText = streamTextRef.current;
            const finalSources = streamSourcesRef.current;

            // Clear streaming state first
            setStreamingText("");
            streamTextRef.current = "";

            // Add the completed message
            if (finalText) {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: finalText,
                  sources: finalSources,
                },
              ]);
            }
            setLoading(false);
          },
          onError: (err) => {
            console.error("Chat stream error:", err);
            setStreamingText("");
            streamTextRef.current = "";
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: "Sorry, I encountered an error processing your request." },
            ]);
            setLoading(false);
          },
        },
      );
    } catch (err) {
      console.error("Chat error:", err);
      setStreamingText("");
      streamTextRef.current = "";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error processing your request." },
      ]);
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

            {/* Streaming message — renders progressively */}
            {streamingText && (
              <ChatMessage
                message={{ role: "assistant", content: streamingText }}
              />
            )}

            {loading && !streamingText && <LoadingDots label="Thinking..." />}
          </div>
        )}
      </div>

      <ChatInput onSend={sendMessage} disabled={loading} />
    </div>
  );
}
