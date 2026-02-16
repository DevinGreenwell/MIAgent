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
      className="px-2 py-1 border border-border rounded text-sm bg-input text-foreground"
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
  const { filters, setFilter, clearFilters } = useStore();
  const { data: collections } = useCollections();
  const { data: topics } = useTopics();
  const { data: vessels } = useVesselTypes();

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex items-center gap-2 flex-wrap">
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
