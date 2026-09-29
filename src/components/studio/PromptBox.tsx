"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { CornerDownRight, Gem, Sparkles, X } from "lucide-react";
import { costOf, EXAMPLE_PROMPTS } from "@/lib/catalog";
import type { Mode } from "@/lib/types";
import { useStudio } from "@/store/useStudio";
import { PromptHeat } from "../ui/Energy";

/** Prompt card shared by both studios: prompt, live heatmap, branch chip, controls row and Generate. */
export function PromptBox({ mode, controls, onPasteImage }: { mode: Mode; controls: React.ReactNode; onPasteImage?: (file: File) => void }) {
  const draft = useStudio((s) => s.drafts[mode]);
  const setDraft = useStudio((s) => s.setDraft);
  const submit = useStudio((s) => s.submit);
  const credits = useStudio((s) => s.credits);
  const clearParent = useStudio((s) => s.clearParent);
  const parent = useStudio((s) => s.generations.find((g) => g.id === s.draftParents[mode]));
  const focusTick = useStudio((s) => s.focusTick);
  const ref = useRef<HTMLTextAreaElement>(null);

  const cost = costOf(draft);
  const canAfford = cost <= credits;
  const canSubmit = draft.prompt.trim().length > 0 && canAfford;
  const go = () => canSubmit && submit(mode);

  useEffect(() => {
    if (focusTick === 0) return;
    const el = ref.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }, [focusTick]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft.prompt]);

  return (
    <div className="glass rounded-2xl p-3 shadow-2xl shadow-black/40 sm:p-4">
      {parent && (
        <span className="mb-2 inline-flex h-7 items-center gap-1.5 rounded-full bg-accent/15 pl-2.5 pr-1 text-xs text-accent">
          <CornerDownRight className="size-3.5" />
          Branching from #{parent.n} · {parent.title}
          <button onClick={() => clearParent(mode)} aria-label="Stop branching" className="grid size-5 place-items-center rounded-full hover:bg-accent/20">
            <X className="size-3" />
          </button>
        </span>
      )}
      <textarea
        ref={ref}
        value={draft.prompt}
        onChange={(e) => setDraft(mode, { prompt: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            go();
          }
        }}
        onPaste={(e) => {
          const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
          if (file && onPasteImage) {
            e.preventDefault();
            onPasteImage(file);
          }
        }}
        rows={2}
        aria-label="Prompt"
        placeholder={mode === "image" ? "Describe the image: subject, composition, light, style…" : "Describe the shot: subject, action, light, camera move…"}
        className="min-h-14 w-full resize-none bg-transparent py-1 text-base leading-relaxed outline-none placeholder:text-faint sm:text-lg"
      />
      <div className="mt-1 min-h-6">
        {draft.prompt.trim() ? (
          <PromptHeat prompt={draft.prompt} />
        ) : (
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {EXAMPLE_PROMPTS[mode].map((p) => (
              <button key={p} onClick={() => setDraft(mode, { prompt: p })} className="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-xs text-muted hover:border-accent/50 hover:text-fg">
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        <div className="no-scrollbar -mx-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1">{controls}</div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={go}
          disabled={!canSubmit}
          title={!canAfford ? "Not enough credits" : "Generate (⌘ + Enter)"}
          className="btn-primary flex h-10 shrink-0 items-center gap-2 rounded-xl pl-3.5 pr-3 text-sm font-semibold transition disabled:cursor-not-allowed"
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
  );
}
