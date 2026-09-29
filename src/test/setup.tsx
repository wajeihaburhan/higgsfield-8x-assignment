import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { MotionGlobalConfig } from "framer-motion";
import { afterEach, beforeEach, vi } from "vitest";
import { useStudio } from "@/store/useStudio";
import { testRouter } from "./router";

// Animations resolve instantly so enter/exit states are deterministic.
MotionGlobalConfig.skipAnimations = true;

// --- next/navigation and next/link backed by the in-memory router -------------------------
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  const { testRouter: router } = await import("./router");
  const push = (href: string) => router.navigate(href);
  return {
    usePathname: () => useSyncExternalStore(router.subscribe, () => router.path),
    useRouter: () => ({ push, replace: push, back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
    redirect: vi.fn(),
  };
});

vi.mock("next/link", async () => {
  const { testRouter: router } = await import("./router");
  function Link({ href, children, onClick, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return (
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault();
          onClick?.(e);
          router.navigate(href);
        }}
        {...rest}
      >
        {children}
      </a>
    );
  }
  return { default: Link };
});

// --- Browser APIs jsdom does not implement -------------------------------------------------
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView = vi.fn();
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
})) as unknown as typeof window.matchMedia;
Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: vi.fn(() => Promise.resolve()) });
Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: vi.fn() });
Object.defineProperty(HTMLMediaElement.prototype, "load", { configurable: true, value: vi.fn() });

// --- Isolation: every test starts from the seeded sample project ---------------------------
const initialState = useStudio.getInitialState();

beforeEach(() => {
  localStorage.clear();
  useStudio.setState(initialState, true);
  testRouter.reset("/showcase");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
