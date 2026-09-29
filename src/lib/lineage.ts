import type { Generation } from "./types";

/** Short label for what changed between a take and the take it came from. */
export function edgeLabel(parent: Generation, child: Generation) {
  const a = parent.recipe;
  const b = child.recipe;
  if (a.mode === "image" && b.mode === "video") return "Animate";
  if (b.reference?.sourceKey && parent.outputs.some((o) => o.key === b.reference?.sourceKey) && b.prompt !== a.prompt)
    return "Remix";
  const changed = (["prompt", "modelId", "aspectRatio", "presetId", "mode"] as const).filter((k) => a[k] !== b[k]);
  if (changed.length === 0) return a.seed === b.seed ? "Rerun" : "Vary";
  if (changed.length === 1) return { prompt: "Prompt", modelId: "Model", aspectRatio: "Reframe", presetId: "Style", mode: "Mode" }[changed[0]];
  return "Fork";
}

export interface NodePos {
  g: Generation;
  col: number;
  row: number;
}

/** Left-to-right tree layout: depth is the column, leaves get consecutive rows, parents center on children. */
export function layoutTree(takes: Generation[]): { nodes: NodePos[]; rows: number; cols: number } {
  const ids = new Set(takes.map((g) => g.id));
  const children = new Map<string, Generation[]>();
  const roots: Generation[] = [];
  for (const g of [...takes].sort((a, b) => a.createdAt - b.createdAt)) {
    if (g.parentId && ids.has(g.parentId)) {
      children.set(g.parentId, [...(children.get(g.parentId) ?? []), g]);
    } else roots.push(g);
  }
  const nodes: NodePos[] = [];
  let nextRow = 0;
  let cols = 0;
  const place = (g: Generation, col: number): number => {
    cols = Math.max(cols, col + 1);
    const kids = children.get(g.id) ?? [];
    const row = kids.length === 0 ? nextRow++ : (() => {
      const rows = kids.map((k) => place(k, col + 1));
      return (Math.min(...rows) + Math.max(...rows)) / 2;
    })();
    nodes.push({ g, col, row });
    return row;
  };
  // Newest trees first, matching the grid's ordering.
  for (const r of roots.reverse()) place(r, 0);
  return { nodes, rows: nextRow, cols };
}
