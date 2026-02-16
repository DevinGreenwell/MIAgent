import type { ChatMessage as ChatMessageType } from "../../types/chat";
import SourceCitation from "./SourceCitation";

function FormattedContent({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return <h3 key={i} className="font-bold text-base mt-2">{line.slice(3)}</h3>;
        if (line.startsWith("### ")) return <h4 key={i} className="font-semibold text-sm mt-2">{line.slice(4)}</h4>;
        if (line.startsWith("- ")) return <li key={i} className="ml-4 list-disc"><InlineMarkdown text={line.slice(2)} /></li>;
        if (line.startsWith("| ")) return <p key={i} className="text-xs font-mono">{line}</p>;
        if (line.trim() === "") return <br key={i} />;
        return <p key={i}><InlineMarkdown text={line} /></p>;
      })}
    </div>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

export default function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
        isUser
          ? "bg-accent text-foreground"
          : "text-foreground"
      }`}>
        <div className="text-sm leading-relaxed">
          {isUser ? message.content : <FormattedContent text={message.content} />}
        </div>
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border flex flex-wrap gap-1">
            {message.sources.map((s) => (
              <SourceCitation key={s.id} source={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
