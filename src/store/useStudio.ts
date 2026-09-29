"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { costOf, defaultImageRecipe, defaultVideoRecipe, MAX_STYLE_REFS, newSeed, STARTING_CREDITS } from "@/lib/catalog";
import { simulate, tagsFor, titleFrom } from "@/lib/mock";
import { avatarFor, seedGenerations } from "@/lib/seed";
import type { Generation, ImageRecipe, InpaintMask, Mode, Op, Output, Project, Recipe, RecipeFor, Reference, VideoRecipe } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 10);

const SAMPLE_PROJECT: Project = { id: "sample", name: "Sample project", createdAt: 0 };
export const YOU = { name: "Demo Creator", avatar: avatarFor("Demo Creator") };

export type ViewMode = "grid" | "graph";

interface Selection {
  generationId: string;
  outputId: string;
}

export interface Toast {
  id: number;
  message: string;
  thumb?: string;
  action?: { label: string; run: () => void };
}

interface Drafts {
  image: ImageRecipe;
  video: VideoRecipe;
}

interface StudioState {
  projects: Project[];
  activeProjectId: string;
  generations: Generation[];
  credits: number;
  drafts: Drafts;
  /** The take each draft was derived from, if any. */
  draftParents: Record<Mode, string | null>;
  /** When locked, the seed survives a submit instead of being re-rolled. */
  seedLocked: Record<Mode, boolean>;
  focusTick: number;
  // UI
  view: ViewMode;
  activeTags: string[];
  favoritesOnly: boolean;
  selected: Selection | null;
  viewer: Selection | null;
  inpainting: Selection | null;
  profileOpen: boolean;
  toast: Toast | null;

