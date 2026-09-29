import type { AspectRatio, Mode, Recipe } from "./types";

export interface Model {
  id: string;
  name: "Higgsfield-V2" | "Motion-Pro" | "Cinematic-AI";
  tagline: string;
  /** Credits per image. */
  imageCost: number;
  /** Credits per second of video. */
  videoCost: number;
  speedMs: [number, number];
  speedLabel: string;
}

export const MODELS: Model[] = [
  { id: "higgsfield-v2", name: "Higgsfield-V2", tagline: "Balanced all-rounder", imageCost: 2, videoCost: 3, speedMs: [4000, 6000], speedLabel: "Fast" },
  { id: "motion-pro", name: "Motion-Pro", tagline: "Physics-true motion", imageCost: 3, videoCost: 4, speedMs: [6000, 9000], speedLabel: "Medium" },
  { id: "cinematic-ai", name: "Cinematic-AI", tagline: "Film-grade light & color", imageCost: 4, videoCost: 5, speedMs: [8000, 11000], speedLabel: "Slow" },
];

/** Presets double as feed tags, so the filter pills and the composer speak the same language. */
export const PRESETS: Record<Mode, { id: string; name: string; tag: string | null }[]> = {
  image: [
    { id: "none", name: "No style", tag: null },
    { id: "cinematic", name: "Cinematic lighting", tag: "Cinematic Lighting" },
    { id: "cyberpunk", name: "Cyberpunk", tag: "Cyberpunk" },
    { id: "film", name: "35mm film grain", tag: "Film Grain" },
    { id: "vfx", name: "VFX particles", tag: "VFX" },
  ],
  video: [
    { id: "static", name: "Static camera", tag: null },
    { id: "pan", name: "Camera pan", tag: "Camera Pan" },
    { id: "push-in", name: "Dolly in", tag: "Dolly In" },
    { id: "orbit", name: "Orbit shot", tag: "Orbit" },
    { id: "handheld", name: "Handheld", tag: "Handheld" },
  ],
};

export const ASPECT_RATIOS: AspectRatio[] = ["1:1", "16:9", "9:16"];
export const DURATIONS = [4, 8];
export const MAX_COUNT = 4;
export const STARTING_CREDITS = 200;

export const EXAMPLE_PROMPTS = [
  "A lone hiker on a misty ridge at dawn, volumetric light",
  "Macro shot of a jellyfish glowing in deep blue water, neon",
  "Portrait of a pug wrapped in a wool blanket, soft window light",
];

export const modelById = (id: string) => MODELS.find((m) => m.id === id) ?? MODELS[0];
export const modelByName = (name: string) => MODELS.find((m) => m.name === name) ?? MODELS[0];
export const presetOf = (mode: Mode, id: string) => PRESETS[mode].find((p) => p.id === id) ?? PRESETS[mode][0];

export function costOf(recipe: Pick<Recipe, "mode" | "modelId" | "count" | "durationSec">) {
  const model = modelById(recipe.modelId);
  return recipe.mode === "image" ? model.imageCost * recipe.count : model.videoCost * recipe.durationSec;
}

export const newSeed = () => Math.floor(Math.random() * 900000) + 100000;

/** Words that steer a result strongly (style / camera / light) vs. subject words. Drives the prompt heatmap. */
export const STYLE_WORDS = new Set([
  "cinematic", "volumetric", "light", "lighting", "neon", "cyberpunk", "film", "35mm", "grain", "macro", "dolly",
  "pan", "orbit", "handheld", "drone", "aerial", "golden", "hour", "dawn", "dusk", "sunrise", "sunset", "fog",
  "misty", "glow", "glowing", "soft", "moody", "vfx", "particles", "bokeh", "anamorphic", "slow", "motion",
]);

export const defaultRecipe = (mode: Mode = "video"): Recipe => ({
  mode,
  prompt: "",
  modelId: MODELS[0].id,
  aspectRatio: "16:9",
  count: mode === "image" ? 2 : 1,
  durationSec: 4,
  presetId: PRESETS[mode][0].id,
  seed: newSeed(),
  reference: null,
});
