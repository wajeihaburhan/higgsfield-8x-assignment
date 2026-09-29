import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { IMAGE_ITEMS, VIDEO_ITEMS } from "@/lib/seed";
import { cardByTitle, cards, renderApp } from "./renderApp";

describe("Media feed grid", () => {
  it("renders one card per seeded image, with title, model and ratio", async () => {
    await renderApp("/image");
    expect(cards()).toHaveLength(IMAGE_ITEMS.length);

    const fjord = IMAGE_ITEMS.find((i) => i.id === "i-fjord")!;
    const card = cardByTitle(fjord.title);
    expect(within(card).getByRole("img", { name: fjord.title })).toHaveAttribute("src", fjord.imageUrl);
    expect(within(card).getByText(fjord.model)).toBeInTheDocument();
    expect(within(card).getByText(fjord.aspectRatio)).toBeInTheDocument();
    expect(within(card).getByText(fjord.author.name)).toBeInTheDocument();
  });

  it("shows only image cards in Image Studio and only video cards in Video Studio", async () => {
    const user = userEvent.setup();
    const { container } = await renderApp("/image");
    expect(container.querySelectorAll("article video")).toHaveLength(0);
    expect(screen.queryByRole("heading", { name: "Balloon Ascent" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /Video Studio/ }));
    await screen.findByRole("heading", { level: 1, name: "Direct a shot" });
    expect(cards()).toHaveLength(VIDEO_ITEMS.length);
    expect(container.querySelectorAll("article video")).toHaveLength(VIDEO_ITEMS.length);
    expect(screen.getByRole("heading", { name: "Balloon Ascent" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Fjord Sunrise" })).not.toBeInTheDocument();
  });

  it("gives image and video cards their own quick actions", async () => {
    const user = userEvent.setup();
    await renderApp("/image");
    const image = cardByTitle("Fjord Sunrise");
    for (const action of ["Upscale", "Variations", "Inpaint", "Download"]) {
      expect(within(image).getByRole("button", { name: action })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("link", { name: /Video Studio/ }));
    await screen.findByRole("heading", { level: 1, name: "Direct a shot" });
    const video = cardByTitle("Balloon Ascent");
    expect(within(video).getByRole("button", { name: "Extract frame" })).toBeInTheDocument();
    expect(within(video).queryByRole("button", { name: "Upscale" })).not.toBeInTheDocument();
    expect(within(video).getByText("30fps")).toBeInTheDocument();
  });

  it("lists all images first, then all videos, on the Showcase", async () => {
    await renderApp("/showcase");
    const images = screen.getByRole("region", { name: /Images/ });
    const videos = screen.getByRole("region", { name: /Videos/ });
    expect(images.compareDocumentPosition(videos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(images).getAllByRole("article")).toHaveLength(IMAGE_ITEMS.length);
    expect(within(videos).getAllByRole("article")).toHaveLength(VIDEO_ITEMS.length);
  });

  it("filters the feed with a tag pill", async () => {
    const user = userEvent.setup();
    await renderApp("/image");
    await user.click(screen.getByRole("button", { name: /^Wildlife/ }));
    const expected = IMAGE_ITEMS.filter((i) => i.tags.includes("Wildlife"));
    expect(cards()).toHaveLength(expected.length);
    for (const item of expected) expect(screen.getByRole("heading", { name: item.title })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(cards()).toHaveLength(IMAGE_ITEMS.length);
  });

  it("toggles a favorite and filters by favorites", async () => {
    const user = userEvent.setup();
    await renderApp("/image");
    await user.click(within(cardByTitle("Neon Streets")).getByRole("button", { name: "Favorite" }));
    await user.click(screen.getByRole("button", { name: /Favorites/ }));
    expect(cards()).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Neon Streets" })).toBeInTheDocument();
  });
});
