# Takes — AI Image & Video Studio

A front-end MVP of an AI media-generation product with two specialized screens, **Image Studio** and **Video Studio**, sharing one iteration-first workflow. It's inspired by the Higgsfield create flow; generation is simulated locally.

**The idea:** every result is a *take* that keeps its complete, typed recipe. Any take can be inspected as JSON, tweaked and remixed in one click, sent across studios (a still becomes a video's start frame, a video frame becomes an image reference), and seen as a graph of how the prompts evolved.

## Run it locally

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:3000 (redirects to /image)
```

Production build: `npm run build && npm start`.

The first load includes a **Showcase** project: 12 seeded images and 9 seeded videos arranged in branching chains. All state is saved in localStorage. Use **Profile → Reset demo data** to start over.

## Screens

### Persistent header (both screens)
- Tabs **Image Studio | Video Studio**. They're real routes (`/image`, `/video`), and the active tab slides between them. Each tab shows a green badge counting its takes in progress.
- A **⌘K** button that jumps to the prompt.
- The **credit counter** in glowing aqua text, with a small activity wave.
- A **profile drawer** with the account, the credit meter (in flight / next cost), top-up, per-project stats, projects (switch or create) and a demo reset.

### Image Studio (`/image`)
- **Models:** Aurora-XL (photoreal), Prism-2 (stylized), Lumen-Turbo (fast drafts).
- **Controls:**
  - aspect ratio **1:1 / 16:9 / 9:16 / 4:3**;
  - resolution toggle **1080p / 4K** (4K doubles the cost);
  - image count 1–4 and a style preset;
  - **negative prompt** (collapsible);
  - **sampler** (DPM++ 2M Karras, Euler a, DDIM, UniPC), **steps** and **CFG** sliders;
  - **seed** input with re-roll and lock.
- **Style & control references:** three upload slots for image-to-image / ControlNet-style conditioning. Each slot has a control type (Style / Edges / Depth / Pose) and a weight slider, and costs +1 credit.
- **Feed:** a masonry grid of stills.
  - **Quick actions:**
    - **Upscale:** a 4K child take.
    - **Variations:** 4 distinct takes from the same source.
    - **Inpaint:** drag a mask over the image and describe the change.
    - **Download**.
  - Plus favorite and expand.

### Video Studio (`/video`)
- **Models:** Higgsfield-V2, Motion-Pro, Cinematic-AI.
- **Controls:**
  - **keyframe slots**: start frame and an optional end frame (+2 credits);
  - a **timeline** duration picker (**3s / 5s / 10s**) that also shows the frame count;
  - a **motion intensity** slider (subtle → dynamic);
  - **camera presets**: Static, Zoom, Pan, Tilt, Orbit;
  - **frame rate** 24 / 30 / 60 fps (×1 / ×1.2 / ×1.5 cost);
  - **motion vector model** (Vector-S / P / X);
  - seed with re-roll and lock.
- **Feed:** a dynamic grid of **hover-to-play** clips.
  - While a clip renders, its card shows the frame count, e.g. "frame 59/120".
  - **Extract frame** captures the frame currently playing, downloads it, and offers to set it as the start frame.
- **Parameter remix drawer:** click a card to open it. It includes a **frame extraction filmstrip** of 5 frames; each can become a start frame, an end frame, an Image Studio style reference, or a download.

### Shared
- **Remix drawer:** a live `recipe.json` with modified keys highlighted, plus mode-specific tweaks.
  - **Remix now / Remix with changes**, **Fork to composer**, **Exact** (same seed).
  - On images, **Animate** opens Video Studio with that still as the start frame.
- **Smart filter pills** with live counts; ✦ marks tags suggested from the current prompt and preset.
- **Graph view:** a pannable, zoomable lineage canvas. Edges are labelled by what changed: *Upscale, Variation, Inpaint, Animate, Reframe, Camera, FPS, Retime, Sampler…*
- **Full-screen viewer** with mode-specific recipe details and actions.
- **Prompt heatmap:** each word is shaded by how much it steers the result.

## Technical deliverables

### 1. Theme: CSS variable mapping (Tailwind v4)

The theme is defined in `src/app/globals.css`. The CSS variables are mapped to Tailwind colors with `@theme inline`, so `bg-accent`, `text-success`, `border-line` and so on work everywhere.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0B132B` | page background (with faint aqua and green glows) |
| `--surface` / `--surface-2` | `#0F172A` / `#16213D` | cards, inputs |
| `--line` / `--line-strong` | cyan-500 at 12% / 24% | borders |
| `--accent` / `--accent-strong` | `#00F5FF` / `#06B6D4` | primary actions, active states, glow borders |
| `--success` / `--success-bright` | `#10B981` / `#22C55E` | rendering progress, success badges, aqua-to-green gradients |
| `--fg` / `--muted` / `--faint` | slate 100 / 400 / 500 | text |

Utility classes in the same file:

| Class | What it is |
|---|---|
| `.glass` | the spec's panel: `slate-900/60`, `backdrop-blur-xl`, `cyan-500/20` border |
| `.glass-strong` | the same look, nearly opaque, for overlays |
| `.glow-accent` | aqua glow ring |
| `.btn-primary` | aqua-to-green gradient button |
| `.text-glow` | glowing credit counter |
| `.range` | the slider |

### 2. Routing between studios

App Router route group:

```
src/app/
  page.tsx                  redirect("/") -> /image
  (studio)/layout.tsx       <StudioShell>: header, drawer, remix dock, viewer, inpaint, toasts
  (studio)/image/page.tsx   <StudioScreen mode="image" composer={<ImageComposer/>} />
  (studio)/video/page.tsx   <StudioScreen mode="video" composer={<VideoComposer/>} />
```

- The shell reads the mode from `usePathname()`, so the header, dock and viewer stay mounted across tab switches.
- Each studio keeps its own draft (`drafts.image` and `drafts.video` in the store), so switching tabs never loses work.
- Actions that move across studios (Animate, "Send to Image Studio") write into the other studio's draft, then `router.push()` there.

### 3. Components and data

```
src/components/
  shell/    StudioShell (clock context, keyboard), Header (tabs, credits, profile), ProfileDrawer, Toast
  studio/   StudioScreen (shared layout), PromptBox, ImageComposer, VideoComposer
  feed/     Grid (masonry + media cards with per-mode actions), GraphView, FilterPills
  dock/     TweakDock (remix drawer + FrameStrip), InpaintDialog, Viewer
  ui/       controls (Segmented, Slider, ChipSelect, AspectPicker, RefSlot, ModelBar, Label), Energy
src/lib/
  types.ts    ImageRecipe | VideoRecipe (discriminated union), Generation, Output, Op
  seed.ts     ImageItem[] and VideoItem[] typed seed arrays, converted into takes
  catalog.ts  models per mode, samplers, presets, cameras, fps, motion models, cost rules
  mock.ts     simulated provider: timing, prompt-aware asset picking, variation looks, tags
  frames.ts   frame capture and filmstrip extraction (canvas)
  lineage.ts  graph layout and "what changed" edge labels
src/store/useStudio.ts  Zustand store saved to localStorage (takes, drafts, actions, UI state)
```

- **Status comes from time.** Queued, rendering and done are worked out from each take's `startAt`, `endAt` and the outputs' `readyAt`, so jobs still running when you reload pick up where they left off.
- **Believable mock outputs:**
  - Images come from 6 local photos in 4 aspect ratios, and videos from 18 short clips.
  - References keep their subject, prompt keywords rank the candidates, and the seed makes results reproducible.
  - Variations use deterministic crop, tint and mirror "looks", so four variations of one source look distinct.
- **Swapping in a real provider** means replacing `simulate()` in `src/lib/mock.ts` with an API call that returns the same fields.

## Not built (time-boxed)

- Sign-in, payments, a real credits backend, real AI providers, and a server or database.
- The mock can't "see" uploaded references or inpaint masks. Only references taken from existing results steer the output; inpainted takes show a subtle tint and their mask outline on hover.
- The seeded clips are 4 seconds long; the 3/5/10s setting is recorded in the recipe and badges but doesn't change clip length.
- No automated tests; shadcn/ui wasn't added (components are hand-built with Tailwind).

## Credits

- Photos: [Unsplash](https://unsplash.com) via [Lorem Picsum](https://picsum.photos) (ids 1015, 1025, 1043, 1062, 1069, 433), under the Unsplash License. The clips are slow pan-and-zoom renders of those photos, made with ffmpeg.
- The seeded authors, likes and model names are fictional demo data.

## AI agent logs

Built with Claude Code. Every prompt and final response is captured by project hooks to `.agent-logs/`; see [CAPTURE-TEST.md](CAPTURE-TEST.md).
