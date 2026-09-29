"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, CornerDownRight, Film, Gem, ImageIcon, ImagePlus, Minus, Plus, Sparkles, X } from "lucide-react";
import { ASPECT_RATIOS, costOf, DURATIONS, EXAMPLE_PROMPTS, MAX_COUNT, MODELS, PRESETS } from "@/lib/catalog";
import { fileToReference } from "@/lib/image";
import type { AspectRatio, Mode } from "@/lib/types";
import { useStudio } from "@/store/useStudio";
import { PromptHeat } from "./Energy";

export function ChipSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="relative flex shrink-0 items-center">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 appearance-none rounded-lg border border-line bg-surface-2 pl-3 pr-8 text-sm hover:border-line-strong focus:border-accent focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-muted" />
    </label>
  );
}

export function AspectPicker({ value, onChange }: { value: AspectRatio; onChange: (ar: AspectRatio) => void }) {
  return (
    <div className="flex shrink-0 rounded-lg border border-line bg-surface-2 p-0.5" role="radiogroup" aria-label="Aspect ratio">
      {ASPECT_RATIOS.map((ar) => {
        const [w, h] = ar === "1:1" ? [10, 10] : ar === "16:9" ? [14, 8] : [8, 14];
        return (
          <button
            key={ar}
            role="radio"
            aria-checked={value === ar}
            onClick={() => onChange(ar)}
            className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 font-mono text-[11px] tabular-nums ${
              value === ar ? "bg-white/10 text-fg" : "text-muted hover:text-fg"
            }`}
          >
            <span className="inline-block rounded-[2px] border-[1.5px] border-current" style={{ width: w, height: h }} />
            {ar}
          </button>
        );
      })}
    </div>
  );
}

function ModelBar() {
  const modelId = useStudio((s) => s.draft.modelId);
  const mode = useStudio((s) => s.draft.mode);
  const setDraft = useStudio((s) => s.setDraft);
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0" role="radiogroup" aria-label="Model">
      {MODELS.map((m) => {
        const active = m.id === modelId;
        return (
          <button
            key={m.id}
            role="radio"
            aria-checked={active}
            onClick={() => setDraft({ modelId: m.id })}
            className={`glass relative min-w-52 shrink-0 overflow-hidden rounded-xl p-3 text-left transition sm:min-w-0 ${
              active ? "glow-accent" : "hover:border-line-strong"
            }`}
          >
            {active && <motion.span layoutId="model-glow" className="absolute inset-0 bg-gradient-to-br from-accent/15 to-transparent" />}
            <div className="relative flex items-center justify-between">
              <span className={`text-sm font-semibold ${active ? "text-accent" : ""}`}>{m.name}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-faint">{m.speedLabel}</span>
            </div>
            <div className="relative mt-0.5 text-xs text-muted">{m.tagline}</div>
            <div className="relative mt-2 flex items-center gap-1 font-mono text-[11px] text-faint">
              <Gem className="size-3" />
              {mode === "image" ? `${m.imageCost}/image` : `${m.videoCost}/sec`}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function Composer() {
  const draft = useStudio((s) => s.draft);
  const setDraft = useStudio((s) => s.setDraft);
  const setMode = useStudio((s) => s.setMode);
  const submit = useStudio((s) => s.submit);
  const credits = useStudio((s) => s.credits);
  const clearParent = useStudio((s) => s.clearParent);
  const parent = useStudio((s) => s.generations.find((g) => g.id === s.draftParentId));
  const focusTick = useStudio((s) => s.focusTick);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const cost = costOf(draft);
  const canAfford = cost <= credits;
  const canSubmit = draft.prompt.trim().length > 0 && canAfford;

  useEffect(() => {
    if (focusTick === 0) return;
    const el = promptRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }, [focusTick]);

  // Auto-grow the prompt up to a limit.
  useEffect(() => {
    const el = promptRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft.prompt]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith("image/")) return setUploadError("Please choose an image file.");
    try {
      setDraft({ reference: { src: await fileToReference(file), name: file.name } });
    } catch (e) {
      setUploadError((e as Error).message);
    }
  };

  const modeBtn = (mode: Mode, Icon: typeof ImageIcon, label: string) => (
    <button
      type="button"
      onClick={() => setMode(mode)}
      aria-pressed={draft.mode === mode}
      className={`relative flex h-8 items-center gap-1.5 rounded-md px-3 text-sm transition-colors ${draft.mode === mode ? "text-accent-fg" : "text-muted hover:text-fg"}`}
    >
      {draft.mode === mode && <motion.span layoutId="mode-pill" className="absolute inset-0 rounded-md bg-accent" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
      <Icon className="relative size-4" />
      <span className="relative">{label}</span>
    </button>
  );

  return (
    <section className="space-y-3">
      <ModelBar />
      <div className="glass rounded-2xl p-3 shadow-2xl shadow-black/40 sm:p-4">
        {(parent || draft.reference) && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {parent && (
              <span className="flex h-7 items-center gap-1.5 rounded-full bg-accent/15 pl-2.5 pr-1 text-xs text-accent">
                <CornerDownRight className="size-3.5" />
                Branching from Take {parent.n} · {parent.title}
                <button onClick={clearParent} aria-label="Stop branching" className="grid size-5 place-items-center rounded-full hover:bg-accent/20">
                  <X className="size-3" />
                </button>
              </span>
            )}
            {draft.reference && (
              <span className="flex h-7 items-center gap-1.5 rounded-full bg-surface-2 pl-1 pr-1 text-xs text-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={draft.reference.src} alt="" className="size-5 rounded-full object-cover" />
                <span className="max-w-40 truncate">Reference · {draft.reference.name}</span>
                <button onClick={() => setDraft({ reference: null })} aria-label="Remove reference" className="grid size-5 place-items-center rounded-full hover:bg-white/10">
                  <X className="size-3" />
                </button>
              </span>
            )}
          </div>
        )}

        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-line-strong text-muted hover:border-accent hover:text-accent"
            aria-label="Add reference image"
            title="Add reference image (or paste one into the prompt)"
          >
            {draft.reference ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.reference.src} alt="Reference" className="absolute inset-0 size-full object-cover" />
            ) : (
              <ImagePlus className="size-5" />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <textarea
            ref={promptRef}
            value={draft.prompt}
            onChange={(e) => setDraft({ prompt: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (canSubmit) submit();
              }
            }}
            onPaste={(e) => {
              const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
              if (file) {
                e.preventDefault();
                onFile(file);
              }
            }}
            rows={2}
            placeholder={draft.mode === "image" ? "Describe the image you want to create…" : "Describe the shot: subject, light, camera move…"}
            className="min-h-12 flex-1 resize-none bg-transparent py-1.5 text-base leading-relaxed outline-none placeholder:text-faint sm:text-lg"
          />
        </div>
        {uploadError && <p className="mt-1 text-xs text-red-400">{uploadError}</p>}

        <div className="mt-2 min-h-6">
          {draft.prompt.trim() ? (
            <PromptHeat prompt={draft.prompt} />
          ) : (
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {EXAMPLE_PROMPTS.map((p) => (
                <button key={p} onClick={() => setDraft({ prompt: p })} className="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-xs text-muted hover:border-line-strong hover:text-fg">
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
          <div className="no-scrollbar -mx-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1">
            <div className="flex shrink-0 rounded-lg bg-surface-2 p-0.5">
              {modeBtn("video", Film, "Video")}
              {modeBtn("image", ImageIcon, "Image")}
            </div>
            <AspectPicker value={draft.aspectRatio} onChange={(aspectRatio) => setDraft({ aspectRatio })} />
            {draft.mode === "image" ? (
              <div className="flex h-9 shrink-0 items-center rounded-lg border border-line bg-surface-2" aria-label="Number of images">
                <button onClick={() => setDraft({ count: Math.max(1, draft.count - 1) })} disabled={draft.count <= 1} className="grid size-8 place-items-center text-muted hover:text-fg disabled:opacity-30" aria-label="Fewer images">
                  <Minus className="size-3.5" />
                </button>
                <span className="w-8 text-center font-mono text-xs tabular-nums">×{draft.count}</span>
                <button onClick={() => setDraft({ count: Math.min(MAX_COUNT, draft.count + 1) })} disabled={draft.count >= MAX_COUNT} className="grid size-8 place-items-center text-muted hover:text-fg disabled:opacity-30" aria-label="More images">
                  <Plus className="size-3.5" />
                </button>
              </div>
            ) : (
              <ChipSelect label="Duration" value={String(draft.durationSec)} onChange={(v) => setDraft({ durationSec: Number(v) })} options={DURATIONS.map((d) => ({ value: String(d), label: `${d}s` }))} />
            )}
            <ChipSelect
              label={draft.mode === "image" ? "Style" : "Camera"}
              value={draft.presetId}
              onChange={(presetId) => setDraft({ presetId })}
              options={PRESETS[draft.mode].map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => canSubmit && submit()}
            disabled={!canSubmit}
            title={!canAfford ? "Not enough credits" : "Generate (⌘ + Enter)"}
            className="flex h-10 shrink-0 items-center gap-2 rounded-xl btn-primary pl-3.5 pr-3 text-sm font-semibold transition disabled:cursor-not-allowed"
          >
            <Sparkles className="size-4" />
            <span className="hidden sm:inline">{canAfford ? "Generate" : "Need credits"}</span>
            <span className="flex items-center gap-0.5 rounded-md bg-black/15 px-1.5 py-0.5 font-mono text-xs tabular-nums">
              <Gem className="size-3" />
              {cost}
            </span>
          </motion.button>
        </div>
      </div>
    </section>
  );
}
