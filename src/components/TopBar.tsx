"use client";

import { useState } from "react";
import { ChevronDown, Gem, Folder, Plus } from "lucide-react";
import { useStudio } from "@/store/useStudio";

export function TopBar() {
  const projects = useStudio((s) => s.projects);
  const activeProjectId = useStudio((s) => s.activeProjectId);
  const setActiveProject = useStudio((s) => s.setActiveProject);
  const createProject = useStudio((s) => s.createProject);
  const credits = useStudio((s) => s.credits);
  const topUp = useStudio((s) => s.topUp);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const commit = () => {
    if (name.trim()) createProject(name.trim());
    setName("");
    setNaming(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-3">
        <div className="flex items-center gap-2 pr-1">
          <span className="grid size-7 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-fg">T</span>
          <span className="hidden font-semibold tracking-tight sm:inline">Takes</span>
        </div>

        <span className="text-line-strong">/</span>

        {naming ? (
          <form
            className="flex min-w-0 items-center gap-2"
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
              className="h-9 w-40 min-w-0 rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none focus:border-accent sm:w-56"
            />
          </form>
        ) : (
          <div className="flex min-w-0 items-center gap-1">
            <label className="relative flex min-w-0 items-center">
              <Folder className="pointer-events-none absolute left-2.5 size-4 text-muted" />
              <select
                aria-label="Project"
                value={activeProjectId}
                onChange={(e) => setActiveProject(e.target.value)}
                className="h-9 min-w-0 max-w-[45vw] appearance-none truncate rounded-lg bg-transparent pl-8 pr-7 text-sm font-medium hover:bg-surface focus:bg-surface focus:outline-none sm:max-w-xs"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 size-4 text-muted" />
            </label>
            <button
              onClick={() => setNaming(true)}
              className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface hover:text-fg"
              aria-label="New project"
              title="New project"
            >
              <Plus className="size-4" />
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div
            className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm tabular-nums"
            title="Simulated credits"
          >
            <Gem className="size-4 text-accent" />
            {credits}
          </div>
          {credits < 40 && (
            <button
              onClick={topUp}
              className="h-9 rounded-full bg-surface-2 px-3 text-sm text-fg hover:bg-line-strong"
              title="Demo only: adds 100 credits"
            >
              Top up
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
