"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, ArrowRight, Film, Heart, ImageIcon, Loader2 } from "lucide-react";
import { statusOf } from "@/lib/mock";
import type { CardItem, Generation, Mode } from "@/lib/types";
import { applyFilters, useStudio } from "@/store/useStudio";
import { FilterPills } from "../feed/FilterPills";
import { MasonryGrid } from "../feed/Grid";
import { useStudioNow } from "../shell/StudioShell";
import { RenderQueue } from "./RenderQueue";

const SECTIONS: { mode: Mode; title: string; href: string; cta: string; Icon: typeof Film; empty: string }[] = [
  { mode: "image", title: "Images", href: "/image", cta: "Open Image Studio", Icon: ImageIcon, empty: "No images match yet." },
  { mode: "video", title: "Videos", href: "/video", cta: "Open Video Studio", Icon: Film, empty: "No videos match yet." },
];

const toCards = (takes: Generation[]): CardItem[] => takes.flatMap((g) => g.outputs.map((o) => ({ g, o })));

function Stat({ label, value, Icon, tone = "accent" }: { label: string; value: React.ReactNode; Icon: typeof Film; tone?: "accent" | "success" }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-faint">{label}</span>
        <Icon className={`size-4 ${tone === "success" ? "text-success" : "text-accent"}`} />
      </div>
      <div className="mt-2 font-mono text-2xl tabular-nums">{value}</div>
    </div>
  );
}

/** Dashboard of the active project: every image first, then every video, with the same cards and actions as the studios. */
export function ShowcaseScreen() {
  const now = useStudioNow();
  const generations = useStudio((s) => s.generations);
  const activeProjectId = useStudio((s) => s.activeProjectId);
  const activeTags = useStudio((s) => s.activeTags);
  const favoritesOnly = useStudio((s) => s.favoritesOnly);
  const hasSelection = useStudio((s) => !!s.selected);
  const projectName = useStudio((s) => s.projects.find((p) => p.id === s.activeProjectId)?.name);

  const takes = useMemo(() => generations.filter((g) => g.projectId === activeProjectId), [generations, activeProjectId]);
  const filtered = useMemo(() => applyFilters(takes, activeTags, favoritesOnly), [takes, activeTags, favoritesOnly]);
  const byMode = useMemo(
    () => ({ image: filtered.filter((g) => g.recipe.mode === "image"), video: filtered.filter((g) => g.recipe.mode === "video") }),
    [filtered]
  );

  const imageCount = takes.filter((g) => g.recipe.mode === "image").reduce((n, g) => n + g.outputs.length, 0);
  const videoCount = takes.filter((g) => g.recipe.mode === "video").length;
  const rendering = takes.filter((g) => statusOf(g, now) !== "done").length;
  const favorites = takes.filter((g) => g.favorite).length;

  const jump = (mode: Mode) => document.getElementById(`showcase-${mode}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-10 pt-6 sm:px-6" style={{ paddingBottom: hasSelection ? "min(70vh, 560px)" : undefined }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
              Showcase <span className="text-faint">/ {projectName}</span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Everything you&apos;ve made</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/image" className="btn-primary flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold">
              <ImageIcon className="size-4" /> New image
            </Link>
            <Link href="/video" className="flex h-10 items-center gap-2 rounded-xl border border-success/40 px-4 text-sm font-medium text-success hover:bg-success/10">
              <Film className="size-4" /> New video
            </Link>
          </div>
        </div>

        <RenderQueue />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Images" value={imageCount} Icon={ImageIcon} />
          <Stat label="Videos" value={videoCount} Icon={Film} />
          <Stat
            label="Rendering"
            value={
              <span className={`inline-flex items-center gap-2 ${rendering ? "text-success" : ""}`}>
                {rendering > 0 && <Loader2 className="size-5 animate-spin" />}
                {rendering}
              </span>
            }
            Icon={Activity}
            tone="success"
          />
          <Stat label="Favorites" value={favorites} Icon={Heart} />
        </div>

        <div className="sticky top-16 z-20 -mx-4 mt-6 flex items-center gap-3 bg-gradient-to-b from-bg via-bg/90 to-transparent px-4 pb-3 pt-2 sm:-mx-6 sm:px-6">
          <FilterPills takes={takes} />
          <div className="flex shrink-0 rounded-lg border border-line bg-surface-2/70 p-0.5">
            {SECTIONS.map((s) => (
              <button key={s.mode} onClick={() => jump(s.mode)} className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted hover:bg-white/5 hover:text-fg" title={`Jump to ${s.title}`}>
                <s.Icon className="size-3.5" />
                <span className="hidden sm:inline">{s.title}</span>
                <span className="font-mono text-[10px] text-faint">{byMode[s.mode].length}</span>
              </button>
            ))}
          </div>
        </div>

        {SECTIONS.map((s) => {
          const cards = toCards(byMode[s.mode]);
          return (
            <section key={s.mode} id={`showcase-${s.mode}`} className="scroll-mt-32 pt-4 first-of-type:pt-0" aria-labelledby={`showcase-${s.mode}-title`}>
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-line pb-3">
                <h2 id={`showcase-${s.mode}-title`} className="flex items-center gap-2 text-lg font-semibold">
                  <s.Icon className={`size-5 ${s.mode === "image" ? "text-accent" : "text-success"}`} />
                  {s.title}
                  <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-xs text-muted">{cards.length}</span>
                </h2>
                <Link href={s.href} className="flex items-center gap-1 text-sm text-accent hover:underline">
                  {s.cta} <ArrowRight className="size-4" />
                </Link>
              </div>
              {cards.length ? (
                <MasonryGrid items={cards} now={now} />
              ) : (
                <div className="glass rounded-2xl px-6 py-12 text-center text-sm text-muted">
                  {s.empty}{" "}
                  <Link href={s.href} className="text-accent hover:underline">
                    {s.cta}
                  </Link>
                </div>
              )}
              <div className="h-8" />
            </section>
          );
        })}
      </motion.div>
    </main>
  );
}
