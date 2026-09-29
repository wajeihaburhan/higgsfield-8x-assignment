import type { AspectRatio, Mode, Recipe } from "./types";

export interface Model {
  id: string;
  name: string;
  mode: Mode;
  tagline: string;
  /** Credits per image, or per second of video. */
  costPerUnit: number;
  speedMs: [number, number];
}

export const MODELS: Model[] = [
  { id: "aurora-2", name: "Aurora 2", mode: "image", tagline: "Fast · photoreal", costPerUnit: 2, speedMs: [3500, 5000] },
  { id: "prism-xl", name: "Prism XL", mode: "image", tagline: "Slower · max detail", costPerUnit: 4, speedMs: [6000, 8000] },
  { id: "drift-1", name: "Drift", mode: "video", tagline: "Smooth motion", costPerUnit: 3, speedMs: [7000, 9000] },
  { id: "kinetic-pro", name: "Kinetic Pro", mode: "video", tagline: "Cinematic camera", costPerUnit: 5, speedMs: [10000, 13000] },
];

export const PRESETS: Record<Mode, { id: string; name: string }[]> = {
  image: [
    { id: "none", name: "No style" },
    { id: "cinematic", name: "Cinematic" },
    { id: "film", name: "35mm film" },
    { id: "studio", name: "Studio light" },
    { id: "neon", name: "Neon noir" },
  ],
  video: [
    { id: "static", name: "Static camera" },
    { id: "push-in", name: "Push in" },
    { id: "pull-out", name: "Pull out" },
    { id: "orbit", name: "Orbit" },
  ],
};

export const ASPECT_RATIOS: AspectRatio[] = ["1:1", "16:9", "9:16"];
export const DURATIONS = [4, 8];
export const MAX_COUNT = 4;
export const STARTING_CREDITS = 200;

export const EXAMPLE_PROMPTS = [
  "A lone hiker on a misty ridge at dawn, volumetric light",
  "Macro shot of a jellyfish glowing in deep blue water",
  "Portrait of a pug wrapped in a wool blanket, soft window light",
];

export const modelById = (id: string) => MODELS.find((m) => m.id === id) ?? MODELS[0];
export const defaultModel = (mode: Mode) => MODELS.find((m) => m.mode === mode)!;
export const presetName = (mode: Mode, id: string) => PRESETS[mode].find((p) => p.id === id)?.name ?? "";

export function costOf(recipe: Pick<Recipe, "mode" | "modelId" | "count" | "durationSec">) {
  const model = modelById(recipe.modelId);
  return model.costPerUnit * (recipe.mode === "image" ? recipe.count : recipe.durationSec);
}

export const newSeed = () => Math.floor(Math.random() * 900000) + 100000;
