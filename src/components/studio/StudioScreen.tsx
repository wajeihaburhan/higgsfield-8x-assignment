"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutGrid, Network } from "lucide-react";
import type { CardItem, Mode } from "@/lib/types";
import { applyFilters, useStudio, useStudioTakes } from "@/store/useStudio";
import { FilterPills } from "../feed/FilterPills";
import { GraphView } from "../feed/GraphView";
import { MasonryGrid } from "../feed/Grid";
import { useStudioNow } from "../shell/StudioShell";
import { Segmented } from "../ui/controls";

const COPY: Record<Mode, { eyebrow: string; title: string; empty: string }> = {
  image: { eyebrow: "Image Studio", title: "Compose a still", empty: "Write a prompt above to make your first image." },
  video: { eyebrow: "Video Studio", title: "Direct a shot", empty: "Add a start frame or a prompt above to make your first clip." },
};

/** Layout shared by both studios: title, the studio's composer, filter toolbar, and grid or graph feed. */
export function StudioScreen({ mode, composer }: { mode: Mode; composer: React.ReactNode }) {
  const now = useStudioNow();
  const takes = useStudioTakes(mode);
  const activeTags = useStudio((s) => s.activeTags);
  const favoritesOnly = useStudio((s) => s.favoritesOnly);
  const view = useStudio((s) => s.view);
  const setView = useStudio((s) => s.setView);
  const hasSelection = useStudio((s) => !!s.selected);
  const projectName = useStudio((s) => s.projects.find((p) => p.id === s.activeProjectId)?.name);

  const filtered = useMemo(() => applyFilters(takes, activeTags, favoritesOnly), [takes, activeTags, favoritesOnly]);
  const matching = useMemo(() => new Set(filtered.map((g) => g.id)), [filtered]);
  const cards: CardItem[] = useMemo(() => filtered.flatMap((g) => g.outputs.map((o) => ({ g, o }))), [filtered]);
  const copy = COPY[mode];

  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-10 pt-6 sm:px-6" style={{ paddingBottom: hasSelection ? "min(70vh, 560px)" : undefined }}>
      <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
              {copy.eyebrow} <span className="text-faint">/ {projectName}</span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{copy.title}</h1>
          </div>
          <div className="hidden font-mono text-[11px] text-faint sm:block">{takes.length} takes</div>
        </div>

        {composer}

        <div className="sticky top-16 z-20 -mx-4 mt-6 flex items-center gap-3 bg-gradient-to-b from-bg via-bg/90 to-transparent px-4 pb-3 pt-2 sm:-mx-6 sm:px-6">
          <FilterPills takes={takes} mode={mode} />
          <Segmented
            id={`view-${mode}`}
            value={view}
            onChange={setView}
            options={[
              { value: "grid", label: <><LayoutGrid className="size-3.5" /><span className="hidden sm:inline">Grid</span></>, title: "Masonry grid" },
              { value: "graph", label: <><Network className="size-3.5" /><span className="hidden sm:inline">Graph</span></>, title: "Prompt evolution graph" },
            ]}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {takes.length === 0 ? (
              <div className="glass grid place-items-center rounded-2xl px-6 py-20 text-center">
                <div>
                  <h2 className="text-lg font-medium">An empty stage</h2>
                  <p className="mt-1 text-sm text-muted">{copy.empty}</p>
                </div>
              </div>
            ) : view === "graph" ? (
              <GraphView takes={takes} matching={matching} now={now} />
            ) : cards.length === 0 ? (
              <div className="glass rounded-2xl px-6 py-16 text-center text-sm text-muted">No takes match these filters.</div>
            ) : (
              <MasonryGrid items={cards} now={now} />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </main>
  );
}
