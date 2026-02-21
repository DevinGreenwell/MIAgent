import { useMemo, useState, useCallback } from "react";
import { useStore } from "../../store";
import { LAYOUT } from "./componentRegistry";
import { useGltfParts, type GltfPart } from "./useGltfParts";

interface TreeNode {
  part: GltfPart & { displayName: string };
  children: TreeNode[];
}

/** Build a tree from the flat depth-ordered parts list. */
function buildTree(parts: (GltfPart & { displayName: string })[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const stack: TreeNode[] = [];

  for (const part of parts) {
    const node: TreeNode = { part, children: [] };

    // Pop stack until we find a parent at a shallower depth
    while (stack.length > 0 && stack[stack.length - 1].part.depth >= part.depth) {
      stack.pop();
    }

    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node);
    } else {
      roots.push(node);
    }

    stack.push(node);
  }

  return roots;
}

function TreeItem({
  node,
  selectedSubComponent,
  onSelect,
  defaultExpanded,
}: {
  node: TreeNode;
  selectedSubComponent: string | null;
  onSelect: (name: string | null) => void;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedSubComponent === node.part.name;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) {
            setExpanded(!expanded);
          }
          onSelect(isSelected ? null : node.part.name);
        }}
        className={`flex items-center gap-1.5 w-full text-left text-xs py-1.5 pr-3 transition-colors ${
          isSelected
            ? "bg-accent text-foreground font-medium"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        }`}
        style={{ paddingLeft: `${12 + node.part.depth * 12}px` }}
      >
        {hasChildren ? (
          <svg
            className={`w-3 h-3 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        ) : (
          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-current opacity-40 ml-[3px] mr-[3px]" />
        )}
        <span className="truncate">{node.part.displayName}</span>
        <span className="ml-auto text-[10px] text-muted-foreground/60 tabular-nums shrink-0">
          {node.part.meshCount}
        </span>
      </button>

      {hasChildren && expanded && (
        <div>
          {node.children.map((child, i) => (
            <TreeItem
              key={`${child.part.name}-${i}`}
              node={child}
              selectedSubComponent={selectedSubComponent}
              onSelect={onSelect}
              defaultExpanded={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PartTreeContent({ model, targetSize, targetHeight }: {
  model: string;
  targetSize: [number, number, number];
  targetHeight?: number;
}) {
  const selectedSubComponent = useStore((s) => s.selectedSubComponent);
  const setSelectedSubComponent = useStore((s) => s.setSelectedSubComponent);
  const { parts } = useGltfParts(model, targetSize, targetHeight);

  const tree = useMemo(() => {
    // Deduplicate display names
    const nameCounts = new Map<string, number>();
    for (const p of parts) {
      nameCounts.set(p.name, (nameCounts.get(p.name) || 0) + 1);
    }
    const nameIndex = new Map<string, number>();
    const displayParts = parts.map((p) => {
      const total = nameCounts.get(p.name) || 1;
      if (total > 1) {
        const idx = (nameIndex.get(p.name) || 0) + 1;
        nameIndex.set(p.name, idx);
        return { ...p, displayName: `${p.name} #${idx}` };
      }
      return { ...p, displayName: p.name };
    });

    return buildTree(displayParts);
  }, [parts]);

  if (tree.length === 0) return null;

  const handleSelect = useCallback(
    (name: string | null) => setSelectedSubComponent(name),
    [setSelectedSubComponent],
  );

  return (
    <div className="py-2">
      <div className="flex items-center justify-between px-3 pb-2">
        <p className="text-sm font-semibold text-foreground">
          Parts
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            ({parts.length})
          </span>
        </p>
        {selectedSubComponent && (
          <button
            onClick={() => setSelectedSubComponent(null)}
            className="text-xs text-primary hover:underline"
          >
            Show All
          </button>
        )}
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {tree.map((node, i) => (
          <TreeItem
            key={`${node.part.name}-${i}`}
            node={node}
            selectedSubComponent={selectedSubComponent}
            onSelect={handleSelect}
            defaultExpanded={tree.length === 1}
          />
        ))}
      </div>
    </div>
  );
}

export default function ModelPartTree() {
  const selectedComponent = useStore((s) => s.selectedComponent);

  if (!selectedComponent) return null;

  const entry = LAYOUT[selectedComponent];
  if (!entry?.model) return null;

  return (
    <PartTreeContent
      model={entry.model}
      targetSize={entry.size}
      targetHeight={entry.modelHeight}
    />
  );
}
