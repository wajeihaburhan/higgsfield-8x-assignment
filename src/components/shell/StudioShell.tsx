"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useNow } from "@/hooks/useNow";
import { statusOf } from "@/lib/mock";
import type { Screen } from "@/lib/types";
import { useStudio } from "@/store/useStudio";
import { InpaintDialog } from "../dock/InpaintDialog";
import { TweakDock } from "../dock/TweakDock";
import { Viewer } from "../dock/Viewer";
import { Header } from "./Header";
import { ProfileDrawer } from "./ProfileDrawer";
import { Toast } from "./Toast";

/** How long a finished take stays in the render tray before it slides away. */
export const RECENT_MS = 8000;

const NowContext = createContext(0);
/** Shared clock for progress UI; ticks only while something is rendering. */
export const useStudioNow = () => useContext(NowContext);

export const screenFromPath = (path: string | null): Screen =>
  path?.startsWith("/video") ? "video" : path?.startsWith("/image") ? "image" : "showcase";

/** Persistent frame around both studios: header tabs, profile drawer, remix dock, viewer, inpaint, toasts. */
export function StudioShell({ children }: { children: React.ReactNode }) {
  const screen = screenFromPath(usePathname());
  const router = useRouter();
  // The store lives in localStorage, so render only after mount to avoid hydration mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  const latestEnd = useStudio((s) => s.generations.reduce((m, g) => Math.max(m, g.endAt), 0));
  // Tick a little past the last job so finished takes can leave the render tray on time.
  const now = useNow(latestEnd + RECENT_MS);
  const generations = useStudio((s) => s.generations);
  const activeProjectId = useStudio((s) => s.activeProjectId);
  const inpaintKey = useStudio((s) => s.inpainting?.outputId);

  // Switching studios clears selection and filters that belonged to the other screen.
  useEffect(() => {
    useStudio.setState({ selected: null, viewer: null, activeTags: [], favoritesOnly: false });
  }, [screen]);

  // ⌘K / Ctrl+K jumps to the prompt; Esc clears the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        // The dashboard has no prompt; jump to Image Studio, which focuses its prompt on mount.
        if (screenFromPath(window.location.pathname) === "showcase") router.push("/image");
        useStudio.setState((s) => ({ focusTick: s.focusTick + 1 }));
      } else if (e.key === "Escape") {
        const s = useStudio.getState();
        if (!s.viewer && !s.inpainting && !s.profileOpen) s.deselect();
        if (s.profileOpen) s.setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const running = generations.filter((g) => g.projectId === activeProjectId && statusOf(g, now) !== "done");
  const image = running.filter((g) => g.recipe.mode === "image").length;
  const rendering = { image, video: running.length - image, showcase: running.length };
  const inFlight = running.reduce((sum, g) => sum + g.cost, 0);
  const energy = running.length === 0 ? 0.12 : Math.min(1, 0.45 + running.length * 0.2);

  if (!mounted) return <div className="min-h-dvh" />;

  return (
    <NowContext.Provider value={now}>
      <div className="min-h-dvh">
        <Header screen={screen} energy={energy} rendering={rendering} />
        {children}
        <TweakDock now={now} />
        <Viewer now={now} screen={screen} />
        <InpaintDialog key={inpaintKey ?? "none"} />
        <ProfileDrawer mode={screen === "video" ? "video" : "image"} energy={energy} inFlight={inFlight} />
        <Toast />
      </div>
    </NowContext.Provider>
  );
}
