import type { Generation, Op } from "./types";

const OP_LABEL: Record<Op, string> = { upscale: "Upscale", variations: "Variation", inpaint: "Inpaint", animate: "Animate", remix: "Remix" };

/** Short label for what changed between a take and the take it came from. */
export function edgeLabel(parent: Generation, child: Generation) {
  if (child.op) return OP_LABEL[child.op];
  const a = parent.recipe as unknown as Record<string, unknown>;
  const b = child.recipe as unknown as Record<string, unknown>;
  const names: Record<string, string> = {
    prompt: "Prompt", modelId: "Model", aspectRatio: "Reframe", stylePreset: "Style", sampler: "Sampler", steps: "Steps",
    cfg: "CFG", resolution: "Resolution", negativePrompt: "Negative", durationSec: "Retime", motion: "Motion",
    camera: "Camera", fps: "FPS", motionModel: "Vectors", startFrame: "Keyframe", endFrame: "Keyframe",
  };
  const changed = Object.keys(names).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  if (changed.length === 0) return a.seed === b.seed ? "Rerun" : "Vary";
  if (changed.length === 1) return names[changed[0]];
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
