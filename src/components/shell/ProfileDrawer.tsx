"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, FolderOpen, Heart, ImageIcon, Plus, RotateCcw, Film, X } from "lucide-react";
import { costOf } from "@/lib/catalog";
import type { Mode } from "@/lib/types";
import { useStudio, YOU } from "@/store/useStudio";
import { TokenUsage } from "../ui/Energy";

/** Right-hand drawer: account, credit meter, projects and demo controls. */
export function ProfileDrawer({ mode, energy, inFlight }: { mode: Mode; energy: number; inFlight: number }) {
  const open = useStudio((s) => s.profileOpen);
  const setOpen = useStudio((s) => s.setProfileOpen);
  const credits = useStudio((s) => s.credits);
  const draftCost = useStudio((s) => costOf(s.drafts[mode]));
  const projects = useStudio((s) => s.projects);
  const activeProjectId = useStudio((s) => s.activeProjectId);
  const generations = useStudio((s) => s.generations);
  const { setActiveProject, createProject, topUp, resetDemo } = useStudio.getState();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const mine = generations.filter((g) => g.projectId === activeProjectId);
  const stats = [
    { label: "Images", value: mine.filter((g) => g.recipe.mode === "image").length, Icon: ImageIcon },
    { label: "Videos", value: mine.filter((g) => g.recipe.mode === "video").length, Icon: Film },
    { label: "Favorites", value: mine.filter((g) => g.favorite).length, Icon: Heart },
  ];

  const commit = () => {
    if (name.trim()) createProject(name.trim());
    setName("");
    setNaming(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-slate-950/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
            className="glass-strong fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-sm flex-col border-y-0 border-r-0"
            role="dialog"
            aria-label="Profile"
          >
            <div className="flex items-center gap-3 border-b border-line p-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={YOU.avatar} alt="" className="size-12 rounded-full ring-2 ring-accent/50" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{YOU.name}</div>
                <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 font-mono text-[10px] text-success">Creator · Pro trial</div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close profile" className="grid size-9 place-items-center rounded-lg text-muted hover:text-fg">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <section className="glass rounded-xl p-4">
                <TokenUsage credits={credits} inFlight={inFlight} draftCost={draftCost} energy={energy} />
                <button onClick={topUp} className="mt-3 h-9 w-full rounded-lg border border-accent/40 text-sm text-accent hover:bg-accent/10" title="Demo only">
                  Top up +100 credits
                </button>
              </section>

              <section className="grid grid-cols-3 gap-2">
                {stats.map(({ label, value, Icon }) => (
                  <div key={label} className="glass rounded-xl p-3 text-center">
                    <Icon className="mx-auto size-4 text-accent" />
                    <div className="mt-1 font-mono text-lg tabular-nums">{value}</div>
                    <div className="text-[11px] text-faint">{label}</div>
                  </div>
                ))}
              </section>

              <section>
                <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-faint">
                  <FolderOpen className="size-3" /> Projects
                </div>
                <div className="space-y-1">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setActiveProject(p.id);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${p.id === activeProjectId ? "bg-accent/10 text-accent" : "text-muted hover:bg-white/5 hover:text-fg"}`}
                    >
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="font-mono text-[10px] text-faint">{generations.filter((g) => g.projectId === p.id).length}</span>
                      {p.id === activeProjectId && <Check className="size-3.5" />}
                    </button>
                  ))}
                  {naming ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        commit();
                      }}
                    >
                      <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={commit}
                        onKeyDown={(e) => e.key === "Escape" && setNaming(false)}
                        placeholder="Project name"
                        maxLength={40}
                        className="h-9 w-full rounded-lg border border-line-strong bg-surface-2 px-3 text-sm outline-none focus:border-accent"
                      />
                    </form>
                  ) : (
                    <button onClick={() => setNaming(true)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-faint hover:bg-white/5 hover:text-fg">
                      <Plus className="size-3.5" /> New project
                    </button>
                  )}
                </div>
              </section>
            </div>

            <div className="border-t border-line p-5">
              <button
                onClick={() => {
                  if (window.confirm("Reset all demo data? Your takes, projects and credits will be restored to the showcase.")) resetDemo();
                }}
                className="flex items-center gap-2 text-xs text-faint hover:text-red-300"
              >
                <RotateCcw className="size-3.5" /> Reset demo data
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
