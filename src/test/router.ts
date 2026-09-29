/**
 * Minimal in-memory stand-in for the Next.js App Router, used by the mocks in setup.tsx.
 * `usePathname()` reads `testRouter.path`; `router.push()` and `<Link>` clicks call `navigate()`.
 */
type Listener = () => void;

let path = "/showcase";
const listeners = new Set<Listener>();

export const testRouter = {
  get path() {
    return path;
  },
  navigate(next: string) {
    path = next;
    listeners.forEach((l) => l());
  },
  reset(next = "/showcase") {
    path = next;
    listeners.forEach((l) => l());
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
