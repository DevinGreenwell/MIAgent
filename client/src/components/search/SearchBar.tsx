import { useState, useEffect } from "react";
import { useStore } from "../../store";

export default function SearchBar() {
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const [input, setInput] = useState(searchQuery);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(input), 300);
    return () => clearTimeout(timer);
  }, [input, setSearchQuery]);

  useEffect(() => {
    setInput(searchQuery);
  }, [searchQuery]);

  return (
    <div className="relative">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Search regulations, NVICs, policy letters..."
        className="w-full px-4 py-2 pl-10 border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
      />
      <svg className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      {input && (
        <button
          onClick={() => { setInput(""); setSearchQuery(""); }}
          className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      )}
    </div>
  );
}
