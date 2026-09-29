import { modelByName } from "./catalog";
import { imageSrc, videoSrc } from "./mock";
import type { AspectRatio, Generation, Mode } from "./types";

/** Feed item schema from the brief. */
export interface VideoItem {
  id: string;
  title: string;
  prompt: string;
  thumbnailUrl: string;
  videoUrl: string;
  model: "Higgsfield-V2" | "Motion-Pro" | "Cinematic-AI";
  aspectRatio: "16:9" | "9:16" | "1:1";
  duration: string;
  tags: string[];
  likesCount: number;
  author: {
    name: string;
    avatar: string;
  };
  createdAt: string;
}

/** Seed items also carry what the studio needs to reproduce and branch them. */
interface SeedItem extends VideoItem {
  kind: Mode;
  assetKey: string;
  presetId: string;
  seed: number;
  parentId: string | null;
}

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

function item(
  id: string,
  kind: Mode,
  assetKey: string,
  aspectRatio: AspectRatio,
  fields: Omit<SeedItem, "id" | "kind" | "assetKey" | "aspectRatio" | "thumbnailUrl" | "videoUrl" | "duration" | "seed" | "createdAt"> & {
    hours: number;
    seconds?: number;
  }
): SeedItem {
  const { hours, seconds = 4, ...rest } = fields;
  return {
    id,
    kind,
    assetKey,
    aspectRatio,
    thumbnailUrl: imageSrc(assetKey, aspectRatio),
    videoUrl: kind === "video" ? videoSrc(assetKey, aspectRatio) : "",
    duration: kind === "video" ? `0:0${seconds}` : "Still",
    seed: 100000 + [...id].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) % 800000,
    createdAt: hoursAgo(hours),
    ...rest,
  };
}

