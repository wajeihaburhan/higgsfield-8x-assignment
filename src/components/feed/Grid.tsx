"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Aperture, Brush, Copy, Download, Heart, Maximize2, Play, SlidersHorizontal, Sparkles } from "lucide-react";
import { modelById } from "@/lib/catalog";
import { compact, genTime, outputFilename, timeAgo } from "@/lib/format";
import { captureFrame, formatTime } from "@/lib/frames";
import { downloadOutput } from "@/lib/image";
import { lookStyle, progressOf, statusOf } from "@/lib/mock";
import type { AspectRatio, CardItem } from "@/lib/types";
import { useStudio } from "@/store/useStudio";

const RATIO: Record<AspectRatio, number> = { "1:1": 1, "16:9": 9 / 16, "9:16": 16 / 9, "4:3": 3 / 4 };
const ASPECT: Record<AspectRatio, string> = { "1:1": "aspect-square", "16:9": "aspect-video", "9:16": "aspect-[9/16]", "4:3": "aspect-[4/3]" };

function useColumns(ref: React.RefObject<HTMLElement | null>) {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      setCols(w < 480 ? 1 : w < 760 ? 2 : w < 1180 ? 3 : 4);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return cols;
}

function ActionButton({ label, icon, onClick, primary }: { label: string; icon: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={label}
      aria-label={label}
      className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium backdrop-blur-md transition ${
        primary ? "bg-accent/90 text-accent-fg hover:bg-accent" : "bg-slate-950/60 text-white hover:bg-accent hover:text-accent-fg"
      }`}
    >
      {icon}
      <span className="hidden 2xl:inline">{label}</span>
    </button>
  );
}

function MediaCard({ item, now, selected }: { item: CardItem; now: number; selected: boolean }) {
  const { g, o } = item;
  const r = g.recipe;
  const { select, deselect, openViewer, toggleFavorite, upscale, variations, openInpaint, setKeyframe, showToast } = useStudio.getState();
  const videoRef = useRef<HTMLVideoElement>(null);
  const ready = now >= o.readyAt;
  const status = statusOf(g, now);
  const p = progressOf(g.startAt, o.readyAt, now);

  const play = () => videoRef.current?.play().catch(() => {});
  const stop = () => {
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
  };

  const extractFrame = () => {
    const v = videoRef.current;
    if (!v || v.readyState < 2) return showToast({ message: "Hover the clip to load it, then extract a frame." });
    const src = captureFrame(v);
    const at = formatTime(v.currentTime);
    const ref = { src, name: `${g.title} @ ${at}` };
    showToast({
      message: `Frame ${at} extracted from “${g.title}”`,
      thumb: src,
      action: { label: "Use as start frame", run: () => setKeyframe("startFrame", ref) },
    });
    downloadOutput(src, `${outputFilename(g, o).replace(/\.mp4$/, "")}-${at.replace(/[:.]/g, "-")}.jpg`);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      onMouseEnter={play}
      onMouseLeave={stop}
      onClick={() => (selected ? deselect() : select(g.id, o.id))}
      onDoubleClick={() => ready && openViewer(g.id, o.id)}
      className={`group cursor-pointer overflow-hidden rounded-2xl border bg-surface/60 backdrop-blur-xl transition-colors ${
        selected ? "border-accent glow-accent" : "border-line hover:border-accent/40"
      }`}
    >
      <div className={`relative overflow-hidden bg-surface-2 ${ASPECT[r.aspectRatio]}`}>
        {ready ? (
          o.kind === "video" ? (
            <video ref={videoRef} src={o.src} poster={o.poster} muted loop playsInline preload="metadata" className="size-full object-cover" style={lookStyle(o.look)} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={o.src} alt={g.title} loading="lazy" className="size-full object-cover transition duration-700 group-hover:scale-[1.03]" style={lookStyle(o.look)} />
          )
        ) : (
          <div className="sheen absolute inset-0">
            {(r.mode === "image" ? r.styleRefs[0] : r.startFrame) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={(r.mode === "image" ? r.styleRefs[0] : r.startFrame)!.src} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-25 blur-2xl" />
            )}
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">{status === "queued" ? "In queue" : g.op === "upscale" ? "Upscaling" : g.op === "inpaint" ? "Inpainting" : "Rendering"}</div>
                {status !== "queued" && <div className="mt-1 font-mono text-2xl font-light tabular-nums text-success">{Math.floor(p * 100)}%</div>}
                {status !== "queued" && r.mode === "video" && (
                  <div className="mt-0.5 font-mono text-[10px] text-faint">
                    frame {Math.floor(p * r.durationSec * r.fps)}/{r.durationSec * r.fps}
                  </div>
                )}
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-line">
              <div className="h-full bg-gradient-to-r from-accent to-success shadow-[0_0_12px_rgb(16_185_129/0.8)]" style={{ width: `${p * 100}%` }} />
            </div>
          </div>
        )}

        {r.mode === "image" && r.inpaint && ready && (
          <div
            className="pointer-events-none absolute rounded-md border border-dashed border-success/70 opacity-0 transition group-hover:opacity-100"
            style={{ left: `${r.inpaint.x * 100}%`, top: `${r.inpaint.y * 100}%`, width: `${r.inpaint.w * 100}%`, height: `${r.inpaint.h * 100}%` }}
          />
        )}

        {/* Top badges */}
        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            <span className="rounded-md bg-slate-950/60 px-1.5 py-0.5 font-mono text-[10px] text-white backdrop-blur-md">{r.aspectRatio}</span>
            {r.mode === "image" && r.resolution === "4K" && <span className="rounded-md bg-success/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent-fg">4K</span>}
            {r.mode === "video" && (
              <>
                <span className="flex items-center gap-1 rounded-md bg-slate-950/60 px-1.5 py-0.5 font-mono text-[10px] text-white backdrop-blur-md">
                  <Play className="size-2.5 fill-current" />
                  0:{String(r.durationSec).padStart(2, "0")}
                </span>
                <span className="rounded-md bg-slate-950/60 px-1.5 py-0.5 font-mono text-[10px] text-white backdrop-blur-md">{r.fps}fps</span>
              </>
            )}
          </div>
          {ready && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(g.id);
              }}
              aria-label={g.favorite ? "Unfavorite" : "Favorite"}
              aria-pressed={g.favorite}
              className={`pointer-events-auto grid size-8 place-items-center rounded-full backdrop-blur-md transition ${
                g.favorite ? "bg-accent text-accent-fg" : "bg-slate-950/60 text-white opacity-0 hover:bg-slate-950/90 group-hover:opacity-100 max-sm:opacity-100"
              }`}
            >
              <Heart className={`size-4 ${g.favorite ? "fill-current" : ""}`} />
            </button>
          )}
        </div>

        {/* Quick actions */}
        {ready && (
          <div
            className={`absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-1.5 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent p-2 pt-10 transition duration-200 ${
              selected ? "opacity-100" : "translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 max-sm:translate-y-0 max-sm:opacity-100"
            }`}
          >
            {o.kind === "image" ? (
              <>
                <ActionButton label="Upscale" icon={<Sparkles className="size-3.5" />} onClick={() => upscale(g.id, o.id)} primary />
                <ActionButton label="Variations" icon={<Copy className="size-3.5" />} onClick={() => variations(g.id, o.id)} />
                <ActionButton label="Inpaint" icon={<Brush className="size-3.5" />} onClick={() => openInpaint(g.id, o.id)} />
              </>
            ) : (
              <>
                <ActionButton label="Extract frame" icon={<Aperture className="size-3.5" />} onClick={extractFrame} primary />
                <ActionButton label="Remix" icon={<SlidersHorizontal className="size-3.5" />} onClick={() => select(g.id, o.id)} />
              </>
            )}
            <div className="ml-auto flex gap-1.5">
              <ActionButton label="Download" icon={<Download className="size-3.5" />} onClick={() => downloadOutput(o.src, outputFilename(g, o))} />
              <ActionButton label="Expand" icon={<Maximize2 className="size-3.5" />} onClick={() => openViewer(g.id, o.id)} />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-medium">{g.title}</h3>
          <span className="shrink-0 font-mono text-[10px] text-faint">#{g.n}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={g.author.avatar} alt="" className="size-5 rounded-full" />
          <span className="truncate">{g.author.name}</span>
          <span className="text-faint">·</span>
          <span className="shrink-0 text-faint">{timeAgo(g.createdAt, now)}</span>
          {g.likes > 0 && (
            <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[11px] text-faint">
              <Heart className="size-3" />
              {compact(g.likes + (g.favorite ? 1 : 0))}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="rounded border border-accent/30 bg-accent/10 px-1.5 py-px font-mono text-[10px] text-accent">{modelById(r.modelId).name}</span>
          <span
            className={`rounded border px-1.5 py-px font-mono text-[10px] ${status === "done" ? "border-success/30 bg-success/10 text-success" : "border-line text-muted"}`}
            title="Generation time"
          >
            ⚡ {status === "done" ? genTime(g) : "…"}
          </span>
          {g.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded border border-line px-1.5 py-px font-mono text-[10px] text-muted">
              {t}
            </span>
          ))}
        </div>
      </div>
    </motion.article>
  );
}

/** Masonry: each card goes to the currently shortest column, so layout animations stay smooth. */
export function MasonryGrid({ items, now }: { items: CardItem[]; now: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const cols = useColumns(ref);
  const selectedId = useStudio((s) => s.selected?.outputId);

  const columns: CardItem[][] = Array.from({ length: cols }, () => []);
  const heights = new Array(cols).fill(0);
  for (const it of items) {
    const i = heights.indexOf(Math.min(...heights));
    columns[i].push(it);
    heights[i] += RATIO[it.g.recipe.aspectRatio] + 0.42; // card footer ≈ 0.42 of width
  }

  return (
    <div ref={ref} className="flex items-start gap-3 sm:gap-4">
      {columns.map((col, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {col.map((it) => (
              <MediaCard key={it.o.id} item={it} now={now} selected={selectedId === it.o.id} />
            ))}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
