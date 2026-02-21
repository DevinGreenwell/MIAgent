import { useStore } from "../../store";
import { useCollections, useTopics, useVesselTypes } from "../../api/hooks";

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: Array<{ value: string; label: string; count?: number }>;
}) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      className="w-full px-2 py-1 border border-border rounded text-sm bg-input text-foreground"
      title={label}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}{o.count !== undefined ? ` (${o.count})` : ""}
        </option>
      ))}
    </select>
  );
}

export default function FilterPanel() {
  const filters = useStore((s) => s.filters);
  const setFilter = useStore((s) => s.setFilter);
  const clearFilters = useStore((s) => s.clearFilters);
  const { data: collections } = useCollections();
  const { data: topics } = useTopics();
  const { data: vessels } = useVesselTypes();

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-col gap-2">
      {filters.collection && (
        <button
          onClick={() => setFilter("collection", undefined)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          title="Back to collections"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Collections
        </button>
      )}
      <FilterSelect
        label="All Collections"
        value={filters.collection}
        onChange={(v) => setFilter("collection", v)}
        options={(collections?.data || []).map((c) => ({ value: c.slug, label: c.name, count: c.doc_count }))}
      />
      <FilterSelect
        label="All Topics"
        value={filters.topic}
        onChange={(v) => setFilter("topic", v)}
        options={(topics?.data || []).map((t) => ({ value: t.slug, label: t.name, count: t.doc_count }))}
      />
      <FilterSelect
        label="All Vessel Types"
        value={filters.vessel}
        onChange={(v) => setFilter("vessel", v)}
        options={(vessels?.data || []).map((v) => ({ value: v.slug, label: v.name, count: v.doc_count }))}
      />
      {hasFilters && (
        <button onClick={clearFilters} className="text-sm text-destructive hover:underline">
          Clear filters
        </button>
      )}
    </div>
  );
}
