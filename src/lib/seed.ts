import { costOf, modelById } from "./catalog";
import { imageSrc, videoSrc } from "./mock";
import type { Camera, Fps, Generation, ImageAspect, ImageRecipe, Look, Op, Reference, Resolution, Sampler, StyleRef, VideoAspect, VideoRecipe } from "./types";

/* ------------------------------------------------------------------ */
/* Schemas for the two media types                                     */
/* ------------------------------------------------------------------ */

interface SeedAuthor {
  name: string;
  avatar: string;
}

/** Static image generation, as shown in Image Studio. */
export interface ImageItem {
  id: string;
  title: string;
  prompt: string;
  negativePrompt: string;
  imageUrl: string;
  model: "Aurora-XL" | "Prism-2" | "Lumen-Turbo";
  aspectRatio: ImageAspect;
  resolution: Resolution;
  sampler: Sampler;
  steps: number;
  cfg: number;
  stylePreset: string;
  tags: string[];
  likesCount: number;
  author: SeedAuthor;
  createdAt: string;
  parentId: string | null;
  op: Op | null;
  assetKey: string;
  look?: Look;
}

/** Video generation, as shown in Video Studio (the brief's VideoItem, plus motion settings). */
export interface VideoItem {
  id: string;
  title: string;
  prompt: string;
  thumbnailUrl: string;
  videoUrl: string;
  model: "Higgsfield-V2" | "Motion-Pro" | "Cinematic-AI";
  aspectRatio: VideoAspect;
  duration: string;
  tags: string[];
  likesCount: number;
  author: SeedAuthor;
  createdAt: string;
  fps: Fps;
  motion: number;
  camera: Camera;
  motionModel: string;
  /** Image Studio item used as the start keyframe, if any. */
  startFrameId: string | null;
  parentId: string | null;
  assetKey: string;
}

/* ------------------------------------------------------------------ */
/* Authors                                                             */
/* ------------------------------------------------------------------ */

const GRADIENTS = [
  ["#00F5FF", "#10B981"],
  ["#38BDF8", "#6366F1"],
  ["#22C55E", "#06B6D4"],
  ["#A78BFA", "#00F5FF"],
  ["#F472B6", "#38BDF8"],
];

