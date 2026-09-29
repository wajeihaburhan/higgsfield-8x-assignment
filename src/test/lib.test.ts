import { describe, expect, it } from "vitest";
import { costOf, defaultImageRecipe, defaultVideoRecipe } from "@/lib/catalog";
import { edgeLabel, layoutTree } from "@/lib/lineage";
import { progressOf, simulate, statusOf, tagsFor, titleFrom } from "@/lib/mock";
import type { Generation, ImageRecipe, Recipe, VideoRecipe } from "@/lib/types";
import { applyFilters } from "@/store/useStudio";

const image = (patch: Partial<ImageRecipe> = {}): ImageRecipe => ({ ...defaultImageRecipe(), seed: 42, ...patch });
const video = (patch: Partial<VideoRecipe> = {}): VideoRecipe => ({ ...defaultVideoRecipe(), seed: 42, ...patch });

function take(id: string, recipe: Recipe, extra: Partial<Generation> = {}): Generation {
  return {
    id, n: 1, projectId: "p", title: id, tags: [], likes: 0, author: { name: "t", avatar: "" }, favorite: false,
    recipe, op: null, parentId: null, createdAt: 0, startAt: 0, endAt: 0, outputs: [], cost: 0, ...extra,
  };
}

describe("costOf", () => {
  it("prices images per image, doubled at 4K, plus references", () => {
    expect(costOf(image({ modelId: "aurora-xl", count: 2 }))).toBe(6);
    expect(costOf(image({ modelId: "aurora-xl", count: 2, resolution: "4K" }))).toBe(12);
    const ref = { src: "x", name: "r", role: "style" as const, weight: 1 };
    expect(costOf(image({ modelId: "lumen-turbo", count: 1, styleRefs: [ref, ref] }))).toBe(3);
  });

  it("prices one-click image operations flat", () => {
    expect(costOf(image(), "upscale")).toBe(3);
    expect(costOf(image(), "inpaint")).toBe(2);
  });

  it("prices video per second with an fps multiplier and end-frame surcharge", () => {
    expect(costOf(video({ modelId: "higgsfield-v2", durationSec: 5, fps: 24 }))).toBe(15);
    expect(costOf(video({ modelId: "cinematic-ai", durationSec: 5, fps: 60 }))).toBe(38);
    expect(costOf(video({ modelId: "higgsfield-v2", durationSec: 3, endFrame: { src: "x", name: "end" } }))).toBe(11);
  });
});

describe("simulate (mock provider)", () => {
  it("picks assets relevant to the prompt", () => {
    expect(simulate(image({ prompt: "Leopard on a dusty safari trail", count: 1 }), 0).outputs[0].key).toBe("219");
    expect(simulate(video({ prompt: "Concert crowd under stage lights" }), 0).outputs[0].src).toBe("/mock/vid/452-16x9.mp4");
  });

  it("is deterministic for the same recipe and seed", () => {
    const r = image({ prompt: "a quiet landscape", count: 4 });
    expect(simulate(r, 0).outputs.map((o) => o.key)).toEqual(simulate(r, 999).outputs.map((o) => o.key));
  });

  it("keeps the reference subject for upscales and variations", () => {
    const ref = { src: "/mock/img/433-1x1.jpg", name: "bear", sourceKey: "433", role: "style" as const, weight: 1 };
    const up = simulate(image({ prompt: "anything at all", count: 1, styleRefs: [ref] }), 0, "upscale");
    expect(up.outputs[0].key).toBe("433");
    const vars = simulate(image({ prompt: "anything", count: 4, styleRefs: [ref] }), 0, "variations");
    expect(vars.outputs.every((o) => o.key === "433")).toBe(true);
    // Each variation gets a distinct look so the four don't render identically.
    expect(new Set(vars.outputs.map((o) => JSON.stringify(o.look))).size).toBe(4);
  });

  it("uses the aspect ratio in asset paths and staggers outputs before the end time", () => {
    const sim = simulate(image({ prompt: "fjord", aspectRatio: "4:3", count: 3 }), 1000);
    expect(sim.outputs.every((o) => o.src.endsWith("-4x3.jpg"))).toBe(true);
    expect(sim.startAt).toBeGreaterThan(1000);
    const ready = sim.outputs.map((o) => o.readyAt);
    expect(ready).toEqual([...ready].sort((a, b) => a - b));
    expect(ready.at(-1)).toBe(sim.endAt);
  });
});

