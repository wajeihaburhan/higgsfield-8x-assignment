import { modelById, presetOf } from "./catalog";
import type { AspectRatio, Generation, Output, Recipe, TakeStatus } from "./types";

// Small curated local set (see public/mock): every key exists as an image and a clip in each ratio.
// Keys are Picsum/Unsplash photo ids; tags let prompts pull relevant results.
const ASSETS: Record<string, string[]> = {
  "1015": ["fjord", "mountain", "ridge", "cliff", "hiker", "hike", "landscape", "lake", "water", "dawn", "sky", "aerial", "norway"],
  "1025": ["pug", "dog", "puppy", "pet", "blanket", "wool", "forest", "cozy", "cute"],
  "1069": ["jellyfish", "ocean", "sea", "underwater", "water", "blue", "glow", "glowing", "macro", "creature"],
  "1043": ["mountain", "forest", "river", "valley", "trees", "landscape", "nature", "yosemite", "misty", "hike"],
  "1062": ["pug", "dog", "pet", "blanket", "bed", "window", "cozy", "portrait", "soft", "cute"],
  "433": ["bear", "animal", "wildlife", "portrait", "fur", "wild", "grizzly", "close"],
};
const KEYS = Object.keys(ASSETS);
const SUBJECT_TAGS: Record<string, string[]> = {
  "1015": ["Landscape", "Aerial"],
  "1025": ["Animals", "Portrait"],
  "1069": ["Underwater", "Macro"],
  "1043": ["Landscape", "Nature"],
  "1062": ["Animals", "Cozy"],
  "433": ["Wildlife", "Portrait"],
};
export const SUBJECT_WORDS = new Set(Object.values(ASSETS).flat());

const PROMPT_TAGS: [RegExp, string][] = [
  [/\b(cinematic|volumetric|anamorphic)\b/, "Cinematic Lighting"],
  [/\b(neon|cyberpunk)\b/, "Cyberpunk"],
  [/\b(vfx|particles|explosion|sparks)\b/, "VFX"],
  [/\b(pan|panning|tracking)\b/, "Camera Pan"],
  [/\b(film|35mm|grain)\b/, "Film Grain"],
];

/** Feed tags for a take: preset, prompt style words, subject of the first result, and motion. */
export function tagsFor(recipe: Recipe, firstKey: string): string[] {
  const prompt = recipe.prompt.toLowerCase();
  const tags = [
    presetOf(recipe.mode, recipe.presetId).tag,
    ...PROMPT_TAGS.filter(([re]) => re.test(prompt)).map(([, t]) => t),
    ...(SUBJECT_TAGS[firstKey] ?? []),
    recipe.mode === "video" ? "Motion" : null,
  ].filter((t): t is string => !!t);
  return [...new Set(tags)].slice(0, 4);
}

export function titleFrom(prompt: string) {
  const words = prompt.replace(/[^\w\s'-]/g, " ").split(/\s+/).filter(Boolean);
  const stop = new Set(["a", "an", "the", "of", "in", "on", "at", "with", "and", "shot"]);
  const picked = words.filter((w) => !stop.has(w.toLowerCase())).slice(0, 3);
  return picked.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ") || "Untitled";
}

const slug = (ar: AspectRatio) => ar.replace(":", "x");
export const imageSrc = (key: string, ar: AspectRatio) => `/mock/img/${key}-${slug(ar)}.jpg`;
export const videoSrc = (key: string, ar: AspectRatio) => `/mock/vid/${key}-${slug(ar)}.mp4`;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic per recipe, so "Use recipe" reproduces the same take:
 * a remix/animate keeps its reference's subject, then prompt keywords rank the rest, the seed breaks ties.
 */
function pickKeys(recipe: Recipe): string[] {
  const words = new Set(recipe.prompt.toLowerCase().match(/[a-z]+/g) ?? []);
  const score = (k: string) =>
    (k === recipe.reference?.sourceKey ? 100 : 0) + ASSETS[k].filter((t) => words.has(t)).length;
  const rng = mulberry32(recipe.seed);
  const pool = KEYS.map((k) => ({ k, s: score(k), r: rng() }))
    .sort((a, b) => b.s - a.s || a.r - b.r)
    .map((x) => x.k);
  const count = recipe.mode === "image" ? recipe.count : 1;
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]);
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** Simulates a provider job: queue delay, model-dependent run time, staggered outputs. */
export function simulate(recipe: Recipe, now: number) {
  const [min, max] = modelById(recipe.modelId).speedMs;
  const lengthFactor = recipe.mode === "video" ? recipe.durationSec / 4 : 1;
  const startAt = now + 700 + Math.random() * 1300;
  const endAt = startAt + (min + Math.random() * (max - min)) * (0.7 + 0.3 * lengthFactor);
  const keys = pickKeys(recipe);
  const outputs: Output[] = keys.map((key, i) => ({
    id: uid(),
    kind: recipe.mode,
    key,
    src: recipe.mode === "image" ? imageSrc(key, recipe.aspectRatio) : videoSrc(key, recipe.aspectRatio),
    poster: imageSrc(key, recipe.aspectRatio),
    readyAt: endAt - (keys.length - 1 - i) * 600,
  }));
  return { id: uid(), startAt, endAt, outputs };
}

export function statusOf(g: Pick<Generation, "startAt" | "endAt">, now: number): TakeStatus {
  if (now < g.startAt) return "queued";
  if (now < g.endAt) return "running";
  return "done";
}

/** Eased 0..1 progress towards a given ready time. */
export function progressOf(startAt: number, readyAt: number, now: number) {
  if (now <= startAt) return 0;
  const p = Math.min(1, (now - startAt) / (readyAt - startAt));
  return 1 - Math.pow(1 - p, 2);
}
