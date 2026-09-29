"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gem, LayoutGrid, Menu, Network } from "lucide-react";
import { useNow } from "@/hooks/useNow";
import { costOf } from "@/lib/catalog";
import { statusOf } from "@/lib/mock";
import type { CardItem } from "@/lib/types";
import { applyFilters, useProjectTakes, useStudio, type ViewMode } from "@/store/useStudio";
import { Composer } from "./Composer";
import { EnergyWave } from "./Energy";
import { FilterPills } from "./FilterPills";
import { GraphView } from "./GraphView";
import { MasonryGrid } from "./Grid";
import { Sidebar } from "./Sidebar";
import { TweakDock } from "./TweakDock";
import { Viewer } from "./Viewer";

function ViewToggle() {
  const view = useStudio((s) => s.view);
  const setView = useStudio((s) => s.setView);
  const opt = (v: ViewMode, Icon: typeof LayoutGrid, label: string) => (
    <button
      onClick={() => setView(v)}
      aria-pressed={view === v}
      className={`relative flex h-8 items-center gap-1.5 rounded-md px-3 text-xs ${view === v ? "text-accent-fg" : "text-muted hover:text-fg"}`}
    >
      {view === v && <motion.span layoutId="view-pill" className="absolute inset-0 rounded-md bg-accent" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
      <Icon className="relative size-3.5" />
      <span className="relative hidden sm:inline">{label}</span>
    </button>
  );
  return (
    <div className="flex shrink-0 rounded-lg border border-line bg-surface/70 p-0.5 backdrop-blur-md">
      {opt("grid", LayoutGrid, "Grid")}
      {opt("graph", Network, "Graph")}
    </div>
  );
}

export function Studio() {
  // The store lives in localStorage, so render only after mount to avoid hydration mismatches.
  const [mounted, setMounted] = useState(false);
  const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  const latestEnd = useStudio((s) => s.generations.reduce((m, g) => Math.max(m, g.endAt), 0));
  const now = useNow(latestEnd);
  const takes = useProjectTakes();
  const activeTags = useStudio((s) => s.activeTags);
  const favoritesOnly = useStudio((s) => s.favoritesOnly);
  const view = useStudio((s) => s.view);
  const collapsed = useStudio((s) => s.sidebarCollapsed);
  const draft = useStudio((s) => s.draft);
  const credits = useStudio((s) => s.credits);
  const hasSelection = useStudio((s) => !!s.selected);
  const projectName = useStudio((s) => s.projects.find((p) => p.id === s.activeProjectId)?.name);

  // ⌘K / Ctrl+K jumps to the prompt; Esc clears the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useStudio.setState((s) => ({ focusTick: s.focusTick + 1 }));
      } else if (e.key === "Escape" && !useStudio.getState().viewer) useStudio.getState().deselect();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => applyFilters(takes, activeTags, favoritesOnly), [takes, activeTags, favoritesOnly]);
  const matching = useMemo(() => new Set(filtered.map((g) => g.id)), [filtered]);
  const cards: CardItem[] = useMemo(() => filtered.flatMap((g) => g.outputs.map((o) => ({ g, o }))), [filtered]);

  const running = takes.filter((g) => statusOf(g, now) !== "done");
  const inFlight = running.reduce((sum, g) => sum + g.cost, 0);
  const energy = running.length === 0 ? 0.12 : Math.min(1, 0.45 + running.length * 0.2);
  const draftCost = costOf(draft);

  if (!mounted) return <div className="min-h-dvh" />;

  return (
    <div className="min-h-dvh" style={{ "--sidebar-w": collapsed ? "72px" : "256px" } as React.CSSProperties}>
      {/* Desktop: floating command sidebar */}
      <div className="fixed bottom-3 left-3 top-3 z-40 hidden lg:block">
        <Sidebar energy={energy} inFlight={inFlight} draftCost={draftCost} />
      </div>

      {/* Mobile: slim header + drawer */}
      <header className="glass sticky top-0 z-40 flex h-14 items-center gap-3 border-x-0 border-t-0 px-4 pt-[env(safe-area-inset-top)] lg:hidden">
        <button onClick={() => setDrawer(true)} aria-label="Open menu" className="-ml-2 grid size-10 place-items-center rounded-lg text-muted hover:text-fg">
          <Menu className="size-5" />
        </button>
        <span className="grid size-7 place-items-center rounded-lg bg-accent font-mono text-sm font-bold text-accent-fg">T</span>
        <span className="truncate text-sm font-medium">{projectName}</span>
        <div className="ml-auto flex items-center gap-2">
          <EnergyWave energy={energy} bars={8} className="h-5 w-12" />
          <span className="flex items-center gap-1 font-mono text-sm tabular-nums">
            <Gem className="size-3.5 text-accent" />
            {credits}
          </span>
        </div>
      </header>
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/60 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.div
              className="fixed bottom-3 left-3 top-3 z-50 lg:hidden"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
            >
              <Sidebar energy={energy} inFlight={inFlight} draftCost={draftCost} onNavigate={() => setDrawer(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main
        className="px-4 pb-10 pt-5 transition-[padding] sm:px-6 lg:pr-6 lg:pt-6"
        style={{ paddingBottom: hasSelection ? "min(62vh, 480px)" : undefined }}
      >
        <div className="mx-auto max-w-[1400px] lg:pl-[calc(var(--sidebar-w)+1.5rem)] lg:transition-[padding] lg:duration-300">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">{projectName}</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Direct your next shot</h1>
            </div>
            <div className="hidden text-right font-mono text-[11px] text-faint sm:block">
              {takes.length} takes ·{" "}
              <span className={running.length ? "text-success" : ""}>{running.length} rendering</span>
            </div>
          </div>

          <Composer />

          <div className="sticky top-14 z-20 -mx-4 mt-6 flex items-center gap-3 bg-gradient-to-b from-bg via-bg/90 to-transparent px-4 pb-3 pt-2 sm:-mx-6 sm:px-6 lg:top-0">
            <FilterPills takes={takes} />
            <ViewToggle />
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {takes.length === 0 ? (
                <div className="glass grid place-items-center rounded-2xl px-6 py-20 text-center">
                  <div>
                    <h2 className="text-lg font-medium">An empty stage</h2>
                    <p className="mt-1 text-sm text-muted">Write a prompt above. Every take you make keeps its recipe, so you can branch from it later.</p>
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
        </div>
      </main>

      <TweakDock now={now} />
      <Viewer now={now} />
    </div>
  );
}
