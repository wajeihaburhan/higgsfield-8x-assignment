"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Scan, ZoomIn, ZoomOut } from "lucide-react";
import { modelById } from "@/lib/catalog";
import { edgeLabel, layoutTree } from "@/lib/lineage";
import { progressOf, statusOf } from "@/lib/mock";
import type { Generation } from "@/lib/types";
import { useStudio } from "@/store/useStudio";

const NODE_W = 208;
const THUMB_H = 117; // 16:9 of NODE_W
const NODE_H = THUMB_H + 58;
const GAP_X = 96;
const GAP_Y = 28;
const PAD = 40;

/** Branching view of how prompts evolved: each column is one generation step, each edge says what changed. */
export function GraphView({ takes, matching, now }: { takes: Generation[]; matching: Set<string>; now: number }) {
  const { nodes, rows, cols } = useMemo(() => layoutTree(takes), [takes]);
  const byId = useMemo(() => new Map(takes.map((g) => [g.id, g])), [takes]);
  const selectedGen = useStudio((s) => s.selected?.generationId);
  const { select, deselect, openViewer } = useStudio.getState();

  const width = PAD * 2 + cols * NODE_W + Math.max(0, cols - 1) * GAP_X;
  const height = PAD * 2 + rows * NODE_H + Math.max(0, rows - 1) * GAP_Y;
  const pos = (col: number, row: number) => ({ x: PAD + col * (NODE_W + GAP_X), y: PAD + row * (NODE_H + GAP_Y) });

  const viewport = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const fit = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    // Fit the width, but never shrink below a readable scale; tall trees are panned vertically.
    const k = Math.max(0.7, Math.min(1, (el.clientWidth - 16) / width));
    setView({ k, x: Math.max(8, (el.clientWidth - width * k) / 2), y: Math.max(40, (el.clientHeight - height * k) / 2) });
  }, [width, height]);

  useEffect(() => {
    const t = setTimeout(fit, 0);
    return () => clearTimeout(t);
  }, [fit]);

  // Wheel zooms around the cursor (non-passive so the page doesn't scroll).
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setView((v) => {
        const k = Math.min(2, Math.max(0.3, v.k * Math.exp(-e.deltaY * 0.0015)));
        return { k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoom = (f: number) =>
    setView((v) => {
      const el = viewport.current!;
      const cx = el.clientWidth / 2;
      const cy = el.clientHeight / 2;
      const k = Math.min(2, Math.max(0.3, v.k * f));
      return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k };
    });

  return (
    <div className="glass relative h-[70vh] min-h-[420px] overflow-hidden rounded-2xl">
      <div
        ref={viewport}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        style={{
          backgroundImage: "radial-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1px)",
          backgroundSize: `${24 * view.k}px ${24 * view.k}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, moved: false };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
          d.x = e.clientX;
          d.y = e.clientY;
          setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d && !d.moved) {
            // A click, not a drag: hit-test the node under the pointer.
            const el = document.elementsFromPoint(e.clientX, e.clientY).find((n) => (n as HTMLElement).dataset?.node);
            const id = (el as HTMLElement | undefined)?.dataset.node;
            const g = id ? byId.get(id) : undefined;
            if (g) {
              if (e.detail >= 2 && now >= g.endAt) openViewer(g.id, g.outputs[0].id);
              else select(g.id, g.outputs[0].id);
            } else deselect();
          }
        }}
      >
        <div className="absolute left-0 top-0 origin-top-left" style={{ width, height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          <svg width={width} height={height} className="absolute inset-0 overflow-visible">
            {nodes.map(({ g, col, row }) => {
              const parent = g.parentId ? nodes.find((n) => n.g.id === g.parentId) : undefined;
              if (!parent) return null;
              const a = pos(parent.col, parent.row);
              const b = pos(col, row);
              const x1 = a.x + NODE_W;
              const y1 = a.y + THUMB_H / 2;
              const x2 = b.x;
              const y2 = b.y + THUMB_H / 2;
              const mx = (x1 + x2) / 2;
              const active = selectedGen === g.id || selectedGen === parent.g.id;
              const label = edgeLabel(parent.g, g);
              return (
                <g key={g.id} opacity={matching.has(g.id) ? 1 : 0.25}>
                  <motion.path
                    d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke={active ? "#c8ff00" : "rgb(255 255 255 / 0.22)"}
                    strokeWidth={active ? 2 : 1.5}
                    strokeDasharray={g.recipe.mode === "video" ? "0" : "5 5"}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                  <foreignObject x={mx - 40} y={(y1 + y2) / 2 - 11} width={80} height={22}>
                    <div className="flex h-full items-center justify-center">
                      <span className={`rounded-full border px-2 py-px font-mono text-[10px] ${active ? "border-accent bg-accent text-accent-fg" : "border-line-strong bg-bg text-muted"}`}>
                        {label}
                      </span>
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>

          {nodes.map(({ g, col, row }) => {
            const { x, y } = pos(col, row);
            const o = g.outputs[0];
            const done = statusOf(g, now) === "done";
            const selected = selectedGen === g.id;
            return (
              <motion.div
                key={g.id}
                data-node={g.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: matching.has(g.id) ? 1 : 0.3, scale: 1, x, y }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={`absolute left-0 top-0 overflow-hidden rounded-xl border bg-surface ${selected ? "border-accent glow-accent" : "border-line-strong"}`}
                style={{ width: NODE_W, height: NODE_H }}
              >
                <div data-node={g.id} className="relative bg-surface-2" style={{ height: THUMB_H }}>
                  {done ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img data-node={g.id} src={o.poster} alt={g.title} draggable={false} className="size-full object-cover" />
                  ) : (
                    <div data-node={g.id} className="sheen absolute inset-0 grid place-items-center">
                      <span className="font-mono text-lg text-accent">{Math.floor(progressOf(g.startAt, g.endAt, now) * 100)}%</span>
                    </div>
                  )}
                  <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-px font-mono text-[10px] text-white">
                    {g.recipe.mode === "video" && <Play className="size-2.5 fill-current" />}
                    {g.recipe.aspectRatio}
                  </span>
                  {g.outputs.length > 1 && (
                    <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-px font-mono text-[10px] text-white">×{g.outputs.length}</span>
                  )}
                </div>
                <div data-node={g.id} className="px-2.5 py-2">
                  <div data-node={g.id} className="truncate text-xs font-medium">
                    {g.title}
                  </div>
                  <div data-node={g.id} className="mt-0.5 flex items-center justify-between font-mono text-[10px] text-faint">
                    <span data-node={g.id}>#{g.n} · {modelById(g.recipe.modelId).name}</span>
                    <span data-node={g.id}>seed {String(g.recipe.seed).slice(-4)}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="absolute bottom-3 right-3 flex gap-1 rounded-xl border border-line bg-bg/80 p-1 backdrop-blur-md">
        <button onClick={() => zoom(1 / 1.2)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-fg" aria-label="Zoom out">
          <ZoomOut className="size-4" />
        </button>
        <span className="grid w-12 place-items-center font-mono text-[11px] tabular-nums text-muted">{Math.round(view.k * 100)}%</span>
        <button onClick={() => zoom(1.2)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-fg" aria-label="Zoom in">
          <ZoomIn className="size-4" />
        </button>
        <button onClick={fit} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-fg" aria-label="Fit to screen">
          <Scan className="size-4" />
        </button>
      </div>
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-line bg-bg/70 px-2.5 py-1.5 font-mono text-[10px] text-faint backdrop-blur-md">
        drag to pan · scroll to zoom · click a node to inspect · — video  - - image
      </div>
    </div>
  );
}
