"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { costOf, defaultRecipe, newSeed, PRESETS, STARTING_CREDITS } from "@/lib/catalog";
import { simulate, tagsFor, titleFrom } from "@/lib/mock";
import { avatarFor, seedGenerations } from "@/lib/seed";
import type { Generation, Mode, Output, Project, Recipe } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 10);

const SHOWCASE: Project = { id: "showcase", name: "Showcase", createdAt: 0 };
export const YOU = { name: "You", avatar: avatarFor("You") };

export type ViewMode = "grid" | "graph";

interface Selection {
  generationId: string;
  outputId: string;
}

interface StudioState {
  projects: Project[];
  activeProjectId: string;
  generations: Generation[];
  credits: number;
  draft: Recipe;
  /** The take the current draft was derived from, if any. */
  draftParentId: string | null;
  focusTick: number;
  // UI
  view: ViewMode;
  activeTags: string[];
  favoritesOnly: boolean;
  sidebarCollapsed: boolean;
  selected: Selection | null;
  viewer: Selection | null;

  setDraft: (patch: Partial<Recipe>) => void;
  setMode: (mode: Mode) => void;
  clearParent: () => void;
  submit: (recipe?: Recipe, parentId?: string | null) => boolean;
  loadRecipe: (recipe: Recipe, parentId: string | null) => void;
  reusePrompt: (generationId: string) => void;
  reuseRecipe: (generationId: string) => void;
  forkParams: (generationId: string) => void;
  remix: (generationId: string, outputId: string, asVideo?: boolean) => void;
  vary: (generationId: string) => void;
  toggleFavorite: (generationId: string) => void;
  createProject: (name: string) => void;
  setActiveProject: (id: string) => void;
  setView: (view: ViewMode) => void;
  toggleTag: (tag: string) => void;
  clearFilters: () => void;
  setFavoritesOnly: (on: boolean) => void;
  toggleSidebar: () => void;
  select: (generationId: string, outputId: string) => void;
  deselect: () => void;
  openViewer: (generationId: string, outputId: string) => void;
  closeViewer: () => void;
  topUp: () => void;
}

// localStorage can be full (uploaded references) or unavailable; never crash on it.
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* keep working in memory */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};

