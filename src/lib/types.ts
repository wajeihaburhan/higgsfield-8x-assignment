export type Mode = "image" | "video";
/** Top-level screens: the two studios plus the Showcase dashboard. */
export type Screen = Mode | "showcase";
export type ImageAspect = "1:1" | "16:9" | "9:16" | "4:3";
export type VideoAspect = "1:1" | "16:9" | "9:16";
export type AspectRatio = ImageAspect;

export interface Reference {
  src: string; // data URL for uploads/frames, /mock path for previous outputs
  name: string;
  /** Mock asset key when the reference is a previous output, so results stay on-subject. */
  sourceKey?: string;
}

/** Image-to-image / ControlNet-style conditioning slot. */
export type RefRole = "style" | "canny" | "depth" | "pose";
export interface StyleRef extends Reference {
  role: RefRole;
  weight: number; // 0..1
}

export type Sampler = "dpmpp-2m-karras" | "euler-a" | "ddim" | "unipc";
export type Resolution = "1080p" | "4K";

export interface InpaintMask {
  /** Rectangle in 0..1 image coordinates. */
  x: number;
  y: number;
  w: number;
  h: number;
  prompt: string;
}

interface BaseRecipe {
  prompt: string;
  modelId: string;
  seed: number;
}

export interface ImageRecipe extends BaseRecipe {
  mode: "image";
  aspectRatio: ImageAspect;
  negativePrompt: string;
  sampler: Sampler;
  steps: number;
  cfg: number;
  resolution: Resolution;
  count: number;
  stylePreset: string;
  styleRefs: StyleRef[];
  inpaint?: InpaintMask;
}

export type Camera = "static" | "zoom" | "pan" | "tilt" | "orbit";
export type Fps = 24 | 30 | 60;

export interface VideoRecipe extends BaseRecipe {
  mode: "video";
  aspectRatio: VideoAspect;
  durationSec: number; // 3..10
  motion: number; // 0..100
  camera: Camera;
  fps: Fps;
  motionModel: string;
  startFrame: Reference | null;
  endFrame: Reference | null;
}

/** Everything needed to reproduce a take. Stored verbatim on every generation. */
export type Recipe = ImageRecipe | VideoRecipe;
export type RecipeFor<M extends Mode> = M extends "image" ? ImageRecipe : VideoRecipe;

/** Visual variation applied to a mock asset so variations of one source look distinct. */
export interface Look {
  hue: number;
  zoom: number;
  flip: boolean;
  /** Focal point of the zoom, in percent; defaults to the centre. */
  ox?: number;
  oy?: number;
}

export interface Output {
  id: string;
  kind: Mode;
  key: string; // mock asset key
  src: string;
  poster: string;
  readyAt: number;
  look?: Look;
}

export interface Author {
  name: string;
  avatar: string;
}

/** How a take was derived from its parent, when it came from a one-click action. */
export type Op = "upscale" | "variations" | "inpaint" | "animate" | "remix";

/** A "take": one run of a recipe. Status is derived from time, so it survives reloads. */
export interface Generation {
  id: string;
  n: number; // take number within its project and mode
  projectId: string;
  title: string;
  tags: string[];
  likes: number;
  author: Author;
  favorite: boolean;
  recipe: Recipe;
  op: Op | null;
  parentId: string | null;
  createdAt: number;
  startAt: number;
  endAt: number;
  outputs: Output[];
  cost: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
}

export type TakeStatus = "queued" | "running" | "done";

/** One media card in the grid: a single output of a take. */
export interface CardItem {
  g: Generation;
  o: Output;
}
