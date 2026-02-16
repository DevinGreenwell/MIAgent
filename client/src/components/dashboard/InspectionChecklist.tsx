import { useState } from "react";

export default function InspectionChecklist({ notes }: { notes: string }) {
  const items = notes.split("\n").filter((line) => line.trim());
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const progress = items.length > 0 ? Math.round((checked.size / items.length) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">
          Inspection Checklist
        </h3>
        <span className="text-xs text-muted-foreground">
          {checked.size}/{items.length}
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 mb-3">
        <div
          className="bg-green-500 h-1.5 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <label
            key={i}
            className="flex items-start gap-2 cursor-pointer group"
          >
            <input
              type="checkbox"
              checked={checked.has(i)}
              onChange={() => toggle(i)}
              className="mt-0.5 rounded border-border"
            />
            <span
              className={`text-sm ${
                checked.has(i)
                  ? "line-through text-muted-foreground"
                  : "text-foreground"
              }`}
            >
              {item}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
