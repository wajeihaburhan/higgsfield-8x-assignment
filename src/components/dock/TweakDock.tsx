"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Aperture, Braces, Check, Copy, Dices, Download, Film, Gem, GitFork, Heart, ImagePlus, Loader2, Maximize2, RotateCcw, Sparkles, X } from "lucide-react";
import { CAMERAS, costOf, DURATIONS, FPS_OPTIONS, IMAGE_ASPECTS, modelsFor, MOTION_MODELS, newSeed, RESOLUTIONS, SAMPLERS, STYLE_PRESETS, VIDEO_ASPECTS } from "@/lib/catalog";
import { outputFilename } from "@/lib/format";
import { extractFrames, formatTime, type ExtractedFrame } from "@/lib/frames";
import { downloadOutput } from "@/lib/image";
import type { Generation, ImageRecipe, Output, Recipe, VideoRecipe } from "@/lib/types";
import { useStudio } from "@/store/useStudio";
import { AspectPicker, ChipSelect, Label, Segmented, Slider } from "../ui/controls";

/** Recipe as display JSON: long data URLs are shortened so the config stays readable. */
function displayRecipe(r: Recipe) {
  const short = (v: unknown): unknown => {
    if (typeof v === "string" && v.startsWith("data:")) return `${v.slice(0, 26)}…`;
    if (Array.isArray(v)) return v.map(short);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, short(x)]));
    return v;
  };
  return short(r) as Record<string, unknown>;
}

function JsonView({ value, base }: { value: Recipe; base: Recipe }) {
  const shown = displayRecipe(value);
  const original = displayRecipe(base);
  const fmt = (v: unknown) => JSON.stringify(v, null, 2).replace(/\n/g, "\n  ");
  const color = (v: unknown) => (typeof v === "number" ? "text-emerald-300" : typeof v === "string" ? "text-cyan-100" : v === null ? "text-faint" : "text-fg");
  return (
    <pre className="no-scrollbar h-full overflow-auto rounded-xl border border-line bg-slate-950/60 p-3 font-mono text-[11.5px] leading-relaxed">
      <span className="text-faint">{"{"}</span>
      {"\n"}
      {Object.keys(shown).map((k, i, arr) => {
        const changed = JSON.stringify(shown[k]) !== JSON.stringify(original[k]);
        return (
          <span key={k} className={`block rounded ${changed ? "bg-accent/10" : ""}`}>
            {"  "}
            <span className={changed ? "text-accent" : "text-muted"}>&quot;{k}&quot;</span>
            <span className="text-faint">: </span>
            <span className={color(shown[k])}>{fmt(shown[k])}</span>
            {i < arr.length - 1 && <span className="text-faint">,</span>}
            {changed && <span className="ml-2 text-[10px] text-accent">● modified</span>}
          </span>
        );
      })}
      <span className="text-faint">{"}"}</span>
    </pre>
  );
}

