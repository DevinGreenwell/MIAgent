import { useState, useRef, useCallback, useEffect } from "react";
import { streamStudyContent, type StudyMetadata } from "../../api/study";
import type { QualificationDef } from "../../lib/qualifications";
import type { StudyContentItem, FlashcardItem, QuizItem, ScenarioItem, SlideshowItem } from "../../types/study";
import StudyToolbar from "./StudyToolbar";
import LoadingDots from "../ui/LoadingDots";

interface Props {
  qual: QualificationDef | null;
  loadedContent?: { contentType: string; content: string } | null;
  onGenerationComplete?: (id: number | null) => void;
  selectedDocIds?: string[];
}

// ── Content type renderers ──────────────────────────────────────────────

function FlashcardRenderer({ data }: { data: FlashcardItem[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = data[index];
  if (!card) return null;

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="text-xs text-muted-foreground">
        {index + 1} / {data.length}
      </div>
      <button
        onClick={() => setFlipped(!flipped)}
        className="w-full max-w-lg min-h-[200px] rounded-xl border border-border bg-card p-6 text-center transition-all hover:border-primary/50 hover:shadow-lg"
      >
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          {flipped ? "Answer" : "Question"}
        </div>
        <div className="text-sm leading-relaxed text-foreground">
          {flipped ? card.back : card.front}
        </div>
        {flipped && card.citation && (
          <div className="mt-3 text-xs text-primary">{card.citation}</div>
        )}
      </button>
      <div className="flex gap-2 text-xs text-muted-foreground">
        Click card to flip
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => { setIndex(Math.max(0, index - 1)); setFlipped(false); }}
          disabled={index === 0}
          className="rounded-md bg-muted px-3 py-1.5 text-sm text-foreground disabled:opacity-30"
        >
          Previous
        </button>
        <button
          onClick={() => { setIndex(Math.min(data.length - 1, index + 1)); setFlipped(false); }}
          disabled={index === data.length - 1}
          className="rounded-md bg-muted px-3 py-1.5 text-sm text-foreground disabled:opacity-30"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function QuizRenderer({ data }: { data: QuizItem[] }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  return (
    <div className="space-y-6 p-4">
      {data.map((q, qi) => (
        <div key={qi} className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 text-sm font-medium text-foreground">
            {qi + 1}. {q.question}
          </div>
          <div className="space-y-1.5">
            {q.options.map((opt, oi) => {
              const selected = answers[qi] === oi;
              const isRevealed = revealed.has(qi);
              const isCorrect = oi === q.answer;
              let optionClass = "border-border bg-muted/30 text-foreground hover:bg-accent";
              if (isRevealed && isCorrect) optionClass = "border-green-600 bg-green-900/20 text-green-300";
              else if (isRevealed && selected && !isCorrect) optionClass = "border-red-600 bg-red-900/20 text-red-300";
              else if (selected) optionClass = "border-primary bg-primary/10 text-foreground";

              return (
                <button
                  key={oi}
                  onClick={() => !isRevealed && setAnswers({ ...answers, [qi]: oi })}
                  className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${optionClass}`}
                >
                  <span className="shrink-0 font-mono text-xs">{String.fromCharCode(65 + oi)}</span>
                  {opt}
                </button>
              );
            })}
          </div>
          {answers[qi] !== undefined && !revealed.has(qi) && (
            <button
              onClick={() => setRevealed(new Set([...revealed, qi]))}
              className="mt-3 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Check Answer
            </button>
          )}
          {revealed.has(qi) && (
            <div className="mt-3 rounded-md bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
              {q.explanation}
              {q.citation && <span className="ml-1 text-primary">({q.citation})</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ScenarioRenderer({ data }: { data: ScenarioItem[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    const next = new Set(expanded);
    if (next.has(i)) next.delete(i); else next.add(i);
    setExpanded(next);
  };

  return (
    <div className="space-y-4 p-4">
      {data.map((s, i) => (
        <div key={i} className="rounded-lg border border-border bg-card overflow-hidden">
          <button
            onClick={() => toggle(i)}
            className="flex w-full items-center justify-between p-4 text-left"
          >
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-primary mb-1">Scenario {i + 1}</div>
              <div className="text-sm font-medium text-foreground">{s.title}</div>
            </div>
            <svg
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded.has(i) ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expanded.has(i) && (
            <div className="border-t border-border p-4 space-y-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Situation</div>
                <p className="text-sm leading-relaxed text-foreground">{s.situation}</p>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Expected Actions</div>
                <ul className="space-y-1">
                  {s.expectedActions.map((a, ai) => (
                    <li key={ai} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-primary mt-0.5">-</span> {a}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Key Regulations</div>
                <div className="flex flex-wrap gap-1.5">
                  {s.keyRegs.map((r, ri) => (
                    <span key={ri} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{r}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SlideshowRenderer({ data }: { data: SlideshowItem[] }) {
  const [index, setIndex] = useState(0);
  const slide = data[index];
  if (!slide) return null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Slide {index + 1} of {data.length}</span>
        <div className="flex gap-1">
          {data.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 w-6 rounded-full transition-colors ${i === index ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">{slide.title}</h3>
        <ul className="space-y-2">
          {slide.bullets.map((b, bi) => (
            <li key={bi} className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              {b}
            </li>
          ))}
        </ul>
        {slide.speakerNotes && (
          <div className="mt-4 rounded-md bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold">Notes:</span> {slide.speakerNotes}
          </div>
        )}
        {slide.citations && slide.citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {slide.citations.map((c, ci) => (
              <span key={ci} className="text-xs text-primary">{c}</span>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-center gap-2">
        <button
          onClick={() => setIndex(Math.max(0, index - 1))}
          disabled={index === 0}
          className="rounded-md bg-muted px-4 py-1.5 text-sm text-foreground disabled:opacity-30"
        >
          Previous
        </button>
        <button
          onClick={() => setIndex(Math.min(data.length - 1, index + 1))}
          disabled={index === data.length - 1}
          className="rounded-md bg-muted px-4 py-1.5 text-sm text-foreground disabled:opacity-30"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ── Main StudyContent component ─────────────────────────────────────────

export default function StudyContent({ qual, loadedContent, onGenerationComplete, selectedDocIds }: Props) {
  const [contentType, setContentType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [parsedContent, setParsedContent] = useState<StudyContentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamTextRef = useRef("");
  const metaRef = useRef<StudyMetadata | null>(null);

  const resetContent = useCallback(() => {
    setParsedContent(null);
    setStreamingText("");
    setError(null);
    streamTextRef.current = "";
  }, []);

  // Reset when qual changes
  useEffect(() => {
    resetContent();
  }, [qual?.id, resetContent]);

  // Load content from history selection
  useEffect(() => {
    if (!loadedContent) return;
    resetContent();
    setContentType(loadedContent.contentType);

    try {
      const jsonMatch = loadedContent.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        setParsedContent(JSON.parse(jsonMatch[0]));
      } else {
        setError("Could not parse loaded content.");
      }
    } catch {
      setError("Failed to parse loaded content.");
    }
  }, [loadedContent, resetContent]);

  const handleSelectType = (type: string) => {
    setContentType(type);
    resetContent();
  };

  const handleGenerate = async () => {
    if (!qual || !contentType) return;

    setLoading(true);
    setError(null);
    setParsedContent(null);
    setStreamingText("");
    streamTextRef.current = "";

    try {
      await streamStudyContent(
        {
          qualId: qual.id,
          contentType,
          documentIds: selectedDocIds?.length ? selectedDocIds : undefined,
        },
        {
          onMeta: (meta) => {
            metaRef.current = meta;
          },
          onChunk: (chunk) => {
            streamTextRef.current += chunk;
            setStreamingText(streamTextRef.current);
          },
          onDone: (result) => {
            const raw = streamTextRef.current;
            setStreamingText("");
            streamTextRef.current = "";

            // Parse the JSON content
            try {
              const jsonMatch = raw.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                setParsedContent(JSON.parse(jsonMatch[0]));
              } else {
                setError("Could not parse generated content. Raw response saved.");
              }
            } catch {
              setError("Failed to parse generated content.");
            }

            setLoading(false);
            onGenerationComplete?.(result.id);
          },
          onError: (err) => {
            setError(err.message);
            setStreamingText("");
            streamTextRef.current = "";
            setLoading(false);
          },
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (!parsedContent || !contentType) return null;

    switch (contentType) {
      case "flashcards":
        return <FlashcardRenderer data={parsedContent as FlashcardItem[]} />;
      case "quiz":
        return <QuizRenderer data={parsedContent as QuizItem[]} />;
      case "scenario":
        return <ScenarioRenderer data={parsedContent as ScenarioItem[]} />;
      case "slideshow":
        return <SlideshowRenderer data={parsedContent as SlideshowItem[]} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <StudyToolbar
        contentType={contentType}
        onSelect={handleSelectType}
        onGenerate={handleGenerate}
        loading={loading}
        hasQual={!!qual}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        {!qual && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-4">
            Select a qualification to begin studying
          </div>
        )}

        {qual && !contentType && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-4">
            Choose a content type above, then click Generate
          </div>
        )}

        {qual && contentType && !loading && !parsedContent && !error && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-4">
            Click Generate to create {contentType} for {qual.label}
          </div>
        )}

        {/* Streaming indicator */}
        {loading && streamingText && (
          <div className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating {contentType}...
            </div>
            <div className="rounded-lg bg-muted/30 p-3 font-mono text-xs text-muted-foreground max-h-40 overflow-auto whitespace-pre-wrap">
              {streamingText.slice(-500)}
            </div>
          </div>
        )}

        {/* Loading without stream text yet */}
        {loading && !streamingText && (
          <div className="flex h-full items-center justify-center">
            <LoadingDots label={`Preparing ${contentType}...`} />
          </div>
        )}

        {error && (
          <div className="p-4">
            <div className="rounded-lg border border-red-800/50 bg-red-900/20 p-3 text-sm text-red-300">
              {error}
            </div>
          </div>
        )}

        {renderContent()}
      </div>
    </div>
  );
}
