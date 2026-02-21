import { useStore } from "../../store";
import { useDocuments, useSearch } from "../../api/hooks";

export default function Pagination() {
  const searchQuery = useStore((s) => s.searchQuery);
  const filters = useStore((s) => s.filters);
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);

  const params = { ...filters, page, limit: 25 };
  const { data } = searchQuery
    ? useSearch({ ...params, q: searchQuery })
    : useDocuments(params);

  const pagination = data?.pagination;
  if (!pagination || pagination.pages <= 1) return null;

  const { pages, total } = pagination;
  const range: number[] = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) {
    range.push(i);
  }

  return (
    <div className="px-3 md:px-4 py-2 border-t border-border flex items-center justify-between gap-2 text-xs sm:text-sm">
      <span className="text-muted-foreground hidden sm:inline">{total} documents</span>
      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={() => setPage(page - 1)}
          disabled={page <= 1}
          className="px-2 py-1 rounded hover:bg-accent disabled:opacity-30 text-foreground"
        >
          ‹
        </button>
        {range[0] > 1 && <span className="px-1 text-muted-foreground">...</span>}
        {range.map((p) => (
          <button
            key={p}
            onClick={() => setPage(p)}
            className={`px-2 py-1 rounded ${
              p === page ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground"
            }`}
          >
            {p}
          </button>
        ))}
        {range[range.length - 1] < pages && <span className="px-1 text-muted-foreground">...</span>}
        <button
          onClick={() => setPage(page + 1)}
          disabled={page >= pages}
          className="px-2 py-1 rounded hover:bg-accent disabled:opacity-30 text-foreground"
        >
          ›
        </button>
      </div>
    </div>
  );
}
