"use client";

import { Gem } from "lucide-react";
import { STYLE_WORDS } from "@/lib/catalog";
import { SUBJECT_WORDS } from "@/lib/mock";

/** Audio-meter style bars. `energy` 0..1 sets the amplitude and speed; idle is a gentle breathing wave. */
export function EnergyWave({ energy, bars = 28, className = "h-8" }: { energy: number; bars?: number; className?: string }) {
  return (
    <div className={`flex items-end gap-[3px] ${className}`} aria-hidden>
      {Array.from({ length: bars }, (_, i) => {
        const r = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1; // stable per-bar randomness
        const hi = Math.min(1, 0.2 + energy * (0.45 + r * 0.55));
        const lo = 0.08 + energy * 0.15 * r;
        return (
          <span
            key={i}
            className="wave-bar h-full flex-1 rounded-full bg-gradient-to-t from-success to-accent"
            style={
              {
                "--hi": hi,
                "--lo": lo,
                "--dur": `${(energy > 0.3 ? 0.55 : 1.6) + r * 0.6}s`,
                "--delay": `${-r * 2}s`,
                opacity: 0.35 + energy * 0.65,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/** Balance bar: credits locked by running jobs, what the current draft would cost, and what stays free. */
export function TokenUsage({ credits, inFlight, draftCost, energy }: { credits: number; inFlight: number; draftCost: number; energy: number }) {
  const total = Math.max(credits + inFlight, 1);
  const pct = (n: number) => `${Math.min(100, (n / total) * 100)}%`;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-faint">
          <Gem className="size-3 text-accent" /> Credits
        </span>
        <span className="font-mono text-sm tabular-nums">{credits}</span>
      </div>
      <EnergyWave energy={energy} className="h-7" />
      <div className="relative flex h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full animate-pulse bg-success" style={{ width: pct(inFlight) }} />
        <div className="h-full bg-accent/25" style={{ width: pct(Math.min(draftCost, credits)) }} />
      </div>
      <div className="flex justify-between font-mono text-[10px] text-faint">
        <span className={inFlight > 0 ? "flex items-center gap-1 text-success" : ""}>
          {inFlight > 0 && <span className="size-1.5 animate-pulse rounded-full bg-success" />}
          {inFlight > 0 ? `${inFlight} in flight` : "idle"}
        </span>
        <span>next −{draftCost}</span>
      </div>
    </div>
  );
}

const STOP = new Set(["a", "an", "the", "of", "in", "on", "at", "with", "and", "to", "over", "into", "from", "by", "for", "is"]);

function weight(word: string): number {
  const w = word.toLowerCase();
  if (STYLE_WORDS.has(w)) return 3;
  if (SUBJECT_WORDS.has(w)) return 2;
  if (STOP.has(w) || w.length < 3) return 0;
  return 1;
}

/** Live heatmap of how much each prompt word steers the result: style/camera words run hottest. */
export function PromptHeat({ prompt }: { prompt: string }) {
  const words = prompt.match(/[A-Za-z0-9']+/g) ?? [];
  if (words.length === 0) return null;
  const weights = words.map(weight);
  const strength = Math.min(100, Math.round((weights.reduce((a, b) => a + b, 0) / 18) * 100));
  const bg = ["transparent", "rgb(0 245 255 / 0.07)", "rgb(0 245 255 / 0.16)", "rgb(0 245 255 / 0.3)"];
  return (
    <div className="flex items-start gap-3">
      <div className="no-scrollbar flex min-w-0 flex-1 flex-wrap gap-1">
        {words.slice(0, 40).map((w, i) => (
          <span
            key={i}
            className={`rounded px-1 py-px font-mono text-[11px] transition-colors ${weights[i] === 3 ? "text-accent" : weights[i] === 0 ? "text-faint" : "text-muted"}`}
            style={{ background: bg[weights[i]] }}
            title={["filler", "detail", "subject", "style / camera"][weights[i]]}
          >
            {w}
          </span>
        ))}
      </div>
      <div className="shrink-0 text-right" title="How specific the prompt is about subject, style and camera">
        <div className="font-mono text-[10px] uppercase tracking-widest text-faint">Strength</div>
        <div className="font-mono text-sm tabular-nums text-accent">{strength}%</div>
      </div>
    </div>
  );
}
