import { useStore } from "../../store";

const NAV_ITEMS = [
  { id: "chat" as const, label: "Chat" },
  { id: "viewer" as const, label: "Inspect" },
  { id: "study" as const, label: "Study" },
  { id: "search" as const, label: "References" },
];

export default function Header() {
  const activeView = useStore((s) => s.activeView);
  const setActiveView = useStore((s) => s.setActiveView);

  return (
    <header className="bg-sidebar px-3 md:px-4 py-2 flex flex-col gap-2 sm:flex-row sm:items-center border-b border-border shrink-0">
      <h1 className="text-base sm:text-lg font-bold text-foreground sm:shrink-0">MIAgent</h1>

      <nav className="flex gap-1 w-full sm:w-auto sm:mx-auto overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex-1 sm:flex-none ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
