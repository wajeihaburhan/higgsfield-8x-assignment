"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Gem, ImagePlus, X } from "lucide-react";
import { modelsFor } from "@/lib/catalog";
import { fileToReference } from "@/lib/image";
import type { AspectRatio, Mode, Reference } from "@/lib/types";

export function Label({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-faint">{children}</span>
      {hint && <span className="font-mono text-[11px] tabular-nums text-accent">{hint}</span>}
    </div>
  );
}

/** Pill toggle group with an animated active background. `id` must be unique per mounted group. */
export function Segmented<T extends string | number>({
  id,
  value,
  onChange,
  options,
  size = "md",
}: {
  id: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  size?: "sm" | "md";
}) {
  return (
    <div className="flex shrink-0 rounded-lg border border-line bg-surface-2/70 p-0.5" role="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`relative flex items-center justify-center gap-1.5 rounded-md font-mono tabular-nums transition-colors ${
              size === "sm" ? "h-7 px-2 text-[11px]" : "h-8 px-2.5 text-xs"
            } ${active ? "text-accent-fg" : "text-muted hover:text-fg"}`}
          >
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-md bg-accent" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative flex items-center gap-1.5">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  ticks,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
  ticks?: string[];
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range"
        style={{ "--fill": `${fill}%` } as React.CSSProperties}
      />
      {ticks && (
        <div className="mt-1 flex justify-between font-mono text-[10px] text-faint">
          {ticks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChipSelect({
  label,
  value,
  onChange,
  options,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <label className={`relative flex shrink-0 items-center ${className}`}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none rounded-lg border border-line bg-surface-2/70 pl-3 pr-8 text-sm hover:border-line-strong focus:border-accent focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-muted" />
    </label>
  );
}

const AR_BOX: Record<AspectRatio, [number, number]> = { "1:1": [10, 10], "16:9": [14, 8], "9:16": [8, 14], "4:3": [13, 10] };

export function AspectPicker<A extends AspectRatio>({ id, value, onChange, options }: { id: string; value: A; onChange: (ar: A) => void; options: A[] }) {
  return (
    <Segmented
      id={id}
      value={value}
      onChange={onChange}
      options={options.map((ar) => ({
        value: ar,
        label: (
          <>
            <span className="inline-block rounded-[2px] border-[1.5px] border-current" style={{ width: AR_BOX[ar][0], height: AR_BOX[ar][1] }} />
            {ar}
          </>
        ),
      }))}
    />
  );
}

/** Upload slot for a reference / keyframe: click, drop or paste an image. */
export function RefSlot({
  value,
  onChange,
  label,
  empty,
  className = "h-24",
  children,
}: {
  value: Reference | null;
  onChange: (ref: Reference | null) => void;
  label: string;
  empty?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const take = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Images only");
    setError(null);
    try {
      onChange({ src: await fileToReference(file), name: file.name });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="min-w-0">
      <div
        role="button"
        tabIndex={0}
        aria-label={value ? `${label}: ${value.name}` : `Add ${label}`}
        onClick={() => !value && input.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !value && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files[0]);
        }}
        className={`group relative overflow-hidden rounded-xl border ${
          value ? "border-line-strong" : `cursor-pointer border-dashed ${over ? "border-accent bg-accent/10" : "border-line-strong hover:border-accent/60"}`
        } ${className}`}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value.src} alt={value.name} className="size-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2 pb-1 pt-4 text-[11px]">{value.name}</div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              aria-label={`Remove ${label}`}
              className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition hover:bg-black/90 group-hover:opacity-100 max-sm:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </>
        ) : (
          <div className="grid size-full place-items-center p-2 text-center text-muted">
            {empty ?? (
              <div>
                <ImagePlus className="mx-auto size-5" />
                <div className="mt-1 text-[11px]">{label}</div>
              </div>
            )}
          </div>
        )}
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => (take(e.target.files?.[0]), (e.target.value = ""))} />
      </div>
      {children}
      {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

export function ModelBar({ mode, value, onChange }: { mode: Mode; value: string; onChange: (id: string) => void }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0" role="radiogroup" aria-label="Model">
      {modelsFor(mode).map((m) => {
        const active = m.id === value;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m.id)}
            className={`glass relative min-w-52 shrink-0 overflow-hidden rounded-xl p-3 text-left transition sm:min-w-0 ${active ? "glow-accent" : "hover:border-accent/40"}`}
          >
            {active && <motion.span layoutId={`model-glow-${mode}`} className="absolute inset-0 bg-gradient-to-br from-accent/15 via-transparent to-success/10" />}
            <div className="relative flex items-center justify-between">
              <span className={`text-sm font-semibold ${active ? "text-accent" : ""}`}>{m.name}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-faint">{m.speedLabel}</span>
            </div>
            <div className="relative mt-0.5 text-xs text-muted">{m.tagline}</div>
            <div className="relative mt-2 flex items-center gap-1 font-mono text-[11px] text-faint">
              <Gem className="size-3" />
              {mode === "image" ? `${m.cost}/image` : `${m.cost}/sec`}
            </div>
          </button>
        );
      })}
    </div>
  );
}
