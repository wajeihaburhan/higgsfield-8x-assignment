"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Brush, Gem, Sparkles, X } from "lucide-react";
import { costOf } from "@/lib/catalog";
import type { InpaintMask } from "@/lib/types";
import { useStudio } from "@/store/useStudio";

type Rect = Omit<InpaintMask, "prompt">;

/** Draw a rectangular mask over the image and describe what should replace it. */
export function InpaintDialog() {
  const target = useStudio((s) => s.inpainting);
  const g = useStudio((s) => s.generations.find((x) => x.id === s.inpainting?.generationId));
  const credits = useStudio((s) => s.credits);
  const { closeInpaint, inpaint } = useStudio.getState();
  const o = g?.outputs.find((x) => x.id === target?.outputId);
  const box = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeInpaint();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, closeInpaint]);

  if (!g || !o || g.recipe.mode !== "image") return null;
  const cost = costOf(g.recipe, "inpaint");
  const point = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const canApply = !!rect && rect.w > 0.02 && rect.h > 0.02 && prompt.trim().length > 0 && cost <= credits;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={closeInpaint} role="dialog" aria-modal="true" aria-label="Inpaint">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong w-full max-w-3xl overflow-hidden rounded-2xl"
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Brush className="size-4 text-accent" />
          <span className="text-sm font-medium">Inpaint · {g.title}</span>
          <button onClick={closeInpaint} aria-label="Close" className="ml-auto grid size-8 place-items-center rounded-lg text-muted hover:text-fg">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-4">
          <div className="mb-2 font-mono text-[11px] text-faint">Drag over the area you want to change.</div>
          <div
            ref={box}
            className="relative mx-auto max-h-[55vh] w-fit cursor-crosshair touch-none select-none overflow-hidden rounded-xl"
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              start.current = point(e);
              setRect({ ...start.current, w: 0, h: 0 });
            }}
            onPointerMove={(e) => {
              if (!start.current) return;
              const p = point(e);
              const s = start.current;
              setRect({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
            }}
            onPointerUp={() => (start.current = null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={o.src} alt={g.title} draggable={false} className="block max-h-[55vh] w-auto" />
            {rect && rect.w > 0 && (
              <>
                <div className="pointer-events-none absolute inset-0 bg-slate-950/50" style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${rect.x * 100}% ${rect.y * 100}%, ${rect.x * 100}% ${(rect.y + rect.h) * 100}%, ${(rect.x + rect.w) * 100}% ${(rect.y + rect.h) * 100}%, ${(rect.x + rect.w) * 100}% ${rect.y * 100}%, ${rect.x * 100}% ${rect.y * 100}%)`, clipRule: "evenodd" }} />
                <div
                  className="pointer-events-none absolute rounded-md border-2 border-dashed border-accent bg-accent/10 shadow-[0_0_20px_rgb(0_245_255/0.4)]"
                  style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
                />
              </>
            )}
          </div>
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (canApply) inpaint(g.id, o.id, { ...rect!, prompt: prompt.trim() });
            }}
          >
            <input
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What should appear in the masked area? e.g. a red knitted scarf"
              aria-label="Inpaint prompt"
              className="h-10 flex-1 rounded-xl border border-line bg-surface-2/70 px-3 text-sm outline-none focus:border-accent"
            />
            <button type="submit" disabled={!canApply} className="btn-primary flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold">
              <Sparkles className="size-4" /> Inpaint
              <span className="flex items-center gap-0.5 rounded-md bg-black/15 px-1.5 py-0.5 font-mono text-xs">
                <Gem className="size-3" />
                {cost}
              </span>
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