// Branching chains, so the graph view has real prompt evolution to show.
export const SEED_ITEMS: SeedItem[] = [
  item("s-fjord", "image", "1015", "16:9", {
    title: "Fjord Sunrise",
    prompt: "Aerial drone shot over a Norwegian fjord at sunrise, volumetric light, cinematic",
    model: "Cinematic-AI", presetId: "cinematic", parentId: null, hours: 52,
    tags: ["Cinematic Lighting", "Landscape", "Aerial"], likesCount: 1284, author: MIRA,
  }),
  item("s-fjord-dolly", "video", "1015", "16:9", {
    title: "Fjord Sunrise — Dolly",
    prompt: "Aerial drone shot over a Norwegian fjord at sunrise, slow dolly forward over the cliff edge",
    model: "Motion-Pro", presetId: "push-in", parentId: "s-fjord", hours: 50,
    tags: ["Dolly In", "Landscape", "Motion"], likesCount: 2210, author: MIRA,
  }),
  item("s-valley", "image", "1043", "16:9", {
    title: "Valley Cathedral",
    prompt: "Aerial drone shot over a granite valley at sunrise, volumetric light, cinematic",
    model: "Cinematic-AI", presetId: "cinematic", parentId: "s-fjord", hours: 49,
    tags: ["Cinematic Lighting", "Landscape", "Nature"], likesCount: 864, author: MIRA,
  }),
  item("s-valley-orbit", "video", "1043", "16:9", {
    title: "Yosemite Morning Orbit",
    prompt: "Slow orbit around a granite valley at golden hour, river reflections, cinematic",
    model: "Cinematic-AI", presetId: "orbit", parentId: "s-valley", hours: 30,
    tags: ["Orbit", "Landscape", "Motion"], likesCount: 1532, author: KENJI,
  }),
  item("s-pug", "image", "1025", "1:1", {
    title: "Pug Burrito",
    prompt: "Portrait of a pug wrapped in a wool blanket on a forest trail, 35mm film grain",
    model: "Higgsfield-V2", presetId: "film", parentId: null, hours: 44,
    tags: ["Film Grain", "Animals", "Portrait"], likesCount: 3120, author: SOFIA,
  }),
  item("s-pug-window", "image", "1062", "9:16", {
    title: "Pug Burrito — Window Light",
    prompt: "Portrait of a pug wrapped in a blanket on a bed, soft window light, cozy",
    model: "Higgsfield-V2", presetId: "none", parentId: "s-pug", hours: 40,
    tags: ["Animals", "Cozy", "Portrait"], likesCount: 1975, author: SOFIA,
  }),
  item("s-pug-loop", "video", "1062", "9:16", {
    title: "Sleepy Pug Loop",
    prompt: "Portrait of a pug wrapped in a blanket on a bed, gentle handheld breathing motion",
    model: "Motion-Pro", presetId: "handheld", parentId: "s-pug-window", hours: 38,
    tags: ["Handheld", "Animals", "Motion"], likesCount: 4406, author: SOFIA,
  }),
  item("s-pug-forest", "video", "1025", "16:9", {
    title: "Forest Trail Pug",
    prompt: "A pug wrapped in a wool blanket on a forest trail, slow camera pan, 35mm film",
    model: "Motion-Pro", presetId: "pan", parentId: "s-pug", hours: 20,
    tags: ["Camera Pan", "Film Grain", "Animals"], likesCount: 740, author: DEV,
  }),
  item("s-jelly", "video", "1069", "9:16", {
    title: "Neon Abyss",
    prompt: "Macro shot of a jellyfish glowing in deep blue water, neon cyberpunk palette, particles",
    model: "Cinematic-AI", presetId: "push-in", parentId: null, hours: 36,
    tags: ["Cyberpunk", "Underwater", "VFX"], likesCount: 5230, author: AMA,
  }),
  item("s-jelly-square", "image", "1069", "1:1", {
    title: "Neon Abyss — Square",
    prompt: "Macro shot of a jellyfish glowing in deep blue water, neon cyberpunk palette, VFX particles",
    model: "Cinematic-AI", presetId: "vfx", parentId: "s-jelly", hours: 33,
    tags: ["VFX", "Cyberpunk", "Underwater"], likesCount: 1811, author: AMA,
  }),
  item("s-jelly-drift", "video", "1069", "16:9", {
    title: "Deep Blue Drift",
    prompt: "A jellyfish drifting through deep blue water, slow lateral camera pan",
    model: "Motion-Pro", presetId: "pan", parentId: "s-jelly", hours: 12,
    tags: ["Camera Pan", "Underwater", "Motion"], likesCount: 962, author: DEV,
  }),
  item("s-bear", "image", "433", "1:1", {
    title: "Grizzly Close-up",
    prompt: "Close portrait of a grizzly bear, wet fur, cinematic rim lighting",
    model: "Higgsfield-V2", presetId: "cinematic", parentId: null, hours: 26,
    tags: ["Cinematic Lighting", "Wildlife", "Portrait"], likesCount: 2688, author: KENJI,
  }),
  item("s-bear-push", "video", "433", "16:9", {
    title: "Grizzly Push-in",
    prompt: "Close portrait of a grizzly bear, slow dolly in to the eyes, cinematic rim lighting",
    model: "Motion-Pro", presetId: "push-in", parentId: "s-bear", hours: 24, seconds: 8,
    tags: ["Dolly In", "Wildlife", "Motion"], likesCount: 3390, author: KENJI,
  }),
  item("s-hiker", "image", "1015", "9:16", {
    title: "Cliffside Hiker",
    prompt: "A lone hiker on a cliff edge above a fjord at dawn, volumetric light",
    model: "Higgsfield-V2", presetId: "cinematic", parentId: null, hours: 6,
    tags: ["Cinematic Lighting", "Landscape"], likesCount: 418, author: DEV,
  }),
];

/** Converts seed items into studio takes so the grid, graph and dock share one model. */
export function seedGenerations(projectId: string): Generation[] {
  const byAge = [...SEED_ITEMS].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return byAge
    .map((s, i): Generation => {
      const model = modelByName(s.model);
      const t = Date.parse(s.createdAt);
      const seconds = s.kind === "video" ? Number(s.duration.split(":")[1]) : 4;
      const parent = SEED_ITEMS.find((p) => p.id === s.parentId);
      return {
        id: s.id,
        n: i + 1,
        projectId,
        title: s.title,
        tags: s.tags,
        likes: s.likesCount,
        author: s.author,
        favorite: false,
        recipe: {
          mode: s.kind,
          prompt: s.prompt,
          modelId: model.id,
          aspectRatio: s.aspectRatio,
          count: 1,
          durationSec: seconds,
          presetId: s.presetId,
          seed: s.seed,
          reference: parent ? { src: parent.thumbnailUrl, name: parent.title, sourceKey: parent.assetKey } : null,
        },
        parentId: s.parentId,
        createdAt: t,
        startAt: t - (s.kind === "video" ? 7000 : 3500) - (s.seed % 5000),
        endAt: t,
        outputs: [
          {
            id: `${s.id}-o`,
            kind: s.kind,
            key: s.assetKey,
            src: s.kind === "video" ? s.videoUrl : s.thumbnailUrl,
            poster: s.thumbnailUrl,
            readyAt: t,
          },
        ],
        cost: s.kind === "image" ? model.imageCost : model.videoCost * seconds,
      };
    })
    .reverse();
}
