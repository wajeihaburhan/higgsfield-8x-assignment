"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Film, ImageIcon, Loader2, Maximize2, SlidersHorizontal } from "lucide-react";
import { modelById } from "@/lib/catalog";
import { lookStyle, primaryRef, progressOf, statusOf } from "@/lib/mock";
import type { Generation, Mode } from "@/lib/types";
import { useStudio } from "@/store/useStudio";
import { RECENT_MS, useStudioNow } from "../shell/StudioShell";

function stageLabel(g: Generation, now: number) {
  const status = statusOf(g, now);
  if (status === "queued") return "In queue";
  if (status === "done") return "Ready";
  const verb = g.op === "upscale" ? "Upscaling" : g.op === "inpaint" ? "Inpainting" : g.op === "variations" ? "Varying" : "Rendering";
  const p = progressOf(g.startAt, g.endAt, now);
  if (g.recipe.mode === "video") {
    const frames = g.recipe.durationSec * g.recipe.fps;
    return `${verb} · frame ${Math.floor(p * frames)}/${frames}`;
  }
  return `${verb} · step ${Math.floor(p * g.recipe.steps)}/${g.recipe.steps}`;
}

function QueueItem({ g, now }: { g: Generation; now: number }) {
  const { openViewer, select } = useStudio.getState();
  const status = statusOf(g, now);
  const done = status === "done";
  const p = done ? 1 : progressOf(g.startAt, g.endAt, now);
  const eta = Math.max(0, Math.ceil((g.endAt - now) / 1000));
  const o = g.outputs[0];
  const ref = primaryRef(g.recipe);
  const Icon = g.recipe.mode === "video" ? Film : ImageIcon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={`glass flex w-full min-w-0 items-center gap-3 rounded-xl p-2 pr-3 sm:w-[360px] ${done ? "border-success/40" : "border-accent/30"}`}
      role="status"
      aria-label={`${g.title}: ${stageLabel(g, now)}`}
    >
      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-2">
        {done ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={o.poster} alt="" className="size-full object-cover" style={lookStyle(o.look)} />
        ) : (
          <div className="sheen absolute inset-0">
            {ref && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ref.src} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-30 blur-md" />
            )}
            <div className="absolute inset-0 grid place-items-center">
              <Loader2 className="size-5 animate-spin text-accent" />
            </div>
          </div>
        )}
        <span className="absolute bottom-1 left-1 grid size-5 place-items-center rounded bg-slate-950/70 text-white">
          <Icon className="size-3" />
        </span>
        {g.outputs.length > 1 && <span className="absolute right-1 top-1 rounded bg-slate-950/70 px-1 font-mono text-[9px] text-white">×{g.outputs.length}</span>}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{g.title}</span>
          {done && <Check className="size-3.5 shrink-0 text-success" />}
        </div>
        <div className={`mt-0.5 truncate font-mono text-[11px] ${done ? "text-success" : "text-muted"}`}>
          {stageLabel(g, now)}
          {!done && <span className="text-faint"> · ~{eta}s</span>}
          {done && <span className="text-faint"> · {modelById(g.recipe.modelId).name}</span>}
        </div>
        {done ? (
          <div className="mt-1.5 flex gap-1.5">
            <button onClick={() => openViewer(g.id, o.id)} className="flex h-6 items-center gap-1 rounded-md bg-accent px-2 text-[11px] font-semibold text-accent-fg">
              <Maximize2 className="size-3" /> View
            </button>
            <button onClick={() => select(g.id, o.id)} className="flex h-6 items-center gap-1 rounded-md border border-line-strong px-2 text-[11px] text-muted hover:text-fg">
              <SlidersHorizontal className="size-3" /> Remix
            </button>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-gradient-to-r from-accent to-success shadow-[0_0_10px_rgb(16_185_129/0.7)] transition-[width] duration-150 ease-linear" style={{ width: `${p * 100}%` }} />
            </div>
            <span className="w-8 text-right font-mono text-[11px] tabular-nums text-success">{Math.floor(p * 100)}%</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * "Now rendering" tray shown above the composer, so a new job is visible the moment Generate is pressed
 * (the feed below may be off-screen). Finished takes linger briefly with View / Remix, then slide away.
 * Without `mode` it shows jobs from both studios (Showcase).
 */
export function RenderQueue({ mode }: { mode?: Mode }) {
  const now = useStudioNow();
  const generations = useStudio((s) => s.generations);
  const activeProjectId = useStudio((s) => s.activeProjectId);

  const items = generations
    .filter((g) => g.projectId === activeProjectId && (!mode || g.recipe.mode === mode))
    .filter((g) => statusOf(g, now) !== "done" || now - g.endAt < RECENT_MS)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-6);
  const running = items.filter((g) => statusOf(g, now) !== "done").length;

  return (
    <AnimatePresence initial={false}>
      {items.length > 0 && (
        <motion.section
          key="queue"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
          aria-label="Generation queue"
        >
          <div className="mb-3 pt-1">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
              {running > 0 ? (
                <>
                  <span className="size-1.5 animate-pulse rounded-full bg-success" />
                  <span className="text-success">Now rendering · {running}</span>
                </>
              ) : (
                <span className="text-faint">Just finished</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <AnimatePresence initial={false} mode="popLayout">
                {items.map((g) => (
                  <QueueItem key={g.id} g={g} now={now} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
