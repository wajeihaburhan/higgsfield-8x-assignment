"use client";

import { Gem, CornerDownRight, Download, Film, Play, Repeat2, RotateCcw, Shuffle, Sparkles } from "lucide-react";
import { EXAMPLE_PROMPTS, modelById, presetName } from "@/lib/catalog";
import { downloadOutput } from "@/lib/image";
import { progressOf, statusOf } from "@/lib/mock";
import type { AspectRatio, Generation, Output } from "@/lib/types";
import { useStudio } from "@/store/useStudio";

const GRID: Record<AspectRatio, string> = {
  "1:1": "grid-cols-2 md:grid-cols-4",
  "16:9": "grid-cols-1 sm:grid-cols-2",
  "9:16": "grid-cols-2 sm:grid-cols-4",
};

const ASPECT: Record<AspectRatio, string> = {
  "1:1": "aspect-square",
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
};

export function timeAgo(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString();
}

export const outputFilename = (g: Generation, o: Output) =>
  `take-${g.n}-${g.outputs.indexOf(o) + 1}.${o.kind === "image" ? "jpg" : "mp4"}`;

function PendingTile({ g, o, now }: { g: Generation; o: Output; now: number }) {
  const status = statusOf(g, now);
  const p = progressOf(g.startAt, o.readyAt, now);
  return (
    <div className={`sheen relative overflow-hidden rounded-xl bg-surface-2 ${ASPECT[g.recipe.aspectRatio]}`}>
      {g.recipe.reference && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={g.recipe.reference.src} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-25 blur-2xl" />
      )}
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-faint">{status === "queued" ? "In queue" : "Generating"}</div>
          {status !== "queued" && <div className="mt-1 text-2xl font-light tabular-nums text-fg/90">{Math.floor(p * 100)}%</div>}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-line">
        <div className="h-full bg-accent transition-[width] duration-150 ease-linear" style={{ width: `${p * 100}%` }} />
      </div>
    </div>
  );
}

function ReadyTile({ g, o }: { g: Generation; o: Output }) {
  const openViewer = useStudio((s) => s.openViewer);
  const remix = useStudio((s) => s.remix);
  const act = (e: React.MouseEvent, fn: () => void) => {
    e.stopPropagation();
    fn();
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openViewer(g.id, o.id)}
      onKeyDown={(e) => e.key === "Enter" && openViewer(g.id, o.id)}
      className={`reveal group relative cursor-zoom-in overflow-hidden rounded-xl bg-surface-2 outline-none ring-accent focus-visible:ring-2 ${ASPECT[g.recipe.aspectRatio]}`}
    >
      {o.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={o.src} alt={g.recipe.prompt} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.02]" />
      ) : (
        <video
          src={o.src}
          poster={o.poster}
          muted
          loop
          playsInline
          autoPlay
          className="size-full object-cover"
        />
      )}
      {o.kind === "video" && (
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] backdrop-blur">
          <Play className="size-3 fill-current" />
          {g.recipe.durationSec}s
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 flex translate-y-1 items-center justify-end gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:opacity-100 max-sm:translate-y-0 max-sm:opacity-100">
        <TileButton label="Remix" onClick={(e) => act(e, () => remix(g.id, o.id))} icon={<Repeat2 className="size-4" />} />
        {o.kind === "image" && (
          <TileButton label="Animate" onClick={(e) => act(e, () => remix(g.id, o.id, true))} icon={<Film className="size-4" />} />
        )}
        <TileButton
          label="Download"
          onClick={(e) => act(e, () => downloadOutput(o.src, outputFilename(g, o)))}
          icon={<Download className="size-4" />}
        />
      </div>
    </div>
  );
}

function TileButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid size-8 place-items-center rounded-lg bg-black/50 text-white backdrop-blur hover:bg-black/80"
    >
      {icon}
    </button>
  );
}

function TakeCard({ g, now, parent }: { g: Generation; now: number; parent?: Generation }) {
  const reuseRecipe = useStudio((s) => s.reuseRecipe);
  const vary = useStudio((s) => s.vary);
  const credits = useStudio((s) => s.credits);
  const r = g.recipe;
  const model = modelById(r.modelId);
  const done = statusOf(g, now) === "done";
  const preset = presetName(r.mode, r.presetId);

  return (
    <article className="fade-in border-b border-line py-6 first:pt-6">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="font-medium text-fg">Take {g.n}</span>
            <span className="text-faint">·</span>
            <span>{model.name}</span>
            <span className="text-faint">·</span>
            <span>{r.aspectRatio}</span>
            {r.mode === "video" && (
              <>
                <span className="text-faint">·</span>
                <span>{r.durationSec}s</span>
              </>
            )}
            {preset && r.presetId !== "none" && (
              <>
                <span className="text-faint">·</span>
                <span>{preset}</span>
              </>
            )}
            <span className="text-faint">·</span>
            <span className="flex items-center gap-0.5 tabular-nums">
              <Gem className="size-3" />
              {g.cost}
            </span>
            <span className="text-faint">·</span>
            <span>{timeAgo(g.createdAt, now)}</span>
          </div>
          <p className="mt-1.5 line-clamp-2 text-[15px] leading-snug text-fg/90">{r.prompt}</p>
          {(parent || r.reference) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              {parent && (
                <span className="flex items-center gap-1">
                  <CornerDownRight className="size-3.5 text-accent" />
                  From Take {parent.n}
                </span>
              )}
              {r.reference && (
                <span className="flex items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.reference.src} alt="" className="size-5 rounded object-cover" />
                  {r.reference.name}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => reuseRecipe(g.id)}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-muted hover:border-line-strong hover:text-fg"
            title="Load this exact recipe (same seed) into the composer"
          >
            <RotateCcw className="size-3.5" />
            Use recipe
          </button>
          <button
            onClick={() => vary(g.id)}
            disabled={!done || g.cost > credits}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-muted hover:border-line-strong hover:text-fg disabled:opacity-40"
            title="Run again with a new seed"
          >
            <Shuffle className="size-3.5" />
            Vary
          </button>
        </div>
      </div>
      <div className={`grid gap-2 sm:gap-3 ${GRID[r.aspectRatio]}`}>
        {g.outputs.map((o) =>
          now >= o.readyAt ? <ReadyTile key={o.id} g={g} o={o} /> : <PendingTile key={o.id} g={g} o={o} now={now} />
        )}
      </div>
    </article>
  );
}

export function Feed({ now }: { now: number }) {
  const activeProjectId = useStudio((s) => s.activeProjectId);
  const all = useStudio((s) => s.generations);
  const setDraft = useStudio((s) => s.setDraft);
  const takes = all.filter((g) => g.projectId === activeProjectId);
  const byId = new Map(all.map((g) => [g.id, g]));

  if (takes.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-accent/15 text-accent">
          <Sparkles className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">What are we making?</h1>
        <p className="mt-2 max-w-md text-muted">
          Every result keeps its full recipe. Reuse it, remix it with a new reference, or animate a still — iteration is one click away.
        </p>
        <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => setDraft({ prompt: p })}
              className="rounded-full border border-line px-3.5 py-1.5 text-sm text-muted hover:border-line-strong hover:text-fg"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      {takes.map((g) => (
        <TakeCard key={g.id} g={g} now={now} parent={g.parentId ? byId.get(g.parentId) : undefined} />
      ))}
    </div>
  );
}
