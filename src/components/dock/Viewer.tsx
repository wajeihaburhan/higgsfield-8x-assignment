"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Brush, ChevronLeft, ChevronRight, Copy, CornerDownRight, Download, Film, Gem, RotateCcw, Shuffle, Sparkles, X } from "lucide-react";
import { cameraOf, modelById, motionModelName, samplerName, stylePreset } from "@/lib/catalog";
import { outputFilename, timeAgo } from "@/lib/format";
import { downloadOutput } from "@/lib/image";
import { lookStyle } from "@/lib/mock";
import type { Screen } from "@/lib/types";
import { useStudio } from "@/store/useStudio";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right tabular-nums">{children}</span>
    </div>
  );
}

export function Viewer({ now, screen }: { now: number; screen: Screen }) {
  const viewer = useStudio((s) => s.viewer);
  const generations = useStudio((s) => s.generations);
  const activeProjectId = useStudio((s) => s.activeProjectId);
  const credits = useStudio((s) => s.credits);
  const { closeViewer, openViewer, reuseRecipe, vary, upscale, variations, openInpaint, animate } = useStudio.getState();
  const router = useRouter();

  // Every finished output on this screen, in the order it's shown (Showcase: images, then videos), for prev/next.
  const items = useMemo(() => {
    const takes = generations.filter((g) => g.projectId === activeProjectId && (screen === "showcase" || g.recipe.mode === screen));
    const ordered = screen === "showcase" ? [...takes.filter((g) => g.recipe.mode === "image"), ...takes.filter((g) => g.recipe.mode === "video")] : takes;
    return ordered.flatMap((g) => g.outputs.filter((o) => now >= o.readyAt).map((o) => ({ g, o })));
  }, [generations, activeProjectId, screen, now]);
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
        className={`absolute top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-slate-950/60 text-white backdrop-blur hover:bg-slate-950/90 ${dir === "prev" ? "left-3" : "right-3"}`}
      >
        {dir === "prev" ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
      </button>
    );

  const action = (label: string, icon: React.ReactNode, onClick: () => void, primary = false, disabled = false) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium transition disabled:opacity-40 ${primary ? "btn-primary" : "border border-line-strong hover:bg-white/5"}`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm md:flex-row" role="dialog" aria-modal="true" aria-label={g.title}>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3 pt-14 md:p-8" onClick={closeViewer}>
        <button onClick={closeViewer} aria-label="Close" className="absolute left-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
          <X className="size-5" />
        </button>
        {navBtn(prev, "prev")}
        {navBtn(next, "next")}
        <div className="flex size-full items-center justify-center overflow-hidden" key={o.id} onClick={(e) => e.stopPropagation()}>
          {o.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={o.src} alt={r.prompt} className="max-h-full max-w-full rounded-lg object-contain" style={lookStyle(o.look)} />
          ) : (
            <video src={o.src} poster={o.poster} autoPlay loop controls playsInline className="max-h-full max-w-full rounded-lg" style={lookStyle(o.look)} />
          )}
        </div>
      </div>

      <aside className="glass-strong max-h-[48vh] shrink-0 overflow-y-auto border-x-0 border-b-0 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:max-h-none md:w-96 md:border-y-0 md:border-r-0">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            <span className="font-medium text-fg">{g.title}</span> · #{g.n} · {g.outputs.indexOf(o) + 1}/{g.outputs.length}
          </span>
          <span>{timeAgo(g.createdAt, now)}</span>
        </div>

        <h2 className="mt-3 font-mono text-[10px] uppercase tracking-widest text-faint">Prompt</h2>
        <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed">{r.prompt}</p>
        {r.mode === "image" && r.negativePrompt && (
          <p className="mt-2 text-xs text-muted">
            <span className="text-red-300/80">Negative:</span> {r.negativePrompt}
          </p>
        )}
        {r.mode === "image" && r.inpaint && (
          <p className="mt-2 text-xs text-success">Inpainted: “{r.inpaint.prompt}”</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          {r.mode === "image" ? (
            <>
              {action("Upscale", <Sparkles className="size-4" />, () => upscale(g.id, o.id), true)}
              {action("Variations", <Copy className="size-4" />, () => variations(g.id, o.id))}
              {action("Inpaint", <Brush className="size-4" />, () => openInpaint(g.id, o.id))}
              {action("Animate", <Film className="size-4" />, () => (animate(g.id, o.id), router.push("/video")))}
            </>
          ) : (
            <>
              {action("Vary", <Shuffle className="size-4" />, () => vary(g.id), true, g.cost > credits)}
              {action("Exact recipe", <RotateCcw className="size-4" />, () => reuseRecipe(g.id))}
            </>
          )}
          <div className="col-span-2">{action("Download", <Download className="size-4" />, () => downloadOutput(o.src, outputFilename(g, o)))}</div>
        </div>

        <h2 className="mt-6 font-mono text-[10px] uppercase tracking-widest text-faint">Recipe</h2>
        <div className="mt-1 divide-y divide-line">
          <Row label="Model">{modelById(r.modelId).name}</Row>
          <Row label="Aspect ratio">{r.aspectRatio}</Row>
          {r.mode === "image" ? (
            <>
              <Row label="Resolution">{r.resolution}</Row>
              <Row label="Sampler">{samplerName(r.sampler)}</Row>
              <Row label="Steps / CFG">
                {r.steps} / {r.cfg}
              </Row>
              <Row label="Style">{stylePreset(r.stylePreset).name}</Row>
              {r.styleRefs.length > 0 && (
                <Row label="References">
                  <span className="inline-flex gap-1">
                    {r.styleRefs.map((ref, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={ref.src} alt={ref.name} title={`${ref.role} · ${Math.round(ref.weight * 100)}%`} className="size-8 rounded object-cover" />
                    ))}
                  </span>
                </Row>
              )}
            </>
          ) : (
            <>
              <Row label="Duration">
                {r.durationSec}s · {r.fps}fps
              </Row>
              <Row label="Camera">{cameraOf(r.camera).name}</Row>
              <Row label="Motion">{r.motion}/100</Row>
              <Row label="Motion vectors">{motionModelName(r.motionModel)}</Row>
              {(r.startFrame || r.endFrame) && (
                <Row label="Keyframes">
                  <span className="inline-flex gap-1">
                    {[r.startFrame, r.endFrame].map(
                      (f, i) =>
                        f && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={f.src} alt={f.name} title={i === 0 ? "Start" : "End"} className="h-8 w-12 rounded object-cover" />
                        )
                    )}
                  </span>
                </Row>
              )}
            </>
          )}
          <Row label="Seed">
            <span className="font-mono text-xs">{r.seed}</span>
          </Row>
          <Row label="Cost">
            <span className="inline-flex items-center gap-1">
              <Gem className="size-3.5 text-accent" />
              {g.cost}
            </span>
          </Row>
          {parent && (
            <Row label="Derived from">
              <button onClick={() => openViewer(parent.id, parent.outputs[0].id)} className="inline-flex items-center gap-1 text-accent hover:underline">
                <CornerDownRight className="size-3.5" />
                {parent.title}
              </button>
            </Row>
          )}
        </div>
      </aside>
    </div>
  );
}
