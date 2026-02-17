import { useStore } from "../../store";

const NAV_ITEMS = [
  { id: "chat" as const, label: "Chat" },
  { id: "viewer" as const, label: "Inspect" },
  { id: "search" as const, label: "Documents" },
];

export default function Header() {
  const { activeView, setActiveView } = useStore();

  return (
    <header className="bg-sidebar px-4 py-2 flex items-center border-b border-border shrink-0">
      <h1 className="text-lg font-bold text-foreground">MIAgent</h1>

      <nav className="flex gap-1 mx-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
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
