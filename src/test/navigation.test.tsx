import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useStudio } from "@/store/useStudio";
import { renderApp } from "./renderApp";
import { testRouter } from "./router";

const tabBar = () => screen.getByRole("navigation", { name: "Studios" });
const tab = (name: string) => within(tabBar()).getByRole("link", { name: new RegExp(name) });

describe("Navigation & screen switching", () => {
  it("renders the tab bar with Showcase, Image Studio and Video Studio", async () => {
    await renderApp("/showcase");
    const links = within(tabBar()).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/showcase", "/image", "/video"]);
    expect(tab("Showcase")).toHaveAttribute("aria-current", "page");
    expect(tab("Image Studio")).not.toHaveAttribute("aria-current");
  });

  it("switches between Image Studio and Video Studio", async () => {
    const user = userEvent.setup();
    await renderApp("/image");
    expect(screen.getByRole("heading", { level: 1, name: "Compose a still" })).toBeInTheDocument();
    expect(tab("Image Studio")).toHaveAttribute("aria-current", "page");

    await user.click(tab("Video Studio"));
    expect(testRouter.path).toBe("/video");
    expect(await screen.findByRole("heading", { level: 1, name: "Direct a shot" })).toBeInTheDocument();
    expect(tab("Video Studio")).toHaveAttribute("aria-current", "page");
    expect(tab("Image Studio")).not.toHaveAttribute("aria-current");
    // Video-only controls replace the image ones
    expect(screen.getByRole("slider", { name: "Motion intensity" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Negative prompt" })).not.toBeInTheDocument();

    await user.click(tab("Image Studio"));
    expect(await screen.findByRole("heading", { level: 1, name: "Compose a still" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Negative prompt" })).toBeInTheDocument();
  });

  it("keeps each studio's draft when switching tabs", async () => {
    const user = userEvent.setup();
    await renderApp("/image");
    await user.type(screen.getByRole("textbox", { name: "Prompt" }), "a quiet harbour");
    await user.click(tab("Video Studio"));
    await screen.findByRole("heading", { level: 1, name: "Direct a shot" });
    expect(screen.getByRole("textbox", { name: "Prompt" })).toHaveValue("");
    await user.click(tab("Image Studio"));
    expect(await screen.findByRole("textbox", { name: "Prompt" })).toHaveValue("a quiet harbour");
  });

  it("shows the credit balance in the header", async () => {
    await renderApp("/showcase");
    expect(screen.getByTitle("Credits")).toHaveTextContent(String(useStudio.getState().credits));
  });

  it("opens the profile drawer with projects", async () => {
    const user = userEvent.setup();
    await renderApp("/showcase");
    await user.click(screen.getByRole("button", { name: "Open profile" }));
    const drawer = await screen.findByRole("dialog", { name: "Profile" });
    expect(within(drawer).getByRole("button", { name: /Sample project/ })).toBeInTheDocument();
  });
});