const referenceFrom = (g: Generation, o: Output) => ({ src: o.poster, name: g.title, sourceKey: o.key });

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => {
      const find = (id: string) => get().generations.find((x) => x.id === id);
      /** Loads a recipe into the composer and focuses the prompt. */
      const loadDraft = (draft: Recipe, parentId: string | null) =>
        set((s) => ({ draft, draftParentId: parentId, viewer: null, focusTick: s.focusTick + 1 }));

      return {
        projects: [SHOWCASE],
        activeProjectId: SHOWCASE.id,
        generations: seedGenerations(SHOWCASE.id),
        credits: STARTING_CREDITS,
        draft: defaultRecipe(),
        draftParentId: null,
        focusTick: 0,
        view: "grid",
        activeTags: [],
        favoritesOnly: false,
        sidebarCollapsed: false,
        selected: null,
        viewer: null,

        setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),

        setMode: (mode) =>
          set((s) =>
            s.draft.mode === mode
              ? s
              : { draft: { ...s.draft, mode, presetId: PRESETS[mode][0].id, count: mode === "image" ? 2 : 1 } }
          ),

        clearParent: () => set({ draftParentId: null }),

        submit: (recipe, parentId) => {
          const s = get();
          const r = recipe ?? s.draft;
          const cost = costOf(r);
          if (!r.prompt.trim() || cost > s.credits) return false;
          const now = Date.now();
          const sim = simulate(r, now);
          const n = s.generations.filter((g) => g.projectId === s.activeProjectId).reduce((m, g) => Math.max(m, g.n), 0) + 1;
          const generation: Generation = {
            ...sim,
            n,
            projectId: s.activeProjectId,
            title: titleFrom(r.prompt),
            tags: tagsFor(r, sim.outputs[0].key),
            likes: 0,
            author: YOU,
            favorite: false,
            recipe: r,
            parentId: parentId === undefined ? s.draftParentId : parentId,
            createdAt: now,
            cost,
          };
          set({
            generations: [generation, ...s.generations],
            credits: s.credits - cost,
            // Fresh seed for the next run; keep everything else so iterating is one keystroke away.
            ...(recipe ? {} : { draft: { ...r, seed: newSeed() }, draftParentId: null }),
          });
          return true;
        },

        loadRecipe: (recipe, parentId) => {
          loadDraft(recipe, parentId);
          set({ selected: null });
        },

        reusePrompt: (id) => {
          const g = find(id);
          if (g) loadDraft({ ...get().draft, prompt: g.recipe.prompt }, g.id);
        },

        reuseRecipe: (id) => {
          const g = find(id);
          if (g) loadDraft({ ...g.recipe }, g.id);
        },

        forkParams: (id) => {
          const g = find(id);
          if (g) loadDraft({ ...g.recipe, seed: newSeed() }, g.id);
        },

        remix: (id, outputId, asVideo = false) => {
          const g = find(id);
          const o = g?.outputs.find((x) => x.id === outputId);
          if (!g || !o) return;
          const base = asVideo
            ? { ...g.recipe, mode: "video" as const, modelId: "motion-pro", presetId: "push-in", count: 1 }
            : g.recipe;
          loadDraft({ ...base, seed: newSeed(), reference: referenceFrom(g, o) }, g.id);
        },

        vary: (id) => {
          const g = find(id);
          if (g && get().submit({ ...g.recipe, seed: newSeed() }, g.id)) set({ viewer: null });
        },

        toggleFavorite: (id) =>
          set((s) => ({ generations: s.generations.map((g) => (g.id === id ? { ...g, favorite: !g.favorite } : g)) })),

        createProject: (name) => {
          const p: Project = { id: uid(), name, createdAt: Date.now() };
          set((s) => ({ projects: [...s.projects, p], activeProjectId: p.id, draftParentId: null, selected: null, viewer: null }));
        },

        setActiveProject: (id) => set({ activeProjectId: id, draftParentId: null, selected: null, viewer: null, activeTags: [] }),
        setView: (view) => set({ view }),
        toggleTag: (tag) =>
          set((s) => ({ activeTags: s.activeTags.includes(tag) ? s.activeTags.filter((t) => t !== tag) : [...s.activeTags, tag] })),
        clearFilters: () => set({ activeTags: [], favoritesOnly: false }),
        setFavoritesOnly: (favoritesOnly) => set({ favoritesOnly }),
        toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
        select: (generationId, outputId) => set({ selected: { generationId, outputId } }),
        deselect: () => set({ selected: null }),
        openViewer: (generationId, outputId) => set({ viewer: { generationId, outputId } }),
        closeViewer: () => set({ viewer: null }),
        topUp: () => set((s) => ({ credits: s.credits + 100 })),
      };
    },
    {
      name: "takes-studio-v2",
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ projects, activeProjectId, generations, credits, draft, draftParentId, view, sidebarCollapsed }) => ({
        projects,
        activeProjectId,
        generations,
        credits,
        draft,
        draftParentId,
        view,
        sidebarCollapsed,
      }),
    }
  )
);

/** Takes in the active project, newest first. */
export const useProjectTakes = () => {
  const all = useStudio((s) => s.generations);
  const pid = useStudio((s) => s.activeProjectId);
  return all.filter((g) => g.projectId === pid);
};

/** Takes after tag and favorite filters (a take matches if it has every active tag). */
export function applyFilters(takes: Generation[], tags: string[], favoritesOnly: boolean) {
  return takes.filter((g) => (!favoritesOnly || g.favorite) && tags.every((t) => g.tags.includes(t)));
}
