"use client";

import { ArrowRight, Film, Maximize, Move, MoveVertical, Orbit, Square } from "lucide-react";
import { CAMERAS, DURATIONS, FPS_OPTIONS, MOTION_MODELS, VIDEO_ASPECTS } from "@/lib/catalog";
import { fileToReference } from "@/lib/image";
import type { Camera } from "@/lib/types";
import { useStudio } from "@/store/useStudio";
import { AspectPicker, ChipSelect, Label, ModelBar, RefSlot, Segmented, Slider } from "../ui/controls";
import { SeedField } from "./ImageComposer";
import { PromptBox } from "./PromptBox";

const CAMERA_ICON: Record<Camera, typeof Film> = { static: Square, zoom: Maximize, pan: Move, tilt: MoveVertical, orbit: Orbit };
const motionLabel = (m: number) => (m < 30 ? "Subtle" : m < 70 ? "Balanced" : "Dynamic");

/** Timeline-style duration picker: a frame ruler that snaps to the allowed clip lengths. */
function DurationTimeline({ value, fps, onChange }: { value: number; fps: number; onChange: (v: number) => void }) {
  const max = DURATIONS[DURATIONS.length - 1];
  return (
    <div>
      <Label hint={`${value}s · ${value * fps} frames`}>Duration</Label>
      <div className="relative h-12 overflow-hidden rounded-xl border border-line bg-surface-2/60">
        {/* second ticks */}
        {Array.from({ length: max + 1 }, (_, s) => (
          <span key={s} className="absolute bottom-0 w-px bg-line-strong" style={{ left: `${(s / max) * 100}%`, height: s % 5 === 0 ? 14 : 8 }} />
        ))}
        <div className="absolute inset-y-0 left-0 border-r-2 border-accent bg-gradient-to-r from-accent/25 to-success/20 transition-[width] duration-300" style={{ width: `${(value / max) * 100}%` }} />
        <div className="absolute inset-0 flex">
          {DURATIONS.map((dur, i) => {
            const prev = i === 0 ? 0 : DURATIONS[i - 1];
            return (
              <button
                key={dur}
                onClick={() => onChange(dur)}
                aria-pressed={value === dur}
                className={`relative h-full font-mono text-xs transition-colors ${value === dur ? "text-accent" : "text-muted hover:text-fg"}`}
                style={{ width: `${((dur - prev) / max) * 100}%` }}
              >
                <span className="absolute right-2 top-1.5">{dur}s</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function VideoComposer() {
  const d = useStudio((s) => s.drafts.video);
  const setDraft = useStudio((s) => s.setDraft);
  const setKeyframe = useStudio((s) => s.setKeyframe);
  const set = (p: Partial<typeof d>) => setDraft("video", p);

  return (
    <section className="space-y-3">
      <ModelBar mode="video" value={d.modelId} onChange={(modelId) => set({ modelId })} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
          <div className="glass rounded-2xl p-3 sm:p-4">
            <Label hint={d.endFrame ? "+2 credits for end frame" : undefined}>Keyframes</Label>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
              <RefSlot
                label="Start frame"
                value={d.startFrame}
                onChange={(ref) => setKeyframe("startFrame", ref)}
                className="aspect-video"
                empty={
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-accent">Start</div>
                    <div className="mt-1 text-[11px]">Drop, click, or send from Image Studio</div>
                  </div>
                }
              />
              <div className="flex flex-col items-center gap-1 text-faint">
                <ArrowRight className="size-5" />
                <span className="font-mono text-[10px]">{d.durationSec}s</span>
              </div>
              <RefSlot
                label="End frame"
                value={d.endFrame}
                onChange={(ref) => setKeyframe("endFrame", ref)}
                className="aspect-video"
                empty={
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-success">End · optional</div>
                    <div className="mt-1 text-[11px]">Where the shot should land</div>
                  </div>
                }
              />
            </div>
          </div>
          <PromptBox
            mode="video"
            onPasteImage={async (f) => setKeyframe("startFrame", { src: await fileToReference(f), name: f.name })}
            controls={
              <>
                <AspectPicker id="vid-ar" value={d.aspectRatio} onChange={(aspectRatio) => set({ aspectRatio })} options={VIDEO_ASPECTS} />
                <Segmented
                  id="vid-cam"
                  value={d.camera}
                  onChange={(camera) => set({ camera })}
                  options={CAMERAS.map((c) => {
                    const Icon = CAMERA_ICON[c.id];
                    return { value: c.id, title: c.name, label: <><Icon className="size-3.5" /><span className="hidden md:inline">{c.name}</span></> };
                  })}
                />
              </>
            }
          />
        </div>

        <aside className="glass space-y-4 rounded-2xl p-4" aria-label="Motion settings">
          <DurationTimeline value={d.durationSec} fps={d.fps} onChange={(durationSec) => set({ durationSec })} />
          <div>
            <Label hint={`${d.motion} · ${motionLabel(d.motion)}`}>Motion intensity</Label>
            <Slider label="Motion intensity" value={d.motion} min={0} max={100} onChange={(motion) => set({ motion })} ticks={["subtle", "balanced", "dynamic"]} />
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
            <div>
              <Label hint={d.fps === 60 ? "×1.5 cost" : d.fps === 30 ? "×1.2 cost" : undefined}>Frame rate</Label>
              <Segmented id="vid-fps" value={d.fps} onChange={(fps) => set({ fps })} options={FPS_OPTIONS.map((f) => ({ value: f, label: `${f}fps` }))} />
            </div>
            <div>
              <Label>Motion vector model</Label>
              <ChipSelect label="Motion vector model" value={d.motionModel} onChange={(motionModel) => set({ motionModel })} options={MOTION_MODELS.map((m) => ({ value: m.id, label: `${m.name} · ${m.tagline}` }))} className="w-full" />
            </div>
          </div>
          <SeedField mode="video" />
        </aside>
      </div>
    </section>
  );
}
