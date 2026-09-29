export type Mode = "image" | "video";
export type AspectRatio = "1:1" | "16:9" | "9:16";

export interface Reference {
  src: string; // data URL for uploads, /mock path for previous outputs
  name: string;
  /** Mock asset key when the reference is a previous output, so results stay on-subject. */
  sourceKey?: string;
}

/** Everything needed to reproduce a take. Stored verbatim on every generation. */
export interface Recipe {
  mode: Mode;
  prompt: string;
  modelId: string;
  aspectRatio: AspectRatio;
  count: number; // images per take; always 1 for video
  durationSec: number; // video only
  presetId: string;
  seed: number;
  reference: Reference | null;
}

export interface Output {
  id: string;
  kind: Mode;
  key: string; // mock asset key
  src: string;
  poster: string;
  readyAt: number;
}

export interface Author {
  name: string;
  avatar: string;
}

/** A "take": one run of a recipe. Status is derived from time, so it survives reloads. */
export interface Generation {
  id: string;
  n: number; // take number within its project
  projectId: string;
  title: string;
  tags: string[];
  likes: number;
  author: Author;
  favorite: boolean;
  recipe: Recipe;
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