describe("status and progress", () => {
  const g = { startAt: 1000, endAt: 3000 };
  it("derives status from time", () => {
    expect(statusOf(g, 500)).toBe("queued");
    expect(statusOf(g, 2000)).toBe("running");
    expect(statusOf(g, 3000)).toBe("done");
  });
  it("eases progress from 0 to 1", () => {
    expect(progressOf(1000, 3000, 900)).toBe(0);
    expect(progressOf(1000, 3000, 2000)).toBeCloseTo(0.75);
    expect(progressOf(1000, 3000, 5000)).toBe(1);
  });
});

describe("tags and titles", () => {
  it("derives tags from preset, prompt, subject and format", () => {
    expect(tagsFor(image({ prompt: "neon city at night", stylePreset: "cinematic", resolution: "4K" }), "274", null)).toEqual(["Cinematic Lighting", "Cyberpunk", "Urban", "Night"]);
    expect(tagsFor(video({ prompt: "a waterfall", camera: "pan", motion: 90 }), "15", null)).toEqual(["Camera Pan", "High Motion", "Nature", "Waterfall"]);
    expect(tagsFor(image({ prompt: "x" }), "433", "upscale")[0]).toBe("Upscaled");
  });
  it("builds a short title from the prompt", () => {
    expect(titleFrom("A leopard on a dusty safari trail")).toBe("Leopard Dusty Safari");
    expect(titleFrom("   ")).toBe("Untitled");
  });
});

describe("lineage", () => {
  const parent = take("a", image({ prompt: "p" }));
  it("labels edges by what changed", () => {
    expect(edgeLabel(parent, take("b", image({ prompt: "p" }), { op: "upscale" }))).toBe("Upscale");
    expect(edgeLabel(parent, take("b", image({ prompt: "p", aspectRatio: "16:9" })))).toBe("Reframe");
    expect(edgeLabel(parent, take("b", image({ prompt: "p", seed: 7 })))).toBe("Vary");
    expect(edgeLabel(parent, take("b", image({ prompt: "p" })))).toBe("Rerun");
    expect(edgeLabel(parent, take("b", image({ prompt: "q", cfg: 12 })))).toBe("Fork");
  });

  it("lays out trees left to right with parents centred on children", () => {
    const root = take("root", image(), { createdAt: 1 });
    const kidA = take("a", image(), { parentId: "root", createdAt: 2 });
    const kidB = take("b", image(), { parentId: "root", createdAt: 3 });
    const grandkid = take("c", image(), { parentId: "a", createdAt: 4 });
    const { nodes, cols, rows } = layoutTree([root, kidA, kidB, grandkid]);
    const at = (id: string) => nodes.find((n) => n.g.id === id)!;
    expect(cols).toBe(3);
    expect(rows).toBe(2);
    expect(at("root").col).toBe(0);
    expect(at("c").col).toBe(2);
    expect(at("root").row).toBe((at("a").row + at("b").row) / 2);
  });
});

describe("applyFilters", () => {
  const takes = [
    take("a", image(), { tags: ["Night", "Urban"], favorite: true }),
    take("b", image(), { tags: ["Night"] }),
    take("c", image(), { tags: ["Food"] }),
  ];
  it("requires every selected tag", () => {
    expect(applyFilters(takes, ["Night"], false).map((t) => t.id)).toEqual(["a", "b"]);
    expect(applyFilters(takes, ["Night", "Urban"], false).map((t) => t.id)).toEqual(["a"]);
  });
  it("can restrict to favorites", () => {
    expect(applyFilters(takes, [], true).map((t) => t.id)).toEqual(["a"]);
  });
});