function ImageTweaks({ r, patch }: { r: ImageRecipe; patch: (p: Partial<ImageRecipe>) => void }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <AspectPicker id="dock-img-ar" value={r.aspectRatio} onChange={(aspectRatio) => patch({ aspectRatio })} options={IMAGE_ASPECTS} />
        <Segmented id="dock-img-res" value={r.resolution} onChange={(resolution) => patch({ resolution })} options={RESOLUTIONS.map((x) => ({ value: x, label: x }))} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ChipSelect label="Model" value={r.modelId} onChange={(modelId) => patch({ modelId })} options={modelsFor("image").map((m) => ({ value: m.id, label: m.name }))} />
        <ChipSelect label="Sampler" value={r.sampler} onChange={(v) => patch({ sampler: v as ImageRecipe["sampler"] })} options={SAMPLERS.map((s) => ({ value: s.id, label: s.name }))} />
        <ChipSelect label="Style" value={r.stylePreset} onChange={(stylePreset) => patch({ stylePreset })} options={STYLE_PRESETS.map((p) => ({ value: p.id, label: p.name }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label hint={r.steps}>Steps</Label>
          <Slider label="Steps" value={r.steps} min={10} max={60} onChange={(steps) => patch({ steps })} />
        </div>
        <div>
          <Label hint={r.cfg.toFixed(1)}>CFG</Label>
          <Slider label="Guidance" value={r.cfg} min={1} max={15} step={0.5} onChange={(cfg) => patch({ cfg })} />
        </div>
      </div>
    </>
  );
}

function VideoTweaks({ r, patch }: { r: VideoRecipe; patch: (p: Partial<VideoRecipe>) => void }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <AspectPicker id="dock-vid-ar" value={r.aspectRatio} onChange={(aspectRatio) => patch({ aspectRatio })} options={VIDEO_ASPECTS} />
        <Segmented id="dock-vid-dur" value={r.durationSec} onChange={(durationSec) => patch({ durationSec })} options={DURATIONS.map((x) => ({ value: x, label: `${x}s` }))} />
        <Segmented id="dock-vid-fps" value={r.fps} onChange={(fps) => patch({ fps })} options={FPS_OPTIONS.map((x) => ({ value: x, label: `${x}` }))} size="sm" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ChipSelect label="Model" value={r.modelId} onChange={(modelId) => patch({ modelId })} options={modelsFor("video").map((m) => ({ value: m.id, label: m.name }))} />
        <ChipSelect label="Camera" value={r.camera} onChange={(v) => patch({ camera: v as VideoRecipe["camera"] })} options={CAMERAS.map((c) => ({ value: c.id, label: c.name }))} />
        <ChipSelect label="Motion vectors" value={r.motionModel} onChange={(motionModel) => patch({ motionModel })} options={MOTION_MODELS.map((m) => ({ value: m.id, label: m.name }))} />
      </div>
      <div>
        <Label hint={r.motion}>Motion intensity</Label>
        <Slider label="Motion intensity" value={r.motion} min={0} max={100} onChange={(motion) => patch({ motion })} />
      </div>
    </>
  );
}

/** Filmstrip of frames pulled from the clip; each can become a keyframe, a style reference, or a download. */
function FrameStrip({ g, o }: { g: Generation; o: Output }) {
  const [frames, setFrames] = useState<ExtractedFrame[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { setKeyframe, addStyleRef, showToast } = useStudio.getState();
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    extractFrames(o.src, 5)
      .then((f) => alive && setFrames(f))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [o.src]);

  const ref = (f: ExtractedFrame) => ({ src: f.src, name: `${g.title} @ ${formatTime(f.time)}` });

  return (
    <div>
      <Label hint={frames ? `${frames.length} frames` : undefined}>
        <span className="inline-flex items-center gap-1.5">
          <Aperture className="size-3" /> Frame extraction
        </span>
      </Label>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {(frames ?? Array.from({ length: 5 }, () => null)).map((f, i) => (
          <div key={i} className="group relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-2">
            {f ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.src} alt={`Frame at ${formatTime(f.time)}`} className="size-full object-cover" />
                <span className="absolute left-1 top-1 rounded bg-slate-950/70 px-1 font-mono text-[9px] text-white">{formatTime(f.time)}</span>
                <div className="absolute inset-0 flex flex-wrap content-end gap-1 bg-slate-950/70 p-1 opacity-0 transition group-hover:opacity-100 max-sm:opacity-100">
                  <button onClick={() => (setKeyframe("startFrame", ref(f)), showToast({ message: "Set as start frame", thumb: f.src }))} className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-fg">Start</button>
                  <button onClick={() => (setKeyframe("endFrame", ref(f)), showToast({ message: "Set as end frame", thumb: f.src }))} className="rounded bg-success px-1.5 py-0.5 text-[10px] font-medium text-accent-fg">End</button>
                  <button
                    onClick={() => {
                      addStyleRef(ref(f));
                      showToast({ message: "Sent to Image Studio as a style reference", thumb: f.src, action: { label: "Open Image Studio", run: () => router.push("/image") } });
                    }}
                    className="grid size-5 place-items-center rounded bg-white/15 text-white"
                    aria-label="Send to Image Studio"
                    title="Send to Image Studio"
                  >
                    <ImagePlus className="size-3" />
                  </button>
                  <button onClick={() => downloadOutput(f.src, `${outputFilename(g, o).replace(/\.mp4$/, "")}-${i + 1}.jpg`)} className="grid size-5 place-items-center rounded bg-white/15 text-white" aria-label="Download frame">
                    <Download className="size-3" />
                  </button>
                </div>
              </>
            ) : (
              <div className="sheen grid size-full place-items-center">
                <Loader2 className="size-4 animate-spin text-faint" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DockBody({ g, o }: { g: Generation; o: Output }) {
  const { deselect, submit, reuseRecipe, openViewer, toggleFavorite, loadRecipe, animate } = useStudio.getState();
  const credits = useStudio((s) => s.credits);
  const favorite = useStudio((s) => s.generations.find((x) => x.id === g.id)?.favorite);
  const [recipe, setRecipe] = useState<Recipe>(g.recipe);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const patch = (p: Partial<Recipe>) => setRecipe((r) => ({ ...r, ...p }) as Recipe);
  // Remixing from the drawer is a fresh generation, not the one-click op that made this take.
  const cost = costOf(recipe);
  const dirty = JSON.stringify(recipe) !== JSON.stringify(g.recipe);

  const run = () => {
    // An untouched recipe would reproduce the same take, so give it a fresh seed.
    const r = dirty ? recipe : { ...recipe, seed: newSeed() };
    if (submit(r.mode, { recipe: r, parentId: g.id, op: null })) deselect();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(displayRecipe(recipe), null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  return (
    <div className="flex max-h-[68vh] flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={o.poster} alt="" className="h-10 w-16 shrink-0 rounded-md object-cover" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{g.title}</div>
          <div className="truncate font-mono text-[11px] text-faint">
            {g.recipe.mode} #{g.n} · by {g.author.name} · {g.tags.join(" · ")}
          </div>
        </div>
        <button onClick={() => toggleFavorite(g.id)} aria-label="Favorite" className={`grid size-9 place-items-center rounded-lg ${favorite ? "text-accent" : "text-muted hover:text-fg"}`}>
          <Heart className={`size-4 ${favorite ? "fill-current" : ""}`} />
        </button>
        <button onClick={() => downloadOutput(o.src, outputFilename(g, o))} aria-label="Download" className="grid size-9 place-items-center rounded-lg text-muted hover:text-fg">
          <Download className="size-4" />
        </button>
        <button onClick={() => openViewer(g.id, o.id)} aria-label="Open full screen" className="grid size-9 place-items-center rounded-lg text-muted hover:text-fg">
          <Maximize2 className="size-4" />
        </button>
        <button onClick={deselect} aria-label="Close" className="grid size-9 place-items-center rounded-lg text-muted hover:text-fg">
          <X className="size-4" />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <Label>Parameter remix</Label>
          <textarea
            value={recipe.prompt}
            onChange={(e) => patch({ prompt: e.target.value })}
            rows={2}
            aria-label="Prompt"
            className="w-full resize-none rounded-xl border border-line bg-surface-2/70 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {recipe.mode === "image" ? (
            <ImageTweaks r={recipe} patch={patch as (p: Partial<ImageRecipe>) => void} />
          ) : (
            <VideoTweaks r={recipe} patch={patch as (p: Partial<VideoRecipe>) => void} />
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <motion.button whileTap={{ scale: 0.96 }} onClick={run} disabled={cost > credits || !recipe.prompt.trim()} className="btn-primary flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold">
              <Sparkles className="size-4" />
              {dirty ? "Remix with changes" : "Remix now"}
              <span className="flex items-center gap-0.5 rounded-md bg-black/15 px-1.5 py-0.5 font-mono text-xs">
                <Gem className="size-3" />
                {cost}
              </span>
            </motion.button>
            <button onClick={() => patch({ seed: newSeed() })} className="flex h-10 items-center gap-1.5 rounded-xl border border-line-strong px-3 font-mono text-xs text-muted hover:text-fg" title="New seed">
              <Dices className="size-4" /> {recipe.seed}
            </button>
            <button onClick={() => loadRecipe(dirty ? recipe : { ...recipe, seed: newSeed() }, g.id)} className="flex h-10 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-sm hover:bg-white/5" title="Load into the composer">
              <GitFork className="size-4" /> Fork to composer
            </button>
            <button onClick={() => reuseRecipe(g.id)} className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm text-muted hover:text-fg" title="Exact recipe, same seed">
              <RotateCcw className="size-4" /> Exact
            </button>
            {o.kind === "image" && (
              <button
                onClick={() => {
                  animate(g.id, o.id);
                  router.push("/video");
                }}
                className="flex h-10 items-center gap-1.5 rounded-xl border border-success/40 px-3 text-sm text-success hover:bg-success/10"
                title="Open Video Studio with this image as the start frame"
              >
                <Film className="size-4" /> Animate
              </button>
            )}
          </div>
        </div>

        <div className="flex min-h-48 flex-col gap-3">
          {o.kind === "video" && <FrameStrip g={g} o={o} />}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-faint">
                <Braces className="size-3" /> recipe.json {dirty && <span className="text-accent">· edited</span>}
              </span>
              <div className="flex gap-1">
                {dirty && (
                  <button onClick={() => setRecipe(g.recipe)} className="h-7 rounded-md px-2 font-mono text-[11px] text-muted hover:text-fg">
                    reset
                  </button>
                )}
                <button onClick={copy} className="flex h-7 items-center gap-1 rounded-md px-2 font-mono text-[11px] text-muted hover:text-fg">
                  {copied ? <Check className="size-3 text-accent" /> : <Copy className="size-3" />}
                  {copied ? "copied" : "copy"}
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 md:max-h-72">
              <JsonView value={recipe} base={g.recipe} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TweakDock({ now }: { now: number }) {
  const selected = useStudio((s) => s.selected);
  const g = useStudio((s) => s.generations.find((x) => x.id === s.selected?.generationId));
  const o = g?.outputs.find((x) => x.id === selected?.outputId) ?? g?.outputs[0];
  const ready = !!o && now >= o.readyAt;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {g && o && ready && (
        <motion.div
          key={g.id}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
          className="glass-strong pointer-events-auto mx-auto max-w-6xl overflow-hidden rounded-2xl shadow-[0_-12px_60px_-12px_rgb(0_0_0/0.8)]"
          role="dialog"
          aria-label={`Remix ${g.title}`}
        >
          <DockBody key={o.id} g={g} o={o} />
        </motion.div>
      )}
    </div>
  );
}
