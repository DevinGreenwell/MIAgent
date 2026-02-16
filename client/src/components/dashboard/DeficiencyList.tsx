import { useState } from "react";
import type { ComponentDeficiency } from "../../types/components";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-900/30 border-red-700 text-red-200",
  serious: "bg-orange-900/30 border-orange-700 text-orange-200",
  moderate: "bg-yellow-900/30 border-yellow-700 text-yellow-200",
  minor: "bg-muted border-border text-foreground",
};

const SEVERITY_BADGES: Record<string, string> = {
  critical: "bg-red-600 text-white",
  serious: "bg-orange-500 text-white",
  moderate: "bg-yellow-500 text-white",
  minor: "bg-muted-foreground text-white",
};

export default function DeficiencyList({
  deficiencies,
}: {
  deficiencies: ComponentDeficiency[];
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-2">
        Common Deficiencies
      </h3>
      <div className="space-y-2">
        {deficiencies.map((d) => (
          <div
            key={d.id}
            className={`border rounded-lg p-3 ${
              SEVERITY_STYLES[d.severity] || SEVERITY_STYLES.minor
            }`}
          >
            <button
              onClick={() => setExpanded(expanded === d.id ? null : d.id)}
              className="w-full text-left flex items-start justify-between"
            >
              <div className="flex items-start gap-2">
                <span
                  className={`px-1.5 py-0.5 rounded text-xs font-bold shrink-0 ${
                    SEVERITY_BADGES[d.severity]
                  }`}
                >
                  {d.severity.toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-medium">{d.title}</p>
                  <p className="text-xs opacity-70">{d.code}</p>
                </div>
              </div>
              <span className="text-lg leading-none">
                {expanded === d.id ? "−" : "+"}
              </span>
            </button>
            {expanded === d.id && (
              <div className="mt-2 pt-2 border-t border-current/10 text-sm space-y-2">
                <p>{d.description}</p>
                {d.cfr_reference && (
                  <p>
                    <span className="font-medium">CFR Reference:</span>{" "}
                    {d.cfr_reference}
                  </p>
                )}
                <div>
                  <p className="font-medium">Remediation:</p>
                  <p>{d.remediation}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
