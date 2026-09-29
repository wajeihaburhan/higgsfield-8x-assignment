"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Command, Film, Gem, ImageIcon, LayoutDashboard } from "lucide-react";
import type { Screen } from "@/lib/types";
import { useStudio, YOU } from "@/store/useStudio";
import { EnergyWave } from "../ui/Energy";

const TABS: { screen: Screen; href: string; label: string; short: string; Icon: typeof Film }[] = [
  { screen: "showcase", href: "/showcase", label: "Showcase", short: "Showcase", Icon: LayoutDashboard },
  { screen: "image", href: "/image", label: "Image Studio", short: "Image", Icon: ImageIcon },
  { screen: "video", href: "/video", label: "Video Studio", short: "Video", Icon: Film },
];

export function Header({ screen, energy, rendering }: { screen: Screen; energy: number; rendering: Record<Screen, number> }) {
  const router = useRouter();
  const credits = useStudio((s) => s.credits);
  const setProfileOpen = useStudio((s) => s.setProfileOpen);
  const projectName = useStudio((s) => s.projects.find((p) => p.id === s.activeProjectId)?.name);

  return (
    <header className="sticky top-0 z-40 border-b border-cyan-500/15 bg-slate-950/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
        <Link href="/showcase" className="hidden shrink-0 items-center gap-2 sm:flex" aria-label="Takes home">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-success font-mono text-sm font-bold text-accent-fg shadow-[0_0_18px_rgb(0_245_255/0.45)]">T</span>
          <span className="hidden font-semibold tracking-tight md:inline">Takes</span>
        </Link>

        <nav className="glass flex rounded-xl p-1 sm:ml-4" aria-label="Studios">
          {TABS.map((t) => {
            const active = t.screen === screen;
            return (
              <Link
                key={t.screen}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors sm:px-4 ${active ? "text-accent-fg" : "text-muted hover:text-fg"}`}
              >
                {active && <motion.span layoutId="studio-tab" className="absolute inset-0 rounded-lg bg-accent shadow-[0_0_20px_rgb(0_245_255/0.5)]" transition={{ type: "spring", stiffness: 480, damping: 38 }} />}
                <t.Icon className="relative size-4" />
                <span className="relative hidden sm:inline">{t.label}</span>
                {/* On phones only the active tab shows its name, so three tabs fit beside the credits. */}
                {active && <span className="relative sm:hidden">{t.short}</span>}
                {rendering[t.screen] > 0 && (
                  <span className={`relative grid h-4 min-w-4 place-items-center rounded-full px-1 font-mono text-[10px] ${active ? "bg-accent-fg/80 text-success" : "bg-success text-accent-fg"}`} title={`${rendering[t.screen]} rendering`}>
                    {rendering[t.screen]}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => {
              if (screen === "showcase") router.push("/image");
              useStudio.setState((s) => ({ focusTick: s.focusTick + 1 }));
            }}
            className="hidden h-9 items-center gap-2 rounded-lg border border-line px-2.5 text-xs text-muted hover:border-accent/40 hover:text-fg lg:flex"
            title="Jump to prompt"
          >
            <Command className="size-3.5" />
            <span>New</span>
            <kbd className="rounded bg-white/5 px-1.5 font-mono text-[10px] text-faint">⌘K</kbd>
          </button>
          <div className="flex h-9 items-center gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-2.5" title="Credits">
            <EnergyWave energy={energy} bars={7} className="hidden h-4 w-10 sm:flex" />
            <Gem className="size-4 text-accent" />
            <span className="text-glow font-mono text-sm font-semibold tabular-nums text-accent">{credits}</span>
          </div>
          <button onClick={() => setProfileOpen(true)} className="flex shrink-0 items-center gap-2 rounded-full p-0.5 pr-0.5 hover:bg-white/5 sm:pr-3" aria-label="Open profile">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={YOU.avatar} alt="" className="size-8 rounded-full ring-2 ring-accent/40" />
            <span className="hidden max-w-32 truncate text-left text-xs leading-tight lg:block">
              <span className="block text-fg">{YOU.name}</span>
              <span className="block text-faint">{projectName}</span>
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
