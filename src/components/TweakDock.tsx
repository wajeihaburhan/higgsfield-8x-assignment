"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Braces, Check, Copy, Dices, Download, Film, Gem, GitFork, Heart, ImageIcon, Maximize2, Repeat2, Sparkles, X } from "lucide-react";
import { costOf, DURATIONS, MODELS, newSeed, PRESETS } from "@/lib/catalog";
import { outputFilename } from "@/lib/format";
import { downloadOutput } from "@/lib/image";
import type { Generation, Output, Recipe } from "@/lib/types";
import { useStudio } from "@/store/useStudio";
import { AspectPicker, ChipSelect } from "./Composer";

/** Recipe as display JSON: long data URLs are shortened so the config stays readable. */
function displayRecipe(r: Recipe) {
  const ref = r.reference && {
    ...r.reference,
    src: r.reference.src.startsWith("data:") ? `${r.reference.src.slice(0, 28)}…` : r.reference.src,
  };
  return { ...r, reference: ref };
}

function JsonView({ value, base }: { value: Recipe; base: Recipe }) {
  const shown = displayRecipe(value) as Record<string, unknown>;
  const original = displayRecipe(base) as Record<string, unknown>;
  const fmt = (v: unknown) => JSON.stringify(v, null, 2).replace(/\n/g, "\n  ");
  const color = (v: unknown) => (typeof v === "number" ? "text-emerald-300" : typeof v === "string" ? "text-cyan-100" : v === null ? "text-faint" : "text-fg");
  return (
    <pre className="no-scrollbar h-full overflow-auto rounded-xl border border-line bg-black/40 p-3 font-mono text-[11.5px] leading-relaxed">
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

function DockBody({ g, o }: { g: Generation; o: Output }) {
  const { deselect, submit, reuseRecipe, remix, openViewer, toggleFavorite, loadRecipe } = useStudio.getState();
  const credits = useStudio((s) => s.credits);
  const favorite = useStudio((s) => s.generations.find((x) => x.id === g.id)?.favorite);
  const [recipe, setRecipe] = useState<Recipe>(g.recipe);
  const [copied, setCopied] = useState(false);
  const patch = (p: Partial<Recipe>) => setRecipe((r) => ({ ...r, ...p }));
  const cost = costOf(recipe);
  const dirty = JSON.stringify(recipe) !== JSON.stringify(g.recipe);

  const setMode = (mode: Recipe["mode"]) =>
    mode !== recipe.mode &&
    patch({
      mode,
      presetId: PRESETS[mode][0].id,
      count: 1,
      // Animating a still uses it as the reference so the subject carries over.
      reference: mode === "video" && recipe.mode === "image" ? { src: o.poster, name: g.title, sourceKey: o.key } : recipe.reference,
    });

  const run = () => {
    // Re-running an untouched recipe would reproduce the same take, so give it a fresh seed.
    const r = dirty ? recipe : { ...recipe, seed: newSeed() };
    if (submit(r, g.id)) deselect();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(displayRecipe(recipe), null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  return (
    <div className="flex max-h-[62vh] flex-col md:max-h-none">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={o.poster} alt="" className="h-10 w-16 shrink-0 rounded-md object-cover" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{g.title}</div>
          <div className="truncate font-mono text-[11px] text-faint">
            take #{g.n} · by {g.author.name} · {g.tags.join(" · ")}
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

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[1fr_1.1fr] md:overflow-visible">
        <div className="space-y-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-faint">Quick tweak</div>
          <textarea
            value={recipe.prompt}
            onChange={(e) => patch({ prompt: e.target.value })}
            rows={2}
            className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-surface-2 p-0.5">
              {(["video", "image"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs ${recipe.mode === m ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}
                >
                  {m === "video" ? <Film className="size-3.5" /> : <ImageIcon className="size-3.5" />}
                  {m === "video" ? "Video" : "Image"}
                </button>
              ))}
            </div>
            <AspectPicker value={recipe.aspectRatio} onChange={(aspectRatio) => patch({ aspectRatio })} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ChipSelect label="Model" value={recipe.modelId} onChange={(modelId) => patch({ modelId })} options={MODELS.map((m) => ({ value: m.id, label: m.name }))} />
            <ChipSelect label="Preset" value={recipe.presetId} onChange={(presetId) => patch({ presetId })} options={PRESETS[recipe.mode].map((p) => ({ value: p.id, label: p.name }))} />
            {recipe.mode === "video" && (
              <ChipSelect label="Duration" value={String(recipe.durationSec)} onChange={(v) => patch({ durationSec: Number(v) })} options={DURATIONS.map((d) => ({ value: String(d), label: `${d}s` }))} />
            )}
            <button onClick={() => patch({ seed: newSeed() })} className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 font-mono text-xs text-muted hover:text-fg" title="New seed">
              <Dices className="size-3.5" />
              {recipe.seed}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={run}
              disabled={cost > credits || !recipe.prompt.trim()}
              className="flex h-10 items-center gap-2 rounded-xl btn-primary px-4 text-sm font-semibold"
            >
              <Sparkles className="size-4" />
              {dirty ? "Remix with changes" : "Remix now"}
              <span className="flex items-center gap-0.5 rounded-md bg-black/15 px-1.5 py-0.5 font-mono text-xs">
                <Gem className="size-3" />
                {cost}
              </span>
            </motion.button>
            <button onClick={() => remix(g.id, o.id)} className="flex h-10 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-sm hover:bg-white/5" title="Use this result as the reference image">
              <Repeat2 className="size-4" /> Use as reference
            </button>
            <button onClick={() => loadRecipe(dirty ? recipe : { ...recipe, seed: newSeed() }, g.id)} className="flex h-10 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-sm hover:bg-white/5" title="Load into the composer">
              <GitFork className="size-4" /> To composer
            </button>
            <button onClick={() => reuseRecipe(g.id)} className="h-10 rounded-xl px-3 text-sm text-muted hover:text-fg" title="Exact recipe, same seed">
              Exact recipe
            </button>
          </div>
        </div>

        <div className="flex min-h-48 flex-col">
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
          <div className="min-h-0 flex-1 md:max-h-64">
            <JsonView value={recipe} base={g.recipe} />
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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:pl-[calc(var(--sidebar-w)+1.5rem)]">
      {g && o && ready && (
        <motion.div
          key={g.id}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
          className="pointer-events-auto mx-auto max-w-5xl overflow-hidden rounded-2xl glass-strong shadow-[0_-12px_60px_-12px_rgb(0_0_0/0.8)]"
          role="dialog"
          aria-label={`Tweak ${g.title}`}
        >
          <DockBody key={o.id} g={g} o={o} />
        </motion.div>
      )}
    </div>
  );
}