/** Initials avatar as an inline SVG, so the demo has no external image dependency. */
export function avatarFor(name: string) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const [a, b] = GRADIENTS[[...name].reduce((h, c) => h + c.charCodeAt(0), 0) % GRADIENTS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="64" height="64" rx="32" fill="url(#g)"/><text x="32" y="40" font-family="system-ui,sans-serif" font-size="24" font-weight="700" text-anchor="middle" fill="#0B132B">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const author = (name: string) => ({ name, avatar: avatarFor(name) });
const MIRA = author("Mira Kovac");
const DEV = author("Dev Anand");
const SOFIA = author("Sofia Reyes");
const KENJI = author("Kenji Watanabe");
const AMA = author("Ama Owusu");

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const NEG = "blurry, low detail, watermark, extra limbs";

/* ------------------------------------------------------------------ */
/* Image Studio seed                                                   */
/* ------------------------------------------------------------------ */

type ImageSeed = Omit<ImageItem, "imageUrl" | "createdAt" | "negativePrompt" | "sampler" | "steps" | "cfg" | "resolution" | "look" | "op"> &
  Partial<Pick<ImageItem, "negativePrompt" | "sampler" | "steps" | "cfg" | "resolution" | "look" | "op">> & { hours: number };

function img(s: ImageSeed): ImageItem {
  const { hours, ...rest } = s;
  return {
    negativePrompt: NEG,
    sampler: "dpmpp-2m-karras",
    steps: 30,
    cfg: 7,
    resolution: "1080p",
    op: null,
    ...rest,
    imageUrl: imageSrc(s.assetKey, s.aspectRatio),
    createdAt: hoursAgo(hours),
  };
}

export const IMAGE_ITEMS: ImageItem[] = [
  img({ id: "i-fjord", title: "Fjord Sunrise", assetKey: "1015", aspectRatio: "16:9", model: "Aurora-XL", stylePreset: "cinematic", parentId: null, hours: 60,
    prompt: "Aerial view of a Norwegian fjord at sunrise, volumetric light, cinematic", tags: ["Cinematic Lighting", "Landscape", "Aerial"], likesCount: 1284, author: MIRA }),
  img({ id: "i-fjord-4k", title: "Fjord Sunrise — 4K", assetKey: "1015", aspectRatio: "16:9", model: "Aurora-XL", stylePreset: "cinematic", parentId: "i-fjord", op: "upscale", resolution: "4K", hours: 58,
    prompt: "Aerial view of a Norwegian fjord at sunrise, volumetric light, cinematic", tags: ["Upscaled", "4K", "Landscape"], likesCount: 902, author: MIRA }),
  img({ id: "i-fjord-var", title: "Fjord Sunrise — Variation", assetKey: "1015", aspectRatio: "16:9", model: "Aurora-XL", stylePreset: "cinematic", parentId: "i-fjord", op: "variations", hours: 57,
    look: { hue: -24, zoom: 1.28, flip: true, ox: 35, oy: 60 },
    prompt: "Aerial view of a Norwegian fjord at sunrise, volumetric light, cinematic", tags: ["Variation", "Landscape", "Aerial"], likesCount: 311, author: MIRA }),
  img({ id: "i-valley", title: "Granite Valley", assetKey: "1043", aspectRatio: "4:3", model: "Aurora-XL", stylePreset: "none", parentId: null, hours: 44, sampler: "euler-a", steps: 36,
    prompt: "Misty granite valley with a quiet river, pine forest, morning light", tags: ["Landscape", "Nature"], likesCount: 764, author: KENJI }),
  img({ id: "i-pug", title: "Pug Burrito", assetKey: "1025", aspectRatio: "1:1", model: "Prism-2", stylePreset: "film", parentId: null, hours: 40,
    prompt: "Portrait of a pug wrapped in a wool blanket on a forest trail, 35mm film grain", tags: ["Film Grain", "Animals", "Portrait"], likesCount: 3120, author: SOFIA }),
  img({ id: "i-pug-inpaint", title: "Pug Burrito — Red Scarf", assetKey: "1025", aspectRatio: "1:1", model: "Prism-2", stylePreset: "film", parentId: "i-pug", op: "inpaint", hours: 38,
    look: { hue: 14, zoom: 1, flip: false },
    prompt: "Portrait of a pug wrapped in a wool blanket on a forest trail, 35mm film grain", tags: ["Inpainted", "Animals", "Portrait"], likesCount: 1450, author: SOFIA }),
  img({ id: "i-pug-bed", title: "Window Light Pug", assetKey: "1062", aspectRatio: "9:16", model: "Prism-2", stylePreset: "none", parentId: null, hours: 30,
    prompt: "A pug under a blanket on a bed, soft window light, cozy morning", tags: ["Animals", "Cozy", "Portrait"], likesCount: 1975, author: DEV }),
  img({ id: "i-jelly", title: "Neon Abyss", assetKey: "1069", aspectRatio: "9:16", model: "Aurora-XL", stylePreset: "cyberpunk", parentId: null, hours: 26, cfg: 9,
    prompt: "Macro shot of a jellyfish glowing in deep blue water, neon cyberpunk palette", tags: ["Cyberpunk", "Underwater", "Macro"], likesCount: 5230, author: AMA }),
  img({ id: "i-jelly-sq", title: "Neon Abyss — Square", assetKey: "1069", aspectRatio: "1:1", model: "Aurora-XL", stylePreset: "cyberpunk", parentId: "i-jelly", hours: 25, cfg: 9,
    prompt: "Macro shot of a jellyfish glowing in deep blue water, neon cyberpunk palette", tags: ["Cyberpunk", "Underwater"], likesCount: 1811, author: AMA }),
  img({ id: "i-bear", title: "Grizzly Close-up", assetKey: "433", aspectRatio: "4:3", model: "Aurora-XL", stylePreset: "cinematic", parentId: null, hours: 18, steps: 40,
    prompt: "Close portrait of a grizzly bear, wet fur, cinematic rim lighting", tags: ["Cinematic Lighting", "Wildlife", "Portrait"], likesCount: 2688, author: KENJI }),
  img({ id: "i-bear-studio", title: "Grizzly — Studio", assetKey: "433", aspectRatio: "1:1", model: "Lumen-Turbo", stylePreset: "studio", parentId: "i-bear", hours: 16, steps: 12, sampler: "unipc",
    prompt: "Close portrait of a grizzly bear, studio backdrop, soft key light", tags: ["Studio Light", "Wildlife", "Portrait"], likesCount: 540, author: DEV }),
  img({ id: "i-hiker", title: "Cliffside Hiker", assetKey: "1015", aspectRatio: "9:16", model: "Lumen-Turbo", stylePreset: "cinematic", parentId: null, hours: 5, steps: 14, sampler: "unipc",
    prompt: "A lone hiker on a cliff edge above a fjord at dawn, volumetric light", tags: ["Cinematic Lighting", "Landscape"], likesCount: 418, author: DEV }),
];

/* ------------------------------------------------------------------ */
/* Video Studio seed                                                   */
/* ------------------------------------------------------------------ */

type VideoSeed = Omit<VideoItem, "thumbnailUrl" | "videoUrl" | "createdAt" | "duration"> & { hours: number; seconds: number };

function vid(s: VideoSeed): VideoItem {
  const { hours, seconds, ...rest } = s;
  return {
    ...rest,
    thumbnailUrl: imageSrc(s.assetKey, s.aspectRatio),
    videoUrl: videoSrc(s.assetKey, s.aspectRatio),
    duration: `0:${String(seconds).padStart(2, "0")}`,
    createdAt: hoursAgo(hours),
  };
}

export const VIDEO_ITEMS: VideoItem[] = [
  vid({ id: "v-fjord-zoom", title: "Fjord Sunrise — Push", assetKey: "1015", aspectRatio: "16:9", model: "Motion-Pro", seconds: 5, fps: 24, motion: 45, camera: "zoom", motionModel: "vector-s", startFrameId: "i-fjord", parentId: null, hours: 56,
    prompt: "Slow push forward over the fjord at sunrise, drifting mist", tags: ["Zoom", "Keyframes", "Landscape"], likesCount: 2210, author: MIRA }),
  vid({ id: "v-fjord-orbit", title: "Fjord Sunrise — Orbit", assetKey: "1015", aspectRatio: "16:9", model: "Cinematic-AI", seconds: 10, fps: 30, motion: 60, camera: "orbit", motionModel: "vector-p", startFrameId: "i-fjord", parentId: "v-fjord-zoom", hours: 50,
    prompt: "Wide orbit around the fjord cliffs at sunrise, drifting mist", tags: ["Orbit", "Keyframes", "Landscape"], likesCount: 1604, author: MIRA }),
  vid({ id: "v-valley", title: "Yosemite Morning Tilt", assetKey: "1043", aspectRatio: "16:9", model: "Cinematic-AI", seconds: 10, fps: 24, motion: 30, camera: "tilt", motionModel: "vector-s", startFrameId: null, parentId: null, hours: 34,
    prompt: "Slow tilt up from a quiet river to granite cliffs at golden hour", tags: ["Tilt", "Landscape", "Nature"], likesCount: 1532, author: KENJI }),
  vid({ id: "v-pug-loop", title: "Sleepy Pug Loop", assetKey: "1062", aspectRatio: "9:16", model: "Motion-Pro", seconds: 3, fps: 30, motion: 20, camera: "static", motionModel: "vector-p", startFrameId: "i-pug-bed", parentId: null, hours: 28,
    prompt: "A pug breathing softly under a blanket, gentle handheld motion", tags: ["Keyframes", "Animals", "Cozy"], likesCount: 4406, author: DEV }),
  vid({ id: "v-pug-pan", title: "Forest Trail Pug", assetKey: "1025", aspectRatio: "16:9", model: "Higgsfield-V2", seconds: 5, fps: 24, motion: 55, camera: "pan", motionModel: "vector-s", startFrameId: "i-pug", parentId: null, hours: 22,
    prompt: "A pug wrapped in a wool blanket on a forest trail, slow camera pan, 35mm film", tags: ["Camera Pan", "Film Grain", "Animals"], likesCount: 740, author: SOFIA }),
  vid({ id: "v-jelly", title: "Neon Abyss Drift", assetKey: "1069", aspectRatio: "9:16", model: "Cinematic-AI", seconds: 5, fps: 60, motion: 75, camera: "zoom", motionModel: "vector-x", startFrameId: "i-jelly", parentId: null, hours: 24,
    prompt: "A jellyfish pulsing through deep blue water, neon glow, particles", tags: ["Zoom", "High Motion", "Cyberpunk"], likesCount: 5230, author: AMA }),
  vid({ id: "v-jelly-wide", title: "Deep Blue Pan", assetKey: "1069", aspectRatio: "16:9", model: "Motion-Pro", seconds: 5, fps: 30, motion: 50, camera: "pan", motionModel: "vector-s", startFrameId: null, parentId: "v-jelly", hours: 12,
    prompt: "A jellyfish drifting through deep blue water, slow lateral pan", tags: ["Camera Pan", "Underwater", "Macro"], likesCount: 962, author: AMA }),
  vid({ id: "v-bear", title: "Grizzly Push-in", assetKey: "433", aspectRatio: "16:9", model: "Motion-Pro", seconds: 5, fps: 24, motion: 40, camera: "zoom", motionModel: "vector-p", startFrameId: "i-bear", parentId: null, hours: 15,
    prompt: "Close portrait of a grizzly bear, slow dolly in to the eyes, rim light", tags: ["Zoom", "Keyframes", "Wildlife"], likesCount: 3390, author: KENJI }),
  vid({ id: "v-bear-square", title: "Grizzly — Square Cut", assetKey: "433", aspectRatio: "1:1", model: "Higgsfield-V2", seconds: 3, fps: 60, motion: 80, camera: "orbit", motionModel: "vector-x", startFrameId: "i-bear", parentId: "v-bear", hours: 8,
    prompt: "Grizzly bear portrait, fast orbit, dramatic rim light", tags: ["Orbit", "High Motion", "60fps"], likesCount: 688, author: KENJI }),
];

/* ------------------------------------------------------------------ */
/* Conversion into studio takes                                        */
/* ------------------------------------------------------------------ */

const seedOf = (id: string) => 100000 + ([...id].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) % 800000);
const byName = (name: string) => modelById(name.toLowerCase());
const refTo = (i: ImageItem): Reference => ({ src: i.imageUrl, name: i.title, sourceKey: i.assetKey });

