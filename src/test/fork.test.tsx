import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ImageRecipe, VideoRecipe } from "@/lib/types";
import { useStudio } from "@/store/useStudio";
import { cardByTitle, renderApp } from "./renderApp";
import { testRouter } from "./router";

const take = (id: string) => useStudio.getState().generations.find((g) => g.id === id)!;

describe("Card actions & parameters drawer", () => {
  it("clicking a card opens the drawer populated with that take's parameters", async () => {
    const user = userEvent.setup();
    await renderApp("/image");
    const parent = take("i-fjord");
    const r = parent.recipe as ImageRecipe;

    await user.click(cardByTitle("Fjord Sunrise"));
    const drawer = await screen.findByRole("dialog", { name: "Remix Fjord Sunrise" });

    expect(within(drawer).getByRole("textbox", { name: "Prompt" })).toHaveValue(r.prompt);
    expect(within(drawer).getByRole("combobox", { name: "Model" })).toHaveValue(r.modelId);
    expect(within(drawer).getByRole("combobox", { name: "Sampler" })).toHaveValue(r.sampler);
    expect(within(drawer).getByRole("radio", { name: new RegExp(r.aspectRatio) })).toHaveAttribute("aria-checked", "true");
    expect(within(drawer).getByRole("slider", { name: "Steps" })).toHaveValue(String(r.steps));

    const json = drawer.querySelector("pre")!.textContent!;
    expect(json).toContain(`"prompt": "${r.prompt}"`);
    expect(json).toContain(`"seed": ${r.seed}`);
    expect(json).toContain(`"modelId": "${r.modelId}"`);
    expect(json).not.toContain("modified");
  });

  it("Fork to composer copies the parent's parameters with a fresh seed and branch link", async () => {
    const user = userEvent.setup();
    await renderApp("/image");
    const parent = take("i-bear");
    const r = parent.recipe as ImageRecipe;

    await user.click(cardByTitle("Grizzly Close-up"));
    const drawer = await screen.findByRole("dialog", { name: "Remix Grizzly Close-up" });
    await user.click(within(drawer).getByRole("button", { name: /Fork to composer/ }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Remix/ })).not.toBeInTheDocument());
    expect(screen.getByRole("textbox", { name: "Prompt" })).toHaveValue(r.prompt);
    expect(screen.getByRole("combobox", { name: "Sampler" })).toHaveValue(r.sampler);
    expect(screen.getByRole("radio", { name: /4:3/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(new RegExp(`Branching from #${parent.n} · Grizzly Close-up`))).toBeInTheDocument();

    const draft = useStudio.getState().drafts.image;
    expect(draft).toMatchObject({ prompt: r.prompt, steps: r.steps, cfg: r.cfg, stylePreset: r.stylePreset, modelId: r.modelId });
    expect(draft.seed).not.toBe(r.seed);
    expect(screen.getByRole("spinbutton", { name: "Seed" })).toHaveValue(draft.seed);

    // Generating from the composer records the lineage.
    await user.click(screen.getByRole("button", { name: /Generate/ }));
    expect(useStudio.getState().generations[0]).toMatchObject({ parentId: "i-bear", op: null });
  });

  it("editing in the drawer highlights changed keys and remixes as a child take", async () => {
    const user = userEvent.setup();
    await renderApp("/image");
    await user.click(cardByTitle("Neon Streets"));
    const drawer = await screen.findByRole("dialog", { name: "Remix Neon Streets" });

    fireEvent.change(within(drawer).getByRole("slider", { name: "Guidance" }), { target: { value: "12" } });
    expect(within(drawer).getByText("● modified")).toBeInTheDocument();
    expect(within(drawer).getByText(/recipe\.json/)).toHaveTextContent("edited");

    await user.click(within(drawer).getByRole("button", { name: /Remix with changes/ }));
    const child = useStudio.getState().generations[0];
    expect(child.parentId).toBe("i-neon");
    expect((child.recipe as ImageRecipe).cfg).toBe(12);
    expect((child.recipe as ImageRecipe).seed).toBe(take("i-neon").recipe.seed);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Remix/ })).not.toBeInTheDocument());
  });

  it("Exact recipe restores every parameter including the seed", async () => {
    const user = userEvent.setup();
    await renderApp("/image");
    await user.click(cardByTitle("Morning Latte"));
    const drawer = await screen.findByRole("dialog", { name: "Remix Morning Latte" });
    await user.click(within(drawer).getByRole("button", { name: /Exact/ }));
    expect(useStudio.getState().drafts.image).toEqual(take("i-latte").recipe);
  });

  it("the video card's Remix action opens the drawer with motion settings and frame extraction", async () => {
    const user = userEvent.setup();
    await renderApp("/video");
    const r = take("v-balloon").recipe as VideoRecipe;
    await user.click(within(cardByTitle("Balloon Ascent")).getByRole("button", { name: "Remix" }));
    const drawer = await screen.findByRole("dialog", { name: "Remix Balloon Ascent" });

    expect(within(drawer).getByRole("combobox", { name: "Camera" })).toHaveValue(r.camera);
    expect(within(drawer).getByRole("slider", { name: "Motion intensity" })).toHaveValue(String(r.motion));
    expect(within(drawer).getByRole("radio", { name: String(r.fps) })).toHaveAttribute("aria-checked", "true");
    expect(within(drawer).getByText("Frame extraction")).toBeInTheDocument();
    expect(drawer.querySelector("pre")!.textContent).toContain(`"fps": ${r.fps}`);
  });

  it("Animate sends an image to Video Studio as the start frame", async () => {
    const user = userEvent.setup();
    await renderApp("/image");
    await user.click(cardByTitle("Safari Leopard"));
    const drawer = await screen.findByRole("dialog", { name: "Remix Safari Leopard" });
    await user.click(within(drawer).getByRole("button", { name: /Animate/ }));

    expect(testRouter.path).toBe("/video");
    expect(await screen.findByRole("heading", { level: 1, name: "Direct a shot" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start frame: Safari Leopard" })).toBeInTheDocument();
    expect(useStudio.getState().drafts.video.startFrame).toMatchObject({ name: "Safari Leopard", sourceKey: "219" });
  });

  it("Upscale and Variations queue child takes with the right settings", async () => {
    const user = userEvent.setup();
    await renderApp("/image");
    await user.click(within(cardByTitle("Violet Bloom")).getByRole("button", { name: "Upscale" }));
    const upscale = useStudio.getState().generations[0];
    expect(upscale).toMatchObject({ parentId: "i-petunia", op: "upscale", title: "Violet Bloom — 4K" });
    expect((upscale.recipe as ImageRecipe).resolution).toBe("4K");

    await user.click(within(cardByTitle("Violet Bloom")).getByRole("button", { name: "Variations" }));
    const variations = useStudio.getState().generations[0];
    expect(variations).toMatchObject({ parentId: "i-petunia", op: "variations" });
    expect(variations.outputs).toHaveLength(4);
    expect(new Set(variations.outputs.map((o) => o.key))).toEqual(new Set(["152"]));
    expect(screen.getByRole("region", { name: "Generation queue" })).toHaveTextContent("Violet Bloom — Variations");
  });

  it("Inpaint opens a mask dialog that needs a mask and a prompt", async () => {
    const user = userEvent.setup();
    await renderApp("/image");
    await user.click(within(cardByTitle("Pug Burrito")).getByRole("button", { name: "Inpaint" }));
    const dialog = await screen.findByRole("dialog", { name: "Inpaint" });
    const submit = within(dialog).getByRole("button", { name: /Inpaint/ });
    expect(submit).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox", { name: "Inpaint prompt" }), "a red scarf");
    expect(submit).toBeDisabled(); // still needs a drawn mask
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Inpaint" })).not.toBeInTheDocument();
  });
});
