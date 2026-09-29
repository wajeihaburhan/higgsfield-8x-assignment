import type { Generation, Output } from "./types";

export function timeAgo(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

export const genTime = (g: Generation) => `${((g.endAt - g.startAt) / 1000).toFixed(1)}s`;

export const outputFilename = (g: Generation, o: Output) =>
  `${g.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${g.outputs.indexOf(o) + 1}.${o.kind === "image" ? "jpg" : "mp4"}`;
