import { useStore } from "../../store";

const GENERAL_SUGGESTIONS = [
  "I'm inspecting a T-boat's engine room — what should I focus on?",
  "What's the enforcement guidance for an expired fire extinguisher on a foreign tank vessel?",
  "Walk me through bilge system inspection requirements under 46 CFR",
  "Help me write up a deficiency for a missing oily water separator record book",
];

const COMPONENT_SUGGESTIONS: Record<string, string[]> = {
  default: [
    "What are the inspection requirements for this component?",
    "What deficiencies should I look for here?",
    "Which CFR sections apply to this component?",
  ],
};

export default function ChatSuggestions({ onSelect }: { onSelect: (text: string) => void }) {
  const { selectedComponent } = useStore();

  const suggestions = selectedComponent
    ? COMPONENT_SUGGESTIONS[selectedComponent] || COMPONENT_SUGGESTIONS.default
    : GENERAL_SUGGESTIONS;

  return (
    <div className="text-center space-y-6 py-8">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">MIAgent</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {selectedComponent
            ? "Ask about this component"
            : "Your most experienced OCMI — ask about regulations, inspections, or deficiencies"}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className="text-left px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-xl hover:bg-accent transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
