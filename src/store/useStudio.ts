"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { costOf, defaultModel, newSeed, PRESETS, STARTING_CREDITS } from "@/lib/catalog";
import { simulate } from "@/lib/mock";
import type { Generation, Mode, Output, Project, Recipe } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 10);

const blankRecipe = (mode: Mode = "image"): Recipe => ({
  mode,
  prompt: "",
  modelId: defaultModel(mode).id,
  aspectRatio: "16:9",
  count: mode === "image" ? 2 : 1,
  durationSec: 4,
  presetId: PRESETS[mode][0].id,
  seed: newSeed(),
  reference: null,
});

const firstProject: Project = { id: "default", name: "My first project", createdAt: 0 };

interface Viewer {
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
  viewer: Viewer | null;
  focusTick: number;

  setDraft: (patch: Partial<Recipe>) => void;
  setMode: (mode: Mode) => void;
  clearParent: () => void;
  submit: (recipe?: Recipe, parentId?: string | null) => boolean;
  reuseRecipe: (generationId: string) => void;
  remix: (generationId: string, outputId: string, asVideo?: boolean) => void;
  vary: (generationId: string) => void;
  createProject: (name: string) => void;
  setActiveProject: (id: string) => void;
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

const referenceFrom = (g: Generation, o: Output) => ({
  src: o.poster,
  name: `Take ${g.n}`,
  sourceKey: o.key,
});

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => ({
      projects: [firstProject],
      activeProjectId: firstProject.id,
      generations: [],
      credits: STARTING_CREDITS,
      draft: blankRecipe(),
      draftParentId: null,
      viewer: null,
      focusTick: 0,

      setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),

      setMode: (mode) =>
        set((s) => {
          if (s.draft.mode === mode) return s;
          return {
            draft: {
              ...s.draft,
              mode,
              modelId: defaultModel(mode).id,
              presetId: PRESETS[mode][0].id,
              count: mode === "image" ? 2 : 1,
            },
          };
        }),

      clearParent: () => set({ draftParentId: null }),

      submit: (recipe, parentId) => {
        const s = get();
        const r = recipe ?? s.draft;
        const cost = costOf(r);
        if (!r.prompt.trim() || cost > s.credits) return false;
        const now = Date.now();
        const sim = simulate(r, now);
        const n = s.generations.filter((g) => g.projectId === s.activeProjectId).length + 1;
        const generation: Generation = {
          ...sim,
          n,
          projectId: s.activeProjectId,
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

      reuseRecipe: (id) => {
        const g = get().generations.find((x) => x.id === id);
        if (!g) return;
        set((s) => ({ draft: { ...g.recipe }, draftParentId: g.id, viewer: null, focusTick: s.focusTick + 1 }));
      },

      remix: (id, outputId, asVideo = false) => {
        const g = get().generations.find((x) => x.id === id);
        const o = g?.outputs.find((x) => x.id === outputId);
        if (!g || !o) return;
        const base = asVideo
          ? { ...g.recipe, mode: "video" as const, modelId: defaultModel("video").id, presetId: "push-in", count: 1 }
          : g.recipe;
        set((s) => ({
          draft: { ...base, seed: newSeed(), reference: referenceFrom(g, o) },
          draftParentId: g.id,
          viewer: null,
          focusTick: s.focusTick + 1,
        }));
      },

      vary: (id) => {
        const g = get().generations.find((x) => x.id === id);
        if (!g) return;
        if (get().submit({ ...g.recipe, seed: newSeed() }, g.id)) set({ viewer: null });
      },

      createProject: (name) => {
        const p: Project = { id: uid(), name, createdAt: Date.now() };
        set((s) => ({ projects: [...s.projects, p], activeProjectId: p.id, draftParentId: null, viewer: null }));
      },

      setActiveProject: (id) => set({ activeProjectId: id, draftParentId: null, viewer: null }),

      openViewer: (generationId, outputId) => set({ viewer: { generationId, outputId } }),
      closeViewer: () => set({ viewer: null }),
      topUp: () => set((s) => ({ credits: s.credits + 100 })),
    }),
    {
      name: "takes-studio-v1",
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ projects, activeProjectId, generations, credits, draft, draftParentId }) => ({
        projects,
        activeProjectId,
        generations,
        credits,
        draft,
        draftParentId,
      }),
    }
  )
);
