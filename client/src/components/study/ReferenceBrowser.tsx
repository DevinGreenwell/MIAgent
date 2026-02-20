import { useState, useRef, useEffect, useCallback } from "react";
import type { StudyReference } from "../../api/study";
import { PART_TO_SUBCHAPTER, extractCfrPartNumber } from "../../lib/cfrSubchapters";
import { formatDocId } from "../../lib/documents";
import { COLLECTION_COLORS } from "../../lib/documents";

interface Props {
  references: StudyReference[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  loading: boolean;
}

// ── Tree data structure ──────────────────────────────────────────────────

interface TreeNode {
  label: string;
  docIds: string[];          // leaf document_ids under this node
  children: TreeNode[];
}

function buildTree(refs: StudyReference[]): TreeNode[] {
  const cfrRefs: StudyReference[] = [];
  const otherByCollection = new Map<string, StudyReference[]>();

  for (const ref of refs) {
    if (ref.collection_id === "cfr") {
      cfrRefs.push(ref);
    } else {
      const arr = otherByCollection.get(ref.collection_id) || [];
      arr.push(ref);
      otherByCollection.set(ref.collection_id, arr);
    }
  }

  const roots: TreeNode[] = [];

  // CFR grouped by subchapter then part
  if (cfrRefs.length > 0) {
    const subchapterMap = new Map<string, Map<number, StudyReference[]>>();

    for (const ref of cfrRefs) {
      const partNum = extractCfrPartNumber(ref.document_id);
      const subchapter = partNum !== null ? (PART_TO_SUBCHAPTER.get(partNum) ?? "Other") : "Other";
      if (!subchapterMap.has(subchapter)) subchapterMap.set(subchapter, new Map());
      const partMap = subchapterMap.get(subchapter)!;
      const key = partNum ?? 0;
      if (!partMap.has(key)) partMap.set(key, []);
      partMap.get(key)!.push(ref);
    }

    const cfrChildren: TreeNode[] = [];
    const sortedSubchapters = [...subchapterMap.entries()].sort(([a], [b]) => a.localeCompare(b));

    for (const [subchapter, partMap] of sortedSubchapters) {
      const partChildren: TreeNode[] = [];
      const sortedParts = [...partMap.entries()].sort(([a], [b]) => a - b);
      for (const [, partRefs] of sortedParts) {
        for (const ref of partRefs) {
          partChildren.push({
            label: formatDocId(ref.document_id),
            docIds: [ref.document_id],
            children: [],
          });
        }
      }
      cfrChildren.push({
        label: `Subchapter ${subchapter}`,
        docIds: partChildren.flatMap((c) => c.docIds),
        children: partChildren,
      });
    }

    roots.push({
      label: "46 CFR",
      docIds: cfrChildren.flatMap((c) => c.docIds),
      children: cfrChildren,
    });
  }

  // Non-CFR grouped by collection_id
  const collOrder = ["nvic", "prg", "mtn", "policy-letter", "imo", "class-rules", "msm", "io-guidance"];
  const sortedColls = [...otherByCollection.entries()].sort(
    ([a], [b]) => (collOrder.indexOf(a) === -1 ? 99 : collOrder.indexOf(a)) - (collOrder.indexOf(b) === -1 ? 99 : collOrder.indexOf(b))
  );

  for (const [collId, collRefs] of sortedColls) {
    const children: TreeNode[] = collRefs.map((ref) => ({
      label: formatDocId(ref.document_id),
      docIds: [ref.document_id],
      children: [],
    }));
    roots.push({
      label: collId.toUpperCase().replace(/-/g, " "),
      docIds: children.flatMap((c) => c.docIds),
      children,
    });
  }

  return roots;
}

// ── Three-state checkbox ─────────────────────────────────────────────────

type CheckState = "checked" | "unchecked" | "indeterminate";

function ThreeStateCheckbox({ state, onChange }: { state: CheckState; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = state === "indeterminate";
    }
  }, [state]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={state === "checked"}
      onChange={onChange}
      className="h-3.5 w-3.5 shrink-0 rounded border-border accent-primary cursor-pointer"
    />
  );
}

// ── Tree node component ──────────────────────────────────────────────────

function TreeNodeView({
  node,
  selectedIds,
  onToggle,
  depth,
}: {
  node: TreeNode;
  selectedIds: Set<string>;
  onToggle: (docIds: string[], checked: boolean) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isLeaf = node.children.length === 0;

  const checkedCount = node.docIds.filter((id) => selectedIds.has(id)).length;
  const state: CheckState =
    checkedCount === 0 ? "unchecked" : checkedCount === node.docIds.length ? "checked" : "indeterminate";

  const handleCheck = () => {
    onToggle(node.docIds, state !== "checked");
  };

  const collId = isLeaf ? node.label.split(" ")[0]?.toLowerCase() : null;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-0.5 hover:bg-accent/50 rounded-sm cursor-pointer ${
          depth === 0 ? "pr-1" : ""
        }`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        {!isLeaf ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground"
          >
            <svg
              className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <ThreeStateCheckbox state={state} onChange={handleCheck} />
        <span
          className={`text-xs leading-tight truncate ${
            isLeaf ? "text-foreground" : "font-medium text-foreground"
          }`}
          title={node.label}
        >
          {node.label}
        </span>
        {isLeaf && collId && COLLECTION_COLORS[collId] && (
          <span className={`ml-auto shrink-0 rounded px-1 py-0.5 text-[9px] font-medium border ${COLLECTION_COLORS[collId]}`}>
            {collId.toUpperCase()}
          </span>
        )}
        {!isLeaf && (
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
            {checkedCount}/{node.docIds.length}
          </span>
        )}
      </div>
      {expanded && !isLeaf && (
        <div>
          {node.children.map((child, i) => (
            <TreeNodeView
              key={i}
              node={child}
              selectedIds={selectedIds}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ReferenceBrowser ────────────────────────────────────────────────

export default function ReferenceBrowser({ references, selectedIds, onSelectionChange, loading }: Props) {
  const tree = buildTree(references);
  const allDocIds = references.map((r) => r.document_id);

  const handleToggle = useCallback(
    (docIds: string[], checked: boolean) => {
      const next = new Set(selectedIds);
      for (const id of docIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      onSelectionChange(next);
    },
    [selectedIds, onSelectionChange],
  );

  const handleSelectAll = () => onSelectionChange(new Set(allDocIds));
  const handleClearAll = () => onSelectionChange(new Set());

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading references...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="border-b border-border p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">References</h2>
          {references.length > 0 && (
            <div className="flex gap-1.5">
              <button
                onClick={handleSelectAll}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
              >
                Select All
              </button>
              <button
                onClick={handleClearAll}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
        {references.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {selectedIds.size}/{references.length} selected
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {references.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            Select a qualification to see available reference documents.
          </div>
        ) : (
          <div className="p-1">
            {tree.map((node, i) => (
              <TreeNodeView
                key={i}
                node={node}
                selectedIds={selectedIds}
                onToggle={handleToggle}
                depth={0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
