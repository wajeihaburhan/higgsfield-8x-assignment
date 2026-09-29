"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Dices, Lock, Minus, Plus, Unlock } from "lucide-react";
import { IMAGE_ASPECTS, MAX_COUNT, MAX_STYLE_REFS, REF_ROLES, RESOLUTIONS, SAMPLERS, STYLE_PRESETS, newSeed } from "@/lib/catalog";
import { fileToReference } from "@/lib/image";
import type { RefRole, StyleRef } from "@/lib/types";
import { useStudio } from "@/store/useStudio";
import { AspectPicker, ChipSelect, Label, ModelBar, RefSlot, Segmented, Slider } from "../ui/controls";
import { PromptBox } from "./PromptBox";

export function SeedField({ mode }: { mode: "image" | "video" }) {
  const seed = useStudio((s) => s.drafts[mode].seed);
  const locked = useStudio((s) => s.seedLocked[mode]);
  const setDraft = useStudio((s) => s.setDraft);
  const setSeedLocked = useStudio((s) => s.setSeedLocked);
  return (
    <div>
      <Label hint={locked ? "locked" : "re-rolls each run"}>Seed</Label>
      <div className="flex gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          aria-label="Seed"
          value={seed}
          onChange={(e) => setDraft(mode, { seed: Math.max(0, Math.min(999999, Number(e.target.value) || 0)) })}
          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface-2/70 px-3 font-mono text-sm tabular-nums outline-none focus:border-accent"
        />
        <button onClick={() => setDraft(mode, { seed: newSeed() })} className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-accent" aria-label="Random seed" title="Random seed">
          <Dices className="size-4" />
        </button>
        <button
          onClick={() => setSeedLocked(mode, !locked)}
          aria-pressed={locked}
          className={`grid size-9 place-items-center rounded-lg border ${locked ? "border-accent/60 bg-accent/10 text-accent" : "border-line text-muted hover:text-fg"}`}
          aria-label={locked ? "Unlock seed" : "Lock seed"}
          title={locked ? "Seed is kept between runs" : "Keep this seed between runs"}
        >
          {locked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function StyleRefSlots() {
  const refs = useStudio((s) => s.drafts.image.styleRefs);
  const setDraft = useStudio((s) => s.setDraft);
  const update = (i: number, next: StyleRef | null) => {
    const copy = [...refs];
    if (next) copy[i] = next;
    else copy.splice(i, 1);
    setDraft("image", { styleRefs: copy });
  };
  return (
    <div>
      <Label hint={`${refs.length}/${MAX_STYLE_REFS} · +1 credit each`}>Style & control references</Label>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: MAX_STYLE_REFS }, (_, i) => {
          const r = refs[i];
          const disabled = i > refs.length;
          return (
            <RefSlot
              key={i}
              label={i === 0 ? "Reference" : `Slot ${i + 1}`}
              value={r ?? null}
              className={`aspect-square ${disabled ? "pointer-events-none opacity-40" : ""}`}
              onChange={(ref) => update(i, ref ? { ...ref, role: r?.role ?? "style", weight: r?.weight ?? 0.7 } : null)}
            >
              {r && (
                <div className="mt-1.5 space-y-1.5">
                  <ChipSelect label="Control type" value={r.role} onChange={(role) => update(i, { ...r, role: role as RefRole })} options={REF_ROLES.map((x) => ({ value: x.id, label: x.name }))} className="[&_select]:h-7 [&_select]:text-xs" />
                  <Slider label="Reference weight" value={Math.round(r.weight * 100)} min={0} max={100} onChange={(v) => update(i, { ...r, weight: v / 100 })} />
                  <div className="text-right font-mono text-[10px] text-faint">{Math.round(r.weight * 100)}%</div>
                </div>
              )}
            </RefSlot>
          );
        })}
      </div>
    </div>
  );
}

export function ImageComposer() {
  const d = useStudio((s) => s.drafts.image);
  const setDraft = useStudio((s) => s.setDraft);
  const addStyleRef = useStudio((s) => s.addStyleRef);
  const set = (p: Partial<typeof d>) => setDraft("image", p);
  const [showNeg, setShowNeg] = useState(true);

  return (
    <section className="space-y-3">
      <ModelBar mode="image" value={d.modelId} onChange={(modelId) => set({ modelId })} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
          <PromptBox
            mode="image"
            onPasteImage={async (f) => addStyleRef({ src: await fileToReference(f), name: f.name })}
            controls={
              <>
                <AspectPicker id="img-ar" value={d.aspectRatio} onChange={(aspectRatio) => set({ aspectRatio })} options={IMAGE_ASPECTS} />
                <Segmented id="img-res" value={d.resolution} onChange={(resolution) => set({ resolution })} options={RESOLUTIONS.map((r) => ({ value: r, label: r, title: r === "4K" ? "4K doubles the cost" : undefined }))} />
                <div className="flex h-9 shrink-0 items-center rounded-lg border border-line bg-surface-2/70" aria-label="Number of images">
                  <button onClick={() => set({ count: Math.max(1, d.count - 1) })} disabled={d.count <= 1} className="grid size-8 place-items-center text-muted hover:text-fg disabled:opacity-30" aria-label="Fewer images">
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-8 text-center font-mono text-xs tabular-nums">×{d.count}</span>
                  <button onClick={() => set({ count: Math.min(MAX_COUNT, d.count + 1) })} disabled={d.count >= MAX_COUNT} className="grid size-8 place-items-center text-muted hover:text-fg disabled:opacity-30" aria-label="More images">
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <ChipSelect label="Style preset" value={d.stylePreset} onChange={(stylePreset) => set({ stylePreset })} options={STYLE_PRESETS.map((p) => ({ value: p.id, label: p.name }))} />
              </>
            }
          />
          <div className="glass rounded-2xl p-3 sm:p-4">
            <button onClick={() => setShowNeg((v) => !v)} className="flex w-full items-center justify-between" aria-expanded={showNeg}>
              <span className="font-mono text-[10px] uppercase tracking-widest text-faint">Negative prompt</span>
              <ChevronDown className={`size-4 text-muted transition ${showNeg ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {showNeg && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <textarea
                    value={d.negativePrompt}
                    onChange={(e) => set({ negativePrompt: e.target.value })}
                    rows={2}
                    aria-label="Negative prompt"
                    placeholder="What to keep out of the image…"
                    className="mt-2 w-full resize-none rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-red-400/60"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <aside className="glass space-y-4 rounded-2xl p-4" aria-label="Image settings">
          <StyleRefSlots />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
            <div>
              <Label>Sampler</Label>
              <ChipSelect label="Sampler" value={d.sampler} onChange={(v) => set({ sampler: v as typeof d.sampler })} options={SAMPLERS.map((s) => ({ value: s.id, label: s.name }))} className="w-full" />
            </div>
            <SeedField mode="image" />
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
            <div>
              <Label hint={d.steps}>Steps</Label>
              <Slider label="Steps" value={d.steps} min={10} max={60} onChange={(steps) => set({ steps })} ticks={["fast", "detailed"]} />
            </div>
            <div>
              <Label hint={d.cfg.toFixed(1)}>Guidance (CFG)</Label>
              <Slider label="Guidance scale" value={d.cfg} min={1} max={15} step={0.5} onChange={(cfg) => set({ cfg })} ticks={["loose", "strict"]} />
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
