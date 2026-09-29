"use client";

import { useEffect, useState } from "react";
import { useNow } from "@/hooks/useNow";
import { useStudio } from "@/store/useStudio";
import { Composer } from "./Composer";
import { Feed } from "./Feed";
import { TopBar } from "./TopBar";
import { Viewer } from "./Viewer";

export function Studio() {
  // The store lives in localStorage, so render only after mount to avoid hydration mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  const latestEnd = useStudio((s) => s.generations.reduce((m, g) => Math.max(m, g.endAt), 0));
  const now = useNow(latestEnd);

  if (!mounted) return <div className="min-h-dvh bg-bg" />;

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <main className="flex flex-1 flex-col pb-56 sm:pb-52">
        <Feed now={now} />
      </main>
      <Composer />
      <Viewer now={now} />
    </div>
  );
}