function number<T extends { createdAt: number }>(takes: T[]) {
  return [...takes].sort((a, b) => a.createdAt - b.createdAt).map((t, i) => ({ ...t, n: i + 1 }));
}

export function seedGenerations(projectId: string): Generation[] {
  const images = IMAGE_ITEMS.map((s): Generation => {
    const parent = IMAGE_ITEMS.find((p) => p.id === s.parentId);
    const styleRefs: StyleRef[] = parent && s.op ? [{ ...refTo(parent), role: "style", weight: 0.8 }] : [];
    const recipe: ImageRecipe = {
      mode: "image",
      prompt: s.prompt,
      modelId: byName(s.model).id,
      aspectRatio: s.aspectRatio,
      seed: seedOf(s.id),
      negativePrompt: s.negativePrompt,
      sampler: s.sampler,
      steps: s.steps,
      cfg: s.cfg,
      resolution: s.resolution,
      count: 1,
      stylePreset: s.stylePreset,
      styleRefs,
      ...(s.op === "inpaint" ? { inpaint: { x: 0.3, y: 0.45, w: 0.4, h: 0.3, prompt: "a red knitted scarf" } } : {}),
    };
    const t = Date.parse(s.createdAt);
    return {
      id: s.id, n: 0, projectId, title: s.title, tags: s.tags, likes: s.likesCount, author: s.author, favorite: false,
      recipe, op: s.op, parentId: s.parentId, createdAt: t, startAt: t - 3000 - (recipe.seed % 5000), endAt: t,
      outputs: [{ id: `${s.id}-o`, kind: "image", key: s.assetKey, src: s.imageUrl, poster: s.imageUrl, readyAt: t, look: s.look }],
      cost: costOf(recipe, s.op),
    };
  });

  const videos = VIDEO_ITEMS.map((s): Generation => {
    const start = IMAGE_ITEMS.find((i) => i.id === s.startFrameId);
    const recipe: VideoRecipe = {
      mode: "video",
      prompt: s.prompt,
      modelId: byName(s.model).id,
      aspectRatio: s.aspectRatio,
      seed: seedOf(s.id),
      durationSec: Number(s.duration.split(":")[1]),
      motion: s.motion,
      camera: s.camera,
      fps: s.fps,
      motionModel: s.motionModel,
      startFrame: start ? refTo(start) : null,
      endFrame: null,
    };
    const t = Date.parse(s.createdAt);
    return {
      id: s.id, n: 0, projectId, title: s.title, tags: s.tags, likes: s.likesCount, author: s.author, favorite: false,
      recipe, op: start && !s.parentId ? "animate" : null, parentId: s.parentId, createdAt: t, startAt: t - 7000 - (recipe.seed % 6000), endAt: t,
      outputs: [{ id: `${s.id}-o`, kind: "video", key: s.assetKey, src: s.videoUrl, poster: s.thumbnailUrl, readyAt: t }],
      cost: costOf(recipe),
    };
  });

  return [...number(images), ...number(videos)].sort((a, b) => b.createdAt - a.createdAt);
}
