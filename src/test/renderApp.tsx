import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import ImageStudioPage from "@/app/(studio)/image/page";
import ShowcasePage from "@/app/(studio)/showcase/page";
import VideoStudioPage from "@/app/(studio)/video/page";
import { StudioShell } from "@/components/shell/StudioShell";
import { testRouter } from "./router";

/** Maps the current (test) pathname to the real route components, like the App Router would. */
function Routes() {
  const path = usePathname() ?? "/showcase";
  if (path.startsWith("/video")) return <VideoStudioPage />;
  if (path.startsWith("/image")) return <ImageStudioPage />;
  return <ShowcasePage />;
}

/** Renders the real shell + route at `path` and waits for the client-only shell to mount. */
export async function renderApp(path = "/showcase") {
  testRouter.reset(path);
  const utils = render(
    <StudioShell>
      <Routes />
    </StudioShell>
  );
  await screen.findByRole("navigation", { name: "Studios" });
  return utils;
}

/** The media cards currently in the feed. */
export const cards = () => screen.queryAllByRole("article");

/** Every card titled `title` (a multi-image take renders one card per image). */
export const cardsByTitle = (title: string) =>
  screen.getAllByRole("heading", { name: title, level: 3 }).map((h) => h.closest("article") as HTMLElement);

/** The card whose title is `title`. */
export function cardByTitle(title: string) {
  const card = screen.getByRole("heading", { name: title, level: 3 }).closest("article");
  if (!card) throw new Error(`No card titled ${title}`);
  return card as HTMLElement;
}
