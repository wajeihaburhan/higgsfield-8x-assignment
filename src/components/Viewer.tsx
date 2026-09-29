"use client";

import { useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Gem, CornerDownRight, Download, Film, Repeat2, RotateCcw, Shuffle, X } from "lucide-react";
import { modelById, presetName } from "@/lib/catalog";
import { downloadOutput } from "@/lib/image";
import { useStudio } from "@/store/useStudio";
import { outputFilename, timeAgo } from "./Feed";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right tabular-nums">{children}</span>
    </div>
  );
}

export function Viewer({ now }: { now: number }) {
  const viewer = useStudio((s) => s.viewer);
  const generations = useStudio((s) => s.generations);
  const activeProjectId = useStudio((s) => s.activeProjectId);
  const credits = useStudio((s) => s.credits);
  const { closeViewer, openViewer, reuseRecipe, remix, vary } = useStudio.getState();

  // Every finished output in this project, newest first, for prev/next.
  const items = useMemo(
    () =>
      generations
        .filter((g) => g.projectId === activeProjectId)
        .flatMap((g) => g.outputs.filter((o) => now >= o.readyAt).map((o) => ({ g, o }))),
    [generations, activeProjectId, now]
  );
  const index = viewer ? items.findIndex((i) => i.o.id === viewer.outputId) : -1;
  const current = index >= 0 ? items[index] : null;

  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeViewer();
      const next = e.key === "ArrowRight" ? items[index + 1] : e.key === "ArrowLeft" ? items[index - 1] : null;
      if (next) openViewer(next.g.id, next.o.id);
    };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("overflow-hidden");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("overflow-hidden");
    };
  }, [viewer, items, index, closeViewer, openViewer]);

  if (!viewer || !current) return null;
  const { g, o } = current;
  const r = g.recipe;
  const parent = g.parentId ? generations.find((x) => x.id === g.parentId) : undefined;
  const prev = items[index - 1];
  const next = items[index + 1];

  const navBtn = (target: typeof prev, dir: "prev" | "next") =>
    target && (
      <button
        onClick={() => openViewer(target.g.id, target.o.id)}
        aria-label={dir === "prev" ? "Previous" : "Next"}
        className={`absolute top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/80 ${
          dir === "prev" ? "left-3" : "right-3"
        }`}
      >
        {dir === "prev" ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
      </button>
    );

  const action = (label: string, icon: React.ReactNode, onClick: () => void, primary = false, disabled = false, wide = false) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${wide ? "col-span-2 " : ""}flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium transition disabled:opacity-40 ${
        primary ? "bg-accent text-accent-fg hover:bg-accent-strong" : "border border-line-strong hover:bg-surface-2"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="fade-in fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm md:flex-row" role="dialog" aria-modal="true" aria-label={`Take ${g.n}`}>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3 pt-14 md:p-8" onClick={closeViewer}>
        <button
          onClick={closeViewer}
          aria-label="Close"
          className="absolute left-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 pt-[env(safe-area-inset-top)]"
        >
          <X className="size-5" />
        </button>
        {navBtn(prev, "prev")}
        {navBtn(next, "next")}
        <div className="reveal flex size-full items-center justify-center" key={o.id} onClick={(e) => e.stopPropagation()}>
          {o.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={o.src} alt={r.prompt} className="max-h-full max-w-full rounded-lg object-contain" />
          ) : (
            <video src={o.src} poster={o.poster} autoPlay loop controls playsInline className="max-h-full max-w-full rounded-lg" />
          )}
        </div>
      </div>

      <aside className="max-h-[48vh] shrink-0 overflow-y-auto border-t border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:max-h-none md:w-96 md:border-l md:border-t-0">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            <span className="font-medium text-fg">Take {g.n}</span> · {g.outputs.indexOf(o) + 1} of {g.outputs.length}
          </span>
          <span>{timeAgo(g.createdAt, now)}</span>
        </div>

        <h2 className="mt-3 text-xs font-medium uppercase tracking-widest text-faint">Prompt</h2>
        <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed">{r.prompt}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {action("Remix", <Repeat2 className="size-4" />, () => remix(g.id, o.id), true)}
          {o.kind === "image"
            ? action("Animate", <Film className="size-4" />, () => remix(g.id, o.id, true))
            : action("Use recipe", <RotateCcw className="size-4" />, () => reuseRecipe(g.id))}
          {o.kind === "image" && action("Use recipe", <RotateCcw className="size-4" />, () => reuseRecipe(g.id))}
          {action("Vary", <Shuffle className="size-4" />, () => vary(g.id), false, g.cost > credits)}
          {action("Download", <Download className="size-4" />, () => downloadOutput(o.src, outputFilename(g, o)), false, false, o.kind === "image")}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-faint">
          <b className="font-medium text-muted">Remix</b> uses this result as the reference. <b className="font-medium text-muted">Use recipe</b> restores
          every setting, including the seed. <b className="font-medium text-muted">Vary</b> reruns it with a new seed.
        </p>

        <h2 className="mt-6 text-xs font-medium uppercase tracking-widest text-faint">Recipe</h2>
        <div className="mt-1 divide-y divide-line">
          <Row label="Type">{r.mode === "image" ? "Image" : "Video"}</Row>
          <Row label="Model">{modelById(r.modelId).name}</Row>
          <Row label="Aspect ratio">{r.aspectRatio}</Row>
          {r.mode === "video" && <Row label="Duration">{r.durationSec}s</Row>}
          <Row label={r.mode === "image" ? "Style" : "Camera"}>{presetName(r.mode, r.presetId)}</Row>
          {r.mode === "image" && <Row label="Batch">×{r.count}</Row>}
          <Row label="Seed">
            <span className="font-mono text-xs">{r.seed}</span>
          </Row>
          <Row label="Cost">
            <span className="inline-flex items-center gap-1">
              <Gem className="size-3.5 text-accent" />
              {g.cost}
            </span>
          </Row>
          {r.reference && (
            <Row label="Reference">
              <span className="inline-flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.reference.src} alt="" className="size-8 rounded object-cover" />
                <span className="max-w-32 truncate">{r.reference.name}</span>
              </span>
            </Row>
          )}
          {parent && (
            <Row label="Derived from">
              <button
                onClick={() => parent.outputs[0] && openViewer(parent.id, parent.outputs[0].id)}
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                <CornerDownRight className="size-3.5" />
                Take {parent.n}
              </button>
            </Row>
          )}
        </div>
      </aside>
    </div>
  );
}
