"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useNow } from "@/hooks/useNow";
import { statusOf } from "@/lib/mock";
import type { Mode } from "@/lib/types";
import { useStudio } from "@/store/useStudio";
import { InpaintDialog } from "../dock/InpaintDialog";
import { TweakDock } from "../dock/TweakDock";
import { Viewer } from "../dock/Viewer";
import { Header } from "./Header";
import { ProfileDrawer } from "./ProfileDrawer";
import { Toast } from "./Toast";

const NowContext = createContext(0);
/** Shared clock for progress UI; ticks only while something is rendering. */
export const useStudioNow = () => useContext(NowContext);

export const modeFromPath = (path: string | null): Mode => (path?.startsWith("/video") ? "video" : "image");

/** Persistent frame around both studios: header tabs, profile drawer, remix dock, viewer, inpaint, toasts. */
export function StudioShell({ children }: { children: React.ReactNode }) {
  const mode = modeFromPath(usePathname());
  // The store lives in localStorage, so render only after mount to avoid hydration mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  const latestEnd = useStudio((s) => s.generations.reduce((m, g) => Math.max(m, g.endAt), 0));
  const now = useNow(latestEnd);
  const generations = useStudio((s) => s.generations);
  const activeProjectId = useStudio((s) => s.activeProjectId);
  const inpaintKey = useStudio((s) => s.inpainting?.outputId);

  // Switching studios clears selection and filters that belonged to the other screen.
  useEffect(() => {
    useStudio.setState({ selected: null, viewer: null, activeTags: [], favoritesOnly: false });
  }, [mode]);

  // ⌘K / Ctrl+K jumps to the prompt; Esc clears the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useStudio.setState((s) => ({ focusTick: s.focusTick + 1 }));
      } else if (e.key === "Escape") {
        const s = useStudio.getState();
        if (!s.viewer && !s.inpainting && !s.profileOpen) s.deselect();
        if (s.profileOpen) s.setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const running = generations.filter((g) => g.projectId === activeProjectId && statusOf(g, now) !== "done");
  const rendering = { image: running.filter((g) => g.recipe.mode === "image").length, video: running.filter((g) => g.recipe.mode === "video").length };
  const inFlight = running.reduce((sum, g) => sum + g.cost, 0);
  const energy = running.length === 0 ? 0.12 : Math.min(1, 0.45 + running.length * 0.2);

  if (!mounted) return <div className="min-h-dvh" />;

  return (
    <NowContext.Provider value={now}>
      <div className="min-h-dvh">
        <Header mode={mode} energy={energy} rendering={rendering} />
        {children}
        <TweakDock now={now} />
        <Viewer now={now} mode={mode} />
        <InpaintDialog key={inpaintKey ?? "none"} />
        <ProfileDrawer mode={mode} energy={energy} inFlight={inFlight} />
        <Toast />
      </div>
    </NowContext.Provider>
  );
}
