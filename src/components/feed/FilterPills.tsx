"use client";

import { LayoutGroup, motion } from "framer-motion";
import { Heart, Sparkles, X } from "lucide-react";
import { cameraOf, stylePreset } from "@/lib/catalog";
import type { Generation, Mode } from "@/lib/types";
import { applyFilters, useStudio } from "@/store/useStudio";

/** Tags suggested by what the user is typing right now (or the preset they picked). */
function suggestedTags(prompt: string, presetTag: string | null, known: string[]) {
  const text = prompt.toLowerCase();
  const hits = known.filter((t) => t.toLowerCase().split(" ").some((w) => w.length > 3 && text.includes(w)));
  return [...new Set([presetTag, ...hits].filter((t): t is string => !!t && known.includes(t)))];
}

export function FilterPills({ takes, mode }: { takes: Generation[]; mode: Mode }) {
  const activeTags = useStudio((s) => s.activeTags);
  const favoritesOnly = useStudio((s) => s.favoritesOnly);
  const toggleTag = useStudio((s) => s.toggleTag);
  const clearFilters = useStudio((s) => s.clearFilters);
  const setFavoritesOnly = useStudio((s) => s.setFavoritesOnly);
  const draft = useStudio((s) => s.drafts[mode]);

  // Counts reflect the current filter, so pills that would empty the feed disappear.
  const visible = applyFilters(takes, activeTags, favoritesOnly);
  const counts = new Map<string, number>();
  for (const g of visible) for (const t of g.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const allTags = [...new Set(takes.flatMap((g) => g.tags))];
  const suggested = suggestedTags(draft.prompt, draft.mode === "image" ? stylePreset(draft.stylePreset).tag : cameraOf(draft.camera).tag, allTags).filter(
    (t) => !activeTags.includes(t) && counts.has(t)
  );
  const rest = [...counts.entries()]
    .filter(([t]) => !activeTags.includes(t) && !suggested.includes(t))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t]) => t);
  const favCount = takes.filter((g) => g.favorite).length;
  const anyFilter = activeTags.length > 0 || favoritesOnly;

  const pill = (key: string, content: React.ReactNode, active: boolean, onClick: () => void, extra = "") => (
    <motion.button
      layout
      key={key}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors ${
        active ? "border-accent bg-accent text-accent-fg" : `border-line bg-white/[0.03] text-muted hover:border-line-strong hover:text-fg ${extra}`
      }`}
    >
      {content}
    </motion.button>
  );

  return (
    <LayoutGroup>
      <div className="no-scrollbar fade-mask-x -mx-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1 py-1">
        {pill("all", "All", !anyFilter, clearFilters)}
        {pill(
          "fav",
          <>
            <Heart className={`size-3.5 ${favoritesOnly ? "fill-current" : ""}`} /> Favorites
            <span className="font-mono opacity-60">{favCount}</span>
          </>,
          favoritesOnly,
          () => setFavoritesOnly(!favoritesOnly)
        )}
        {activeTags.map((t) =>
          pill(
            `tag-${t}`,
            <>
              {t}
              <X className="size-3" />
            </>,
            true,
            () => toggleTag(t)
          )
        )}
        {suggested.map((t) =>
          pill(
            `tag-${t}`,
            <>
              <Sparkles className="size-3 text-accent" />
              {t}
              <span className="font-mono opacity-60">{counts.get(t)}</span>
            </>,
            false,
            () => toggleTag(t),
            "border-accent/40"
          )
        )}
        {rest.map((t) =>
          pill(
            `tag-${t}`,
            <>
              {t}
              <span className="font-mono opacity-50">{counts.get(t)}</span>
            </>,
            false,
            () => toggleTag(t)
          )
        )}
      </div>
    </LayoutGroup>
  );
}
