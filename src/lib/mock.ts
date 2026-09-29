import { cameraOf, modelById, stylePreset } from "./catalog";
import type { CSSProperties } from "react";
import type { AspectRatio, Generation, Look, Op, Output, Recipe, TakeStatus } from "./types";

// Curated local set of 18 subjects (see public/mock): every key exists as an image in every ratio
// (1:1, 16:9, 9:16, 4:3) and as a 4s clip in 1:1, 16:9 and 9:16.
// Keys are Picsum/Unsplash photo ids; tags let prompts pull relevant results.
const ASSETS: Record<string, string[]> = {
  "1015": ["fjord", "mountain", "ridge", "cliff", "hiker", "hike", "landscape", "lake", "water", "dawn", "sky", "aerial", "norway"],
  "1025": ["pug", "dog", "puppy", "pet", "blanket", "wool", "forest", "cozy", "cute"],
  "1069": ["jellyfish", "ocean", "sea", "underwater", "water", "blue", "glow", "glowing", "macro", "creature", "neon"],
  "1043": ["mountain", "forest", "river", "valley", "trees", "landscape", "nature", "yosemite", "misty", "hike", "granite"],
  "1062": ["pug", "dog", "pet", "blanket", "bed", "window", "cozy", "portrait", "soft", "cute"],
  "433": ["bear", "animal", "wildlife", "portrait", "fur", "wild", "grizzly", "close"],
  "15": ["waterfall", "falls", "river", "stream", "rocks", "gorge", "canyon", "nature", "mist", "cascade"],
  "57": ["city", "street", "urban", "buildings", "downtown", "brick", "road", "alley", "architecture", "morning"],
  "274": ["city", "night", "neon", "times", "square", "lights", "billboards", "cyberpunk", "nightlife", "signs"],
  "111": ["car", "vintage", "classic", "retro", "automobile", "hotrod", "chrome", "oldtimer", "vehicle"],
  "219": ["leopard", "cheetah", "cat", "safari", "wildlife", "savanna", "jungle", "predator", "africa", "spotted"],
  "237": ["puppy", "dog", "labrador", "black", "pet", "cute", "wooden", "floor", "eyes"],
  "431": ["coffee", "latte", "cafe", "espresso", "cup", "barista", "foam", "art", "breakfast", "food"],
  "401": ["balloon", "hot", "air", "sky", "flight", "adventure", "travel", "colorful", "float", "rise"],
  "452": ["concert", "crowd", "music", "stage", "festival", "lights", "party", "fans", "rave", "live"],
  "65": ["woman", "girl", "golden", "hour", "sunset", "field", "hair", "backlit", "wheat", "summer"],
  "152": ["flower", "flowers", "petunia", "petals", "purple", "violet", "bloom", "garden", "botanical", "spring"],
  "29": ["snow", "snowy", "peaks", "alpine", "alps", "himalaya", "glacier", "mountains", "winter", "summit"],
};
const KEYS = Object.keys(ASSETS);
const SUBJECT_TAGS: Record<string, string[]> = {
  "1015": ["Landscape", "Aerial"],
  "1025": ["Animals", "Portrait"],
  "1069": ["Underwater", "Macro"],
  "1043": ["Landscape", "Nature"],
  "1062": ["Animals", "Cozy"],
  "433": ["Wildlife", "Portrait"],
  "15": ["Nature", "Waterfall"],
  "57": ["Urban", "Architecture"],
  "274": ["Urban", "Night"],
  "111": ["Vehicles", "Retro"],
  "219": ["Wildlife", "Safari"],
  "237": ["Animals", "Pets"],
  "431": ["Food", "Coffee"],
  "401": ["Travel", "Sky"],
  "452": ["Music", "Crowd"],
  "65": ["Portrait", "Golden Hour"],
  "152": ["Macro", "Flowers"],
  "29": ["Landscape", "Snow"],
};
export const SUBJECT_WORDS = new Set(Object.values(ASSETS).flat());

const slug = (ar: AspectRatio) => ar.replace(":", "x");
export const imageSrc = (key: string, ar: AspectRatio) => `/mock/img/${key}-${slug(ar)}.jpg`;
export const videoSrc = (key: string, ar: AspectRatio) => `/mock/vid/${key}-${slug(ar)}.mp4`;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The reference whose subject should carry into the result (first style ref, or the start frame). */
export const primaryRef = (r: Recipe) => (r.mode === "image" ? r.styleRefs[0] ?? null : r.startFrame);

/**
 * Deterministic per recipe, so "Exact recipe" reproduces the same take:
 * the primary reference keeps its subject, prompt keywords rank the rest, the seed breaks ties.
 */