  setDraft: <M extends Mode>(mode: M, patch: Partial<RecipeFor<M>>) => void;
  setSeedLocked: (mode: Mode, locked: boolean) => void;
  clearParent: (mode: Mode) => void;
  submit: (mode: Mode, opts?: { recipe?: Recipe; parentId?: string | null; op?: Op | null; title?: string }) => boolean;
  loadRecipe: (recipe: Recipe, parentId: string | null) => void;
  reusePrompt: (generationId: string) => void;
  reuseRecipe: (generationId: string) => void;
  forkParams: (generationId: string) => void;
  upscale: (generationId: string, outputId: string) => void;
  variations: (generationId: string, outputId: string) => void;
  inpaint: (generationId: string, outputId: string, mask: InpaintMask) => void;
  /** Sets an image result as the video draft's start frame (the caller navigates to Video Studio). */
  animate: (generationId: string, outputId: string) => void;
  addStyleRef: (ref: Reference) => void;
  setKeyframe: (slot: "startFrame" | "endFrame", ref: Reference | null) => void;
  vary: (generationId: string) => void;
  toggleFavorite: (generationId: string) => void;
  createProject: (name: string) => void;
  setActiveProject: (id: string) => void;
  setView: (view: ViewMode) => void;
  toggleTag: (tag: string) => void;
  clearFilters: () => void;
  setFavoritesOnly: (on: boolean) => void;
  select: (generationId: string, outputId: string) => void;
  deselect: () => void;
  openViewer: (generationId: string, outputId: string) => void;
  closeViewer: () => void;
  openInpaint: (generationId: string, outputId: string) => void;
  closeInpaint: () => void;
  setProfileOpen: (open: boolean) => void;
  showToast: (t: Omit<Toast, "id">) => void;
  dismissToast: () => void;
  topUp: () => void;
  resetDemo: () => void;
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

export const refFromOutput = (g: Generation, o: Output): Reference => ({ src: o.poster, name: g.title, sourceKey: o.key });

const initialData = () => ({
  projects: [SAMPLE_PROJECT],
  activeProjectId: SAMPLE_PROJECT.id,
  generations: seedGenerations(SAMPLE_PROJECT.id),
  credits: STARTING_CREDITS,
  drafts: { image: defaultImageRecipe(), video: defaultVideoRecipe() },
  draftParents: { image: null, video: null },
  seedLocked: { image: false, video: false },
});

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => {
      const find = (id: string) => get().generations.find((x) => x.id === id);
      const findOut = (id: string, outputId: string) => {
        const g = find(id);
        const o = g?.outputs.find((x) => x.id === outputId);
        return g && o ? { g, o } : null;
      };
      /** Like findOut, but only for image takes, with the recipe narrowed. */
      const findImage = (id: string, outputId: string) => {
        const hit = findOut(id, outputId);
        return hit && hit.g.recipe.mode === "image" ? { ...hit, r: hit.g.recipe } : null;
      };
      /** Loads a recipe into its screen's composer and focuses the prompt. */
      const loadDraft = (recipe: Recipe, parentId: string | null) =>
        set((s) => ({
          drafts: { ...s.drafts, [recipe.mode]: recipe },
          draftParents: { ...s.draftParents, [recipe.mode]: parentId },
          viewer: null,
          selected: null,
          focusTick: s.focusTick + 1,
        }));

      return {
        ...initialData(),
        focusTick: 0,
        view: "grid",
        activeTags: [],
        favoritesOnly: false,
        selected: null,
        viewer: null,
        inpainting: null,
        profileOpen: false,
        toast: null,

        setDraft: (mode, patch) => set((s) => ({ drafts: { ...s.drafts, [mode]: { ...s.drafts[mode], ...patch } } })),
        setSeedLocked: (mode, locked) => set((s) => ({ seedLocked: { ...s.seedLocked, [mode]: locked } })),
        clearParent: (mode) => set((s) => ({ draftParents: { ...s.draftParents, [mode]: null } })),

        submit: (mode, opts = {}) => {
          const s = get();
          const r = opts.recipe ?? s.drafts[mode];
          const op = opts.op ?? null;
          const cost = costOf(r, op);
          if (!r.prompt.trim() || cost > s.credits) return false;
          const now = Date.now();
          const sim = simulate(r, now, op);
          const n = s.generations.filter((g) => g.projectId === s.activeProjectId && g.recipe.mode === r.mode).reduce((m, g) => Math.max(m, g.n), 0) + 1;
          const generation: Generation = {
            ...sim,
            n,
            projectId: s.activeProjectId,
            title: opts.title ?? titleFrom(r.prompt),
            tags: tagsFor(r, sim.outputs[0].key, op),
            likes: 0,
            author: YOU,
            favorite: false,
            recipe: r,
            op,
            parentId: opts.parentId === undefined ? s.draftParents[mode] : opts.parentId,
            createdAt: now,
            cost,
          };
          const fromComposer = !opts.recipe;
          set({
            generations: [generation, ...s.generations],
            credits: s.credits - cost,
            // Keep the draft so iterating is one keystroke away; re-roll the seed unless it's locked.
            ...(fromComposer
              ? {
                  drafts: { ...s.drafts, [mode]: { ...r, seed: s.seedLocked[mode] ? r.seed : newSeed() } },
                  draftParents: { ...s.draftParents, [mode]: null },
                }
              : {}),
          });
          return true;
        },

        loadRecipe: (recipe, parentId) => loadDraft(recipe, parentId),

        reusePrompt: (id) => {
          const g = find(id);
          if (g) loadDraft({ ...get().drafts[g.recipe.mode], prompt: g.recipe.prompt }, g.id);
        },

        reuseRecipe: (id) => {
          const g = find(id);
          if (g) loadDraft(structuredClone(g.recipe), g.id);
        },

        forkParams: (id) => {
          const g = find(id);
          if (g) loadDraft({ ...structuredClone(g.recipe), seed: newSeed() }, g.id);
        },

        upscale: (id, outputId) => {
          const hit = findImage(id, outputId);
          if (!hit) return;
          const { g, o, r } = hit;
          const recipe: ImageRecipe = { ...r, resolution: "4K", count: 1, styleRefs: [{ ...refFromOutput(g, o), role: "style", weight: 1 }] };
          if (get().submit("image", { recipe, parentId: g.id, op: "upscale", title: `${g.title} — 4K` }))
            get().showToast({ message: "Upscaling to 4K…", thumb: o.poster });
        },

        variations: (id, outputId) => {
          const hit = findImage(id, outputId);
          if (!hit) return;
          const { g, o, r } = hit;
          const recipe: ImageRecipe = { ...r, count: 4, seed: newSeed(), styleRefs: [{ ...refFromOutput(g, o), role: "style", weight: 0.85 }] };
          if (get().submit("image", { recipe, parentId: g.id, op: "variations", title: `${g.title} — Variations` }))
            get().showToast({ message: "Generating 4 variations…", thumb: o.poster });
        },

        inpaint: (id, outputId, mask) => {
          const hit = findImage(id, outputId);
          if (!hit) return;
          const { g, o, r } = hit;
          const recipe: ImageRecipe = { ...r, count: 1, inpaint: mask, styleRefs: [{ ...refFromOutput(g, o), role: "style", weight: 1 }] };
          if (get().submit("image", { recipe, parentId: g.id, op: "inpaint", title: `${g.title} — ${titleFrom(mask.prompt)}` })) {
            set({ inpainting: null });
            get().showToast({ message: `Inpainting “${mask.prompt}”…`, thumb: o.poster });
          }
        },

        animate: (id, outputId) => {
          const hit = findOut(id, outputId);
          if (!hit) return;
          const { g, o } = hit;
          const video = get().drafts.video;
          loadDraft({ ...video, prompt: video.prompt || g.recipe.prompt, startFrame: refFromOutput(g, o), seed: newSeed() }, null);
        },

        addStyleRef: (ref) =>
          set((s) => {
            const refs = s.drafts.image.styleRefs;
            const next = [...refs.slice(0, MAX_STYLE_REFS - 1), { ...ref, role: "style" as const, weight: 0.7 }];
            return { drafts: { ...s.drafts, image: { ...s.drafts.image, styleRefs: next } } };
          }),

        setKeyframe: (slot, ref) => set((s) => ({ drafts: { ...s.drafts, video: { ...s.drafts.video, [slot]: ref } } })),

        vary: (id) => {
          const g = find(id);
          if (g && get().submit(g.recipe.mode, { recipe: { ...g.recipe, seed: newSeed() }, parentId: g.id })) set({ viewer: null });
        },

        toggleFavorite: (id) => set((s) => ({ generations: s.generations.map((g) => (g.id === id ? { ...g, favorite: !g.favorite } : g)) })),

        createProject: (name) => {
          const p: Project = { id: uid(), name, createdAt: Date.now() };
          set((s) => ({ projects: [...s.projects, p], activeProjectId: p.id, draftParents: { image: null, video: null }, selected: null, viewer: null }));
        },

        setActiveProject: (id) => set({ activeProjectId: id, draftParents: { image: null, video: null }, selected: null, viewer: null, activeTags: [] }),
        setView: (view) => set({ view }),
        toggleTag: (tag) => set((s) => ({ activeTags: s.activeTags.includes(tag) ? s.activeTags.filter((t) => t !== tag) : [...s.activeTags, tag] })),
        clearFilters: () => set({ activeTags: [], favoritesOnly: false }),
        setFavoritesOnly: (favoritesOnly) => set({ favoritesOnly }),
        select: (generationId, outputId) => set({ selected: { generationId, outputId } }),
        deselect: () => set({ selected: null }),
        openViewer: (generationId, outputId) => set({ viewer: { generationId, outputId } }),
        closeViewer: () => set({ viewer: null }),
        openInpaint: (generationId, outputId) => set({ inpainting: { generationId, outputId }, viewer: null }),
        closeInpaint: () => set({ inpainting: null }),
        setProfileOpen: (profileOpen) => set({ profileOpen }),
        showToast: (t) => set({ toast: { ...t, id: Date.now() } }),
        dismissToast: () => set({ toast: null }),
        topUp: () => set((s) => ({ credits: s.credits + 100 })),
        resetDemo: () => set({ ...initialData(), selected: null, viewer: null, activeTags: [], favoritesOnly: false, profileOpen: false }),
      };
    },
    {
      name: "takes-studio-v4",
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ projects, activeProjectId, generations, credits, drafts, draftParents, seedLocked, view }) => ({
        projects,
        activeProjectId,
        generations,
        credits,
        drafts,
        draftParents,
        seedLocked,
        view,
      }),
    }
  )
);

/** Takes in the active project for one studio, newest first. */
export const useStudioTakes = (mode: Mode) => {
  const all = useStudio((s) => s.generations);
  const pid = useStudio((s) => s.activeProjectId);
  return all.filter((g) => g.projectId === pid && g.recipe.mode === mode);
};

/** Takes after tag and favorite filters (a take matches if it has every active tag). */
export function applyFilters(takes: Generation[], tags: string[], favoritesOnly: boolean) {
  return takes.filter((g) => (!favoritesOnly || g.favorite) && tags.every((t) => g.tags.includes(t)));
}
