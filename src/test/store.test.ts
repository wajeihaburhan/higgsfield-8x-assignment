import { describe, expect, it } from "vitest";
import type { ImageRecipe, VideoRecipe } from "@/lib/types";
import { useStudio } from "@/store/useStudio";

const s = () => useStudio.getState();
const take = (id: string) => s().generations.find((g) => g.id === id)!;

describe("studio store", () => {
  it("submit queues a take from the draft, charges credits and re-rolls the seed", () => {
    s().setDraft("image", { prompt: "Latte art in a cafe", count: 1, modelId: "prism-2" });
    const seed = s().drafts.image.seed;
    const credits = s().credits;
    expect(s().submit("image")).toBe(true);
    const g = s().generations[0];
    expect(g.recipe).toMatchObject({ prompt: "Latte art in a cafe", seed });
    expect(g.outputs[0].key).toBe("431");
    expect(s().credits).toBe(credits - 2);
    expect(s().drafts.image.seed).not.toBe(seed);
    expect(s().drafts.image.prompt).toBe("Latte art in a cafe");
  });

  it("keeps the seed when it is locked", () => {
    s().setSeedLocked("image", true);
    s().setDraft("image", { prompt: "x", seed: 1234 });
    s().submit("image");
    expect(s().drafts.image.seed).toBe(1234);
  });

  it("rejects blank prompts and unaffordable jobs", () => {
    const count = s().generations.length;
    expect(s().submit("image")).toBe(false); // default draft prompt is empty
    useStudio.setState({ credits: 1 });
    s().setDraft("video", { prompt: "a balloon" });
    expect(s().submit("video")).toBe(false);
    expect(s().generations).toHaveLength(count);
  });

  it("numbers takes per studio", () => {
    const lastImage = Math.max(...s().generations.filter((g) => g.recipe.mode === "image").map((g) => g.n));
    s().setDraft("image", { prompt: "x" });
    s().submit("image");
    expect(s().generations[0].n).toBe(lastImage + 1);
  });

  it("forkParams loads the parent recipe with a new seed and a branch link", () => {
    const parent = take("i-bear");
    s().forkParams("i-bear");
    expect(s().drafts.image).toEqual({ ...parent.recipe, seed: s().drafts.image.seed });
    expect(s().drafts.image.seed).not.toBe(parent.recipe.seed);
    expect(s().draftParents.image).toBe("i-bear");
  });

  it("reusePrompt only copies the prompt", () => {
    s().setDraft("image", { steps: 55 });
    s().reusePrompt("i-jelly");
    expect(s().drafts.image.prompt).toBe(take("i-jelly").recipe.prompt);
    expect((s().drafts.image as ImageRecipe).steps).toBe(55);
  });

  it("upscale, variations and inpaint create child takes", () => {
    const o = take("i-fjord").outputs[0];
    s().upscale("i-fjord", o.id);
    expect(s().generations[0]).toMatchObject({ op: "upscale", parentId: "i-fjord" });
    s().variations("i-fjord", o.id);
    expect(s().generations[0].outputs).toHaveLength(4);
    s().inpaint("i-fjord", o.id, { x: 0.1, y: 0.1, w: 0.3, h: 0.3, prompt: "a red umbrella" });
    const inpaint = s().generations[0];
    expect(inpaint).toMatchObject({ op: "inpaint", title: "Fjord Sunrise — Red Umbrella" });
    expect((inpaint.recipe as ImageRecipe).inpaint?.prompt).toBe("a red umbrella");
  });

  it("animate puts an image into the video draft as its start frame", () => {
    const o = take("i-jelly").outputs[0];
    s().animate("i-jelly", o.id);
    const draft = s().drafts.video as VideoRecipe;
    expect(draft.startFrame).toMatchObject({ name: "Neon Abyss", sourceKey: "1069" });
  });

  it("addStyleRef keeps at most three references", () => {
    for (let i = 0; i < 5; i++) s().addStyleRef({ src: `r${i}`, name: `ref ${i}` });
    const refs = s().drafts.image.styleRefs;
    expect(refs).toHaveLength(3);
    expect(refs.at(-1)?.name).toBe("ref 4");
  });

  it("toggleFavorite flips one take", () => {
    s().toggleFavorite("i-pug");
    expect(take("i-pug").favorite).toBe(true);
    s().toggleFavorite("i-pug");
    expect(take("i-pug").favorite).toBe(false);
  });

  it("resetDemo restores the sample project", () => {
    s().setDraft("image", { prompt: "x" });
    s().submit("image");
    s().createProject("Client work");
    s().resetDemo();
    expect(s().projects.map((p) => p.name)).toEqual(["Sample project"]);
    expect(s().generations.every((g) => g.author.name !== "Demo Creator")).toBe(true);
  });
});
