interface Props {
  children: React.ReactNode;
  layout: "single" | "two-col";
}

const LAYOUTS: Record<string, string> = {
  single: "grid-cols-1",
  "two-col": "grid-cols-[1fr_1fr]",
};

export default function PaneContainer({ children, layout }: Props) {
  return (
    <div className={`grid h-full ${LAYOUTS[layout]} divide-x divide-border`}>
      {children}
    </div>
  );
}
