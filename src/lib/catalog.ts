import type { Camera, Fps, ImageAspect, ImageRecipe, Mode, Op, Recipe, RefRole, Resolution, Sampler, VideoAspect, VideoRecipe } from "./types";

export interface Model {
  id: string;
  mode: Mode;
  name: string;
  tagline: string;
  /** Credits per image, or per second of video. */
  cost: number;
  speedMs: [number, number];
  speedLabel: string;
}

export const MODELS: Model[] = [
  { id: "aurora-xl", mode: "image", name: "Aurora-XL", tagline: "Photoreal detail", cost: 3, speedMs: [5000, 7000], speedLabel: "Quality" },
  { id: "prism-2", mode: "image", name: "Prism-2", tagline: "Stylized & illustrative", cost: 2, speedMs: [3500, 5000], speedLabel: "Balanced" },
  { id: "lumen-turbo", mode: "image", name: "Lumen-Turbo", tagline: "Instant drafts", cost: 1, speedMs: [1800, 2600], speedLabel: "Fast" },
  { id: "higgsfield-v2", mode: "video", name: "Higgsfield-V2", tagline: "Balanced all-rounder", cost: 3, speedMs: [6000, 8000], speedLabel: "Fast" },
  { id: "motion-pro", mode: "video", name: "Motion-Pro", tagline: "Physics-true motion", cost: 4, speedMs: [8000, 10000], speedLabel: "Medium" },
  { id: "cinematic-ai", mode: "video", name: "Cinematic-AI", tagline: "Film-grade light & color", cost: 5, speedMs: [10000, 13000], speedLabel: "Slow" },
];

export const IMAGE_ASPECTS: ImageAspect[] = ["1:1", "16:9", "9:16", "4:3"];
export const VIDEO_ASPECTS: VideoAspect[] = ["16:9", "9:16", "1:1"];

export const STYLE_PRESETS = [
  { id: "none", name: "No style", tag: null },
  { id: "cinematic", name: "Cinematic lighting", tag: "Cinematic Lighting" },
  { id: "cyberpunk", name: "Cyberpunk", tag: "Cyberpunk" },
  { id: "film", name: "35mm film grain", tag: "Film Grain" },
  { id: "studio", name: "Studio product", tag: "Studio Light" },
] as const;

export const SAMPLERS: { id: Sampler; name: string }[] = [
  { id: "dpmpp-2m-karras", name: "DPM++ 2M Karras" },
  { id: "euler-a", name: "Euler a" },
  { id: "ddim", name: "DDIM" },
  { id: "unipc", name: "UniPC" },
];

export const RESOLUTIONS: Resolution[] = ["1080p", "4K"];

export const REF_ROLES: { id: RefRole; name: string; hint: string }[] = [
  { id: "style", name: "Style", hint: "Borrow palette, texture and mood" },
  { id: "canny", name: "Edges", hint: "Keep outlines (Canny)" },
  { id: "depth", name: "Depth", hint: "Keep spatial layout" },
  { id: "pose", name: "Pose", hint: "Keep subject pose" },
];
export const MAX_STYLE_REFS = 3;

export const CAMERAS: { id: Camera; name: string; tag: string | null }[] = [
  { id: "static", name: "Static", tag: null },
  { id: "zoom", name: "Zoom", tag: "Zoom" },
  { id: "pan", name: "Pan", tag: "Camera Pan" },
  { id: "tilt", name: "Tilt", tag: "Tilt" },
  { id: "orbit", name: "Orbit", tag: "Orbit" },
];

export const DURATIONS = [3, 5, 10];
export const FPS_OPTIONS: Fps[] = [24, 30, 60];

export const MOTION_MODELS = [
  { id: "vector-s", name: "Vector-S", tagline: "Smooth, stable flow" },
  { id: "vector-p", name: "Vector-P", tagline: "Precise subject tracking" },
  { id: "vector-x", name: "Vector-X", tagline: "Expressive, stylized motion" },
];

export const MAX_COUNT = 4;
export const STARTING_CREDITS = 300;

export const EXAMPLE_PROMPTS: Record<Mode, string[]> = {
  image: [
    "Aerial view of a Norwegian fjord at sunrise, volumetric light",
    "Portrait of a pug wrapped in a wool blanket, soft window light",
    "Close portrait of a grizzly bear, cinematic rim lighting",
  ],
  video: [
    "A jellyfish drifting through deep blue water, neon glow",
    "Slow orbit around a granite valley at golden hour",
    "A pug breathing softly under a blanket, gentle handheld motion",
  ],
};

export const modelById = (id: string) => MODELS.find((m) => m.id === id) ?? MODELS[0];
export const modelsFor = (mode: Mode) => MODELS.filter((m) => m.mode === mode);
export const stylePreset = (id: string) => STYLE_PRESETS.find((p) => p.id === id) ?? STYLE_PRESETS[0];
export const cameraOf = (id: string) => CAMERAS.find((c) => c.id === id) ?? CAMERAS[0];
export const samplerName = (id: string) => SAMPLERS.find((s) => s.id === id)?.name ?? id;
export const motionModelName = (id: string) => MOTION_MODELS.find((m) => m.id === id)?.name ?? id;

const FPS_COST: Record<Fps, number> = { 24: 1, 30: 1.2, 60: 1.5 };

export function costOf(recipe: Recipe, op: Op | null = null) {
  const model = modelById(recipe.modelId);
  if (recipe.mode === "image") {
    if (op === "upscale") return 3;
    if (op === "inpaint") return 2;
    return model.cost * recipe.count * (recipe.resolution === "4K" ? 2 : 1) + recipe.styleRefs.length;
  }
  return Math.round(model.cost * recipe.durationSec * FPS_COST[recipe.fps]) + (recipe.endFrame ? 2 : 0);
}

export const newSeed = () => Math.floor(Math.random() * 900000) + 100000;

export const defaultImageRecipe = (): ImageRecipe => ({
  mode: "image",
  prompt: "",
  modelId: "aurora-xl",
  aspectRatio: "1:1",
  seed: newSeed(),
  negativePrompt: "blurry, low detail, watermark, extra limbs",
  sampler: "dpmpp-2m-karras",
  steps: 30,
  cfg: 7,
  resolution: "1080p",
  count: 2,
  stylePreset: "none",
  styleRefs: [],
});

export const defaultVideoRecipe = (): VideoRecipe => ({
  mode: "video",
  prompt: "",
  modelId: "higgsfield-v2",
  aspectRatio: "16:9",
  seed: newSeed(),
  durationSec: 5,
  motion: 50,
  camera: "static",
  fps: 24,
  motionModel: "vector-s",
  startFrame: null,
  endFrame: null,
});

/** Words that steer a result strongly (style / camera / light). Drives the prompt heatmap. */
export const STYLE_WORDS = new Set([
  "cinematic", "volumetric", "light", "lighting", "neon", "cyberpunk", "film", "35mm", "grain", "macro", "dolly",
  "pan", "orbit", "tilt", "zoom", "handheld", "drone", "aerial", "golden", "hour", "dawn", "dusk", "sunrise",
  "sunset", "fog", "misty", "glow", "glowing", "soft", "moody", "vfx", "particles", "bokeh", "anamorphic", "slow",
  "motion", "rim", "studio", "portrait",
]);
