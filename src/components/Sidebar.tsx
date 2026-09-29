"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Command, Cpu, FolderOpen, Gem, PanelLeftClose, PanelLeftOpen, Palette, Plus } from "lucide-react";
import { MODELS, PRESETS } from "@/lib/catalog";
import { useStudio } from "@/store/useStudio";
import { EnergyWave, TokenUsage } from "./Energy";

interface Props {
  energy: number;
  inFlight: number;
  draftCost: number;
  /** Mobile drawer mode: always expanded, closes after a pick. */
  onNavigate?: () => void;
}

function Section({ icon, title, collapsed, children }: { icon: React.ReactNode; title: string; collapsed: boolean; children: React.ReactNode }) {
  return (
    <div className="border-t border-line px-3 py-3 first:border-t-0">
      <div className={`mb-1.5 flex items-center gap-2 px-1 font-mono text-[10px] uppercase tracking-widest text-faint ${collapsed ? "justify-center" : ""}`}>
        <span title={title}>{icon}</span>
        {!collapsed && title}
      </div>
      {children}
    </div>
  );
}

function Item({ active, collapsed, label, hint, short, onClick }: { active: boolean; collapsed: boolean; label: string; hint?: string; short: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : hint}
      className={`group relative flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
        active ? "bg-accent/10 text-accent" : "text-muted hover:bg-white/5 hover:text-fg"
      } ${collapsed ? "justify-center" : ""}`}
    >
      {collapsed ? (
        <span className="grid size-7 place-items-center rounded-md bg-surface-2 font-mono text-[10px]">{short}</span>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {active && <Check className="size-3.5 shrink-0" />}
        </>
      )}
    </button>
  );
}

export function Sidebar({ energy, inFlight, draftCost, onNavigate }: Props) {
  const collapsedPref = useStudio((s) => s.sidebarCollapsed);
  const collapsed = onNavigate ? false : collapsedPref;
  const toggleSidebar = useStudio((s) => s.toggleSidebar);
  const draft = useStudio((s) => s.draft);
  const setDraft = useStudio((s) => s.setDraft);
  const projects = useStudio((s) => s.projects);
  const activeProjectId = useStudio((s) => s.activeProjectId);
  const setActiveProject = useStudio((s) => s.setActiveProject);
  const createProject = useStudio((s) => s.createProject);
  const credits = useStudio((s) => s.credits);
  const topUp = useStudio((s) => s.topUp);
  const bumpFocus = () => useStudio.setState((s) => ({ focusTick: s.focusTick + 1 }));
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const pick = (fn: () => void) => () => {
    fn();
    onNavigate?.();
  };
  const commitProject = () => {
    if (name.trim()) createProject(name.trim());
    setName("");
    setNaming(false);
    onNavigate?.();
  };

  return (
    <motion.nav
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ type: "spring", stiffness: 400, damping: 36 }}
      className="glass flex h-full flex-col overflow-hidden rounded-2xl shadow-2xl shadow-black/40"
      aria-label="Studio"
    >
      <div className={`flex h-14 shrink-0 items-center gap-2 px-4 ${collapsed ? "justify-center px-0" : ""}`}>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent font-mono text-sm font-bold text-accent-fg">T</span>
        {!collapsed && (
          <>
            <span className="font-semibold tracking-tight">Takes</span>
            <span className="rounded border border-line px-1 font-mono text-[10px] text-faint">studio</span>
          </>
        )}
        {!onNavigate && !collapsed && (
          <button onClick={toggleSidebar} aria-label="Collapse sidebar" className="ml-auto grid size-8 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-fg">
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>
      {!onNavigate && collapsed && (
        <button onClick={toggleSidebar} aria-label="Expand sidebar" className="mx-auto mb-1 grid size-8 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-fg">
          <PanelLeftOpen className="size-4" />
        </button>
      )}

      <button
        onClick={pick(bumpFocus)}
        className={`mx-3 mb-2 flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-2.5 text-sm text-muted hover:border-line-strong hover:text-fg ${collapsed ? "justify-center px-0" : ""}`}
        title="Jump to prompt (⌘K)"
      >
        <Command className="size-3.5 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">New generation</span>
            <kbd className="rounded bg-white/5 px-1.5 font-mono text-[10px] text-faint">⌘K</kbd>
          </>
        )}
      </button>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <Section icon={<Cpu className="size-3" />} title="Models" collapsed={collapsed}>
          {MODELS.map((m) => (
            <Item
              key={m.id}
              active={draft.modelId === m.id}
              collapsed={collapsed}
              label={m.name}
              hint={m.tagline}
              short={m.name.slice(0, 2).toUpperCase()}
              onClick={pick(() => setDraft({ modelId: m.id }))}
            />
          ))}
        </Section>

        <Section icon={<FolderOpen className="size-3" />} title="Projects" collapsed={collapsed}>
          {projects.map((p) => (
            <Item
              key={p.id}
              active={activeProjectId === p.id}
              collapsed={collapsed}
              label={p.name}
              short={p.name.slice(0, 2).toUpperCase()}
              onClick={pick(() => setActiveProject(p.id))}
            />
          ))}
          {!collapsed &&
            (naming ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  commitProject();
                }}
              >
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={commitProject}
                  onKeyDown={(e) => e.key === "Escape" && setNaming(false)}
                  placeholder="Project name"
                  maxLength={40}
                  className="mt-1 h-8 w-full rounded-lg border border-line-strong bg-surface px-2 text-sm outline-none focus:border-accent"
                />
              </form>
            ) : (
              <button onClick={() => setNaming(true)} className="mt-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-faint hover:bg-white/5 hover:text-fg">
                <Plus className="size-3.5" /> New project
              </button>
            ))}
        </Section>

        <Section icon={<Palette className="size-3" />} title={draft.mode === "image" ? "Style presets" : "Camera presets"} collapsed={collapsed}>
          {PRESETS[draft.mode].map((p) => (
            <Item
              key={p.id}
              active={draft.presetId === p.id}
              collapsed={collapsed}
              label={p.name}
              short={p.name.slice(0, 2).toUpperCase()}
              onClick={pick(() => setDraft({ presetId: p.id }))}
            />
          ))}
        </Section>
      </div>

      <div className="shrink-0 border-t border-line p-3">
        <AnimatePresence initial={false} mode="wait">
          {collapsed ? (
            <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2" title={`${credits} credits`}>
              <EnergyWave energy={energy} bars={6} className="h-6 w-10" />
              <span className="flex items-center gap-1 font-mono text-[11px] tabular-nums">
                <Gem className="size-3 text-accent" />
                {credits}
              </span>
            </motion.div>
          ) : (
            <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TokenUsage credits={credits} inFlight={inFlight} draftCost={draftCost} energy={energy} />
              {credits < 40 && (
                <button onClick={topUp} className="mt-2 h-8 w-full rounded-lg bg-accent/15 text-sm text-accent hover:bg-accent/25" title="Demo only: adds 100 credits">
                  Top up +100
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
}
