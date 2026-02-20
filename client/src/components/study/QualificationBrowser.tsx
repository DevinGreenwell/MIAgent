import {
  DOMESTIC_QUALS,
  FOREIGN_QUALS,
  QUAL_BY_ID,
  type QualificationDef,
} from "../../lib/qualifications";

interface Props {
  selected: QualificationDef | null;
  onSelect: (qual: QualificationDef) => void;
}

export default function QualificationBrowser({ selected, onSelect }: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const qual = QUAL_BY_ID.get(e.target.value);
    if (qual) onSelect(qual);
  };

  return (
    <div className="p-3 border-b border-border">
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
        Qualification
      </label>
      <select
        value={selected?.id ?? ""}
        onChange={handleChange}
        className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="" disabled>
          Select a qualification...
        </option>
        <optgroup label="Domestic">
          {DOMESTIC_QUALS.map((q) => (
            <option key={q.id} value={q.id}>
              {q.id} — {q.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Foreign / International">
          {FOREIGN_QUALS.map((q) => (
            <option key={q.id} value={q.id}>
              {q.id} — {q.label}
            </option>
          ))}
        </optgroup>
      </select>
      {selected && (
        <p className="mt-1.5 text-xs text-muted-foreground leading-tight truncate" title={selected.fullName}>
          {selected.fullName}
        </p>
      )}
    </div>
  );
}
