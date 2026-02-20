/** Shared mobile pane toggle tabs — hidden on md+ screens. */

interface Tab {
  id: string;
  label: string;
}

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export default function MobilePaneTabs({ tabs, active, onChange }: Props) {
  return (
    <div className="flex gap-1 border-b border-border bg-card p-2 md:hidden">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
            active === tab.id
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-accent"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
