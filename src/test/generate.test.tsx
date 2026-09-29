import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IMAGE_ITEMS } from "@/lib/seed";
import { useStudio } from "@/store/useStudio";
import { cards, cardsByTitle, renderApp } from "./renderApp";

const PROMPT = "Leopard on a dusty safari trail, wildlife photography";

/** Fake clocks (including Date, which drives job progress) that still tick in real time for RTL's waits. */
function useFakeClock() {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const queue = () => screen.queryByRole("region", { name: "Generation queue" });
const generateButton = () => screen.getByRole("button", { name: /Generate/ });

describe("Generation form submission", () => {
  it("disables Generate until there is a prompt", async () => {
    await renderApp("/image");
    expect(screen.getByRole("textbox", { name: "Prompt" })).toHaveValue("");
    expect(generateButton()).toBeDisabled();
  });

  it("disables Generate when the cost exceeds the credit balance", async () => {
    const user = userEvent.setup();
    await renderApp("/image");
    act(() => useStudio.setState({ credits: 1 }));
    await user.type(screen.getByRole("textbox", { name: "Prompt" }), PROMPT);
    const button = screen.getByRole("button", { name: /Need credits/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Not enough credits");
  });

  it("submits the prompt and aspect ratio, then shows queue → progress → result", async () => {
    await renderApp("/image");
    const user = useFakeClock();
    const creditsBefore = useStudio.getState().credits;

    await user.type(screen.getByRole("textbox", { name: "Prompt" }), PROMPT);
    await user.click(screen.getByRole("radio", { name: /16:9/ }));
    expect(screen.getByRole("radio", { name: /16:9/ })).toHaveAttribute("aria-checked", "true");
    // Aurora-XL, 2 images at 1080p = 6 credits, shown on the button
    expect(generateButton()).toHaveTextContent("6");
    await user.click(generateButton());

    // The job is recorded with exactly what was entered, and credits are charged up front.
    const job = useStudio.getState().generations[0];
    expect(job.recipe).toMatchObject({ mode: "image", prompt: PROMPT, aspectRatio: "16:9", count: 2 });
    expect(job.author.name).toBe("Demo Creator");
    expect(useStudio.getState().credits).toBe(creditsBefore - 6);

    // 1) Queued: the tray above the composer shows it immediately, and a placeholder card joins the feed.
    const tray = queue()!;
    expect(within(tray).getByRole("status")).toHaveTextContent("In queue");
    expect(within(tray).getByText(/Now rendering · 1/)).toBeInTheDocument();
    const placeholders = cardsByTitle(job.title);
    expect(placeholders).toHaveLength(2);
    for (const card of placeholders) expect(within(card).getByText("In queue")).toBeInTheDocument();
    expect(cards()).toHaveLength(IMAGE_ITEMS.length + 2);

    // 2) Rendering: stage, step counter and a percentage progress bar.
    await advance(job.startAt - Date.now() + 1200);
    const status = within(queue()!).getByRole("status");
    expect(status).toHaveTextContent(/Rendering · step \d+\/30/);
    const percent = Number(within(status).getByText(/^\d+%$/).textContent!.replace("%", ""));
    expect(percent).toBeGreaterThan(0);
    expect(percent).toBeLessThan(100);
    for (const card of cardsByTitle(job.title)) expect(within(card).getByText("Rendering")).toBeInTheDocument();

    // 3) Ready: the tray offers View / Remix and the card shows the generated images.
    await advance(job.endAt - Date.now() + 200);
    const ready = within(queue()!).getByRole("status");
    expect(ready).toHaveTextContent("Ready");
    expect(within(ready).getByRole("button", { name: /View/ })).toBeInTheDocument();
    const images = cardsByTitle(job.title).map((card) => within(card).getByRole("img", { name: job.title }));
    expect(images).toHaveLength(2);
    expect(images[0].getAttribute("src")).toMatch(/\/mock\/img\/219-16x9\.jpg$/); // the leopard asset

    // 4) The finished take leaves the tray after a few seconds.
    await advance(9000);
    expect(queue()).not.toBeInTheDocument();
  });

  it("opens the result from the tray's View button", async () => {
    await renderApp("/image");
    const user = useFakeClock();
    await user.type(screen.getByRole("textbox", { name: "Prompt" }), PROMPT);
    await user.click(generateButton());
    const job = useStudio.getState().generations[0];
    await advance(job.endAt - Date.now() + 200);
    await user.click(within(queue()!).getByRole("button", { name: /View/ }));
    const viewer = screen.getByRole("dialog", { name: job.title });
    expect(within(viewer).getByText(PROMPT)).toBeInTheDocument();
  });

  it("shows a frame counter while a video renders", async () => {
    await renderApp("/video");
    const user = useFakeClock();
    await user.type(screen.getByRole("textbox", { name: "Prompt" }), "Hot air balloon rising into a clear sky");
    await user.click(generateButton());
    const job = useStudio.getState().generations[0];
    expect(job.recipe.mode).toBe("video");
    await advance(job.startAt - Date.now() + 1500);
    // 5s at 24fps = 120 frames
    expect(within(queue()!).getByRole("status")).toHaveTextContent(/Rendering · frame \d+\/120/);
  });
});