function pickKeys(recipe: Recipe, op: Op | null): string[] {
  const count = recipe.mode === "image" ? recipe.count : 1;
  const pref = primaryRef(recipe)?.sourceKey;
  if (pref && (op === "upscale" || op === "inpaint" || op === "variations")) return Array(count).fill(pref);
  const words = new Set(recipe.prompt.toLowerCase().match(/[a-z]+/g) ?? []);
  const score = (k: string) => (k === pref ? 100 : 0) + ASSETS[k].filter((t) => words.has(t)).length;
  const rng = mulberry32(recipe.seed);
  const pool = KEYS.map((k) => ({ k, s: score(k), r: rng() }))
    .sort((a, b) => b.s - a.s || a.r - b.r)
    .map((x) => x.k);
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]);
}

/** Repeated sources get a distinct crop / tint / mirror so a batch of variations doesn't look duplicated. */
function looksFor(keys: string[], seed: number, op: Op | null): (Look | undefined)[] {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const seen = new Set<string>();
  return keys.map((k) => {
    const repeat = seen.has(k);
    seen.add(k);
    if (op === "inpaint") return { hue: 14, zoom: 1, flip: false };
    if (!repeat && op !== "variations") return undefined;
    return { hue: Math.round(rng() * 70 - 35), zoom: 1.15 + rng() * 0.25, flip: rng() > 0.5, ox: Math.round(20 + rng() * 60), oy: Math.round(20 + rng() * 60) };
  });
}

export const lookStyle = (look?: Look): CSSProperties | undefined =>
  look && {
    filter: look.hue ? `hue-rotate(${look.hue}deg) saturate(1.08)` : undefined,
    // Mirroring about an off-centre point would slide the image out of frame, so flips zoom from the centre line.
    transform: `scale(${look.flip ? -look.zoom : look.zoom}, ${look.zoom})`,
    transformOrigin: `${look.flip ? 50 : (look.ox ?? 50)}% ${look.oy ?? 50}%`,
  };

const uid = () => Math.random().toString(36).slice(2, 10);

/** Simulates a provider job: queue delay, model- and settings-dependent run time, staggered outputs. */
export function simulate(recipe: Recipe, now: number, op: Op | null = null) {
  const [min, max] = modelById(recipe.modelId).speedMs;
  const factor =
    recipe.mode === "image"
      ? (op === "upscale" ? 0.7 : 1) * (recipe.resolution === "4K" ? 1.5 : 1) * (0.7 + recipe.steps / 100)
      : (0.6 + recipe.durationSec / 12) * (recipe.fps === 60 ? 1.3 : 1);
  const startAt = now + 600 + Math.random() * 1200;
  const endAt = startAt + (min + Math.random() * (max - min)) * factor;
  const keys = pickKeys(recipe, op);
  const looks = looksFor(keys, recipe.seed, op);
  const outputs: Output[] = keys.map((key, i) => ({
    id: uid(),
    kind: recipe.mode,
    key,
    src: recipe.mode === "image" ? imageSrc(key, recipe.aspectRatio) : videoSrc(key, recipe.aspectRatio),
    poster: imageSrc(key, recipe.aspectRatio),
    readyAt: endAt - (keys.length - 1 - i) * 550,
    look: looks[i],
  }));
  return { id: uid(), startAt, endAt, outputs };
}

const PROMPT_TAGS: [RegExp, string][] = [
  [/\b(cinematic|volumetric|anamorphic|rim)\b/, "Cinematic Lighting"],
  [/\b(neon|cyberpunk)\b/, "Cyberpunk"],
  [/\b(vfx|particles|explosion|sparks)\b/, "VFX"],
  [/\b(film|35mm|grain)\b/, "Film Grain"],
];
const OP_TAGS: Partial<Record<Op, string>> = { upscale: "Upscaled", variations: "Variation", inpaint: "Inpainted" };

/** Feed tags for a take: action, preset/camera, prompt style words, subject and format. */
export function tagsFor(recipe: Recipe, firstKey: string, op: Op | null): string[] {
  const prompt = recipe.prompt.toLowerCase();
  const promptTags = PROMPT_TAGS.filter(([re]) => re.test(prompt)).map(([, t]) => t);
  const subject = SUBJECT_TAGS[firstKey] ?? [];
  const tags =
    recipe.mode === "image"
      ? [
          op ? OP_TAGS[op] : null,
          stylePreset(recipe.stylePreset).tag,
          ...promptTags,
          ...subject,
          recipe.resolution === "4K" ? "4K" : null,
          recipe.styleRefs.length ? "Image-to-Image" : null,
        ]
      : [
          cameraOf(recipe.camera).tag,
          recipe.motion >= 70 ? "High Motion" : null,
          ...promptTags,
          ...subject,
          recipe.fps === 60 ? "60fps" : null,
          recipe.startFrame ? "Keyframes" : null,
        ];
  return [...new Set(tags.filter((t): t is string => !!t))].slice(0, 4);
}

export function titleFrom(prompt: string) {
  const words = prompt.replace(/[^\w\s'-]/g, " ").split(/\s+/).filter(Boolean);
  const stop = new Set(["a", "an", "the", "of", "in", "on", "at", "with", "and", "shot", "view", "through", "around"]);
  const picked = words.filter((w) => !stop.has(w.toLowerCase())).slice(0, 3);
  return picked.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ") || "Untitled";
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
