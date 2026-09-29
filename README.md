# Takes — an AI video & image studio built around iteration

A front-end MVP of an AI video/image generation dashboard, inspired by the Higgsfield create workflow and extended with its own way of iterating. Generation is simulated locally.

**The idea:** every result is a *take* that stores its complete recipe (prompt, model, format, preset, seed, reference). Any take can be inspected as JSON, tweaked and remixed in one click, and the project can be viewed as a graph of how the prompts evolved.

## Run it locally

Requires Node 20+.

```bash
npm install
npm run dev
```

Open http://localhost:3000. For a production build: `npm run build && npm start`.

The first load includes a **Showcase** project with 14 seeded takes arranged in branching chains. Everything you do (new takes, favorites, projects, credits) is saved in localStorage. Clear site data for `localhost:3000` to reset.

## Tour

### Layout
- **Floating command sidebar:** a glass panel you can collapse to an icon rail. It holds:
  - Models, Projects (switch or create) and Style/Camera presets;
  - a **⌘K** shortcut that jumps to the prompt;
  - the live credit meter.
  - On mobile it becomes a slide-in drawer behind the menu button.
- **Hero:** a model selector bar (Higgsfield-V2 / Motion-Pro / Cinematic-AI, with speed and cost per unit), then the quick generation bar. The bar has Video/Image, the prompt, reference upload (click or paste), aspect ratio, video length or image count, preset, and a Generate button showing the cost.
- **Toolbar:** smart filter pills plus a **Grid / Graph** view toggle. It stays pinned while you scroll.

### Grid view (masonry)
- Cards are placed into the shortest column (1–4 columns depending on width), and Framer Motion animates them when filters reorder the grid.
- Video cards **play on hover** and reset when the pointer leaves.
- **Hover actions:**
  - **Reuse Prompt:** copies the prompt into the composer.
  - **Fork Parameters:** loads the full recipe with a new seed as a new branch.
  - **Download**, and **Expand** (full-screen viewer).
  - **Favorite:** the heart in the corner.
- **Badges:** aspect ratio, clip length, model, ⚡ generation time, and tags, plus the author, likes and age.
- **New takes** appear right away as *In queue*, then *Rendering* with a live percentage, and are replaced by the result when it's ready.

### Unique features
1. **Graph view:** a pannable, zoomable canvas (drag to pan, scroll to zoom, fit button).
   - Each column is one generation step, and each edge is labelled with what changed: *Animate*, *Remix*, *Vary*, *Reframe*, *Model*, *Style*, *Prompt*, *Fork* or *Rerun*.
   - Solid edges mean video, dashed mean image. Takes that don't match the active filters are dimmed, not hidden, so the tree stays intact.
2. **Quick-tweak dock:** click any card or graph node to pin a drawer at the bottom.
   - It shows the take's exact **`recipe.json`**, with changed keys highlighted as you tweak.
   - The tweaks are prompt, Video/Image, aspect ratio, model, preset, length and a seed re-roll.
   - **Remix now** / **Remix with changes** submits it as a child of that take. Also available: *Use as reference*, *To composer*, *Exact recipe*, copy JSON, favorite, download and expand.
3. **Live prompt heatmap and credit meter:**
   - **Heatmap:** as you type, each word of the prompt is shaded by how much it steers the result (style and camera words hottest, then subject words, then detail; filler words are dimmed), with an overall *strength* score.
   - **Credit meter:** the sidebar's audio-style wave speeds up while jobs render. Its usage bar shows credits committed to running jobs and what the next generation will cost.
4. **Smart filter pills:** a scrollable row of tags built from the feed and sorted by count.
   - Selecting pills narrows the feed; a take must have every selected tag.
   - Counts update live, and pills that would empty the feed disappear.
   - Pills marked with ✦ are **suggested** from what you're typing and the preset you picked.

### Iteration actions (anywhere)
| Action | Result |
|---|---|
| Reuse Prompt | The prompt only, into the composer |
| Fork Parameters / To composer | The full recipe with a new seed, linked as a branch of that take |
| Exact recipe | Everything including the seed, so it reproduces the same result |
| Use as reference / Remix | That result becomes the reference image; the subject carries over |
| Animate (Video toggle in the dock) | A still turned into a video of the same subject |
| Remix now | Submits straight from the dock |

## How it's built

- **Stack:** Next.js 16 (App Router) + TypeScript, Tailwind CSS v4, Framer Motion, lucide-react, and Zustand (saved to localStorage) for app and UI state. The brief asked for Next 14; the App Router code is the same on 16.

```
src/
  app/            layout, theme tokens (dark #09090B, lime #C8FF00, glass), the page
  components/
    Studio        page shell: sidebar or drawer, hero, toolbar, grid or graph, dock, viewer
    Sidebar       floating collapsible command bar
    Composer      model bar and quick generation bar
    Energy        energy wave, credit meter, prompt heatmap
    FilterPills   smart tag filters
    Grid          masonry layout and media cards (hover to play, actions, badges)
    GraphView     lineage canvas (pan, zoom, labelled edges)
    TweakDock     recipe.json inspector and quick-tweak remix
    Viewer        full-screen viewer
  store/          useStudio: takes, projects, credits, draft, selection, filters, view
  lib/
    seed.ts       VideoItem schema (from the brief) and 14 seed items, converted to takes
    mock.ts       simulated provider: timing, prompt-aware asset picking, tags and titles
    lineage.ts    tree layout and "what changed" edge labels
    catalog.ts    models, presets (which double as tags), cost rules
public/mock/      6 photos, each as an image and a 4s clip in 1:1, 16:9 and 9:16
```

- **Status comes from time.** The mock returns `startAt`, `endAt` and each output's `readyAt`. Queued, rendering and done are worked out from the clock, so jobs still running when you reload pick up where they left off.
- **Mock outputs are chosen, not random.** A remix or animation keeps its reference's subject, prompt keywords rank the rest (try "jellyfish", "pug", "mountain" or "bear"), and the seed breaks ties. The same recipe always gives the same result.
- **Swapping in a real provider** means replacing `simulate()` in `src/lib/mock.ts` with an API call that returns the same fields.

## Not built (time-boxed)

- Sign-in, payments, a real credits backend, real AI providers, and a server or database.
- Uploaded reference images are stored and shown, but the mock can't "see" them. Only references taken from existing results steer the output.
- No automated tests.
- shadcn/ui wasn't added; the components are hand-built with Tailwind to save time.

## Credits

- Photos: [Unsplash](https://unsplash.com) via [Lorem Picsum](https://picsum.photos) (ids 1015, 1025, 1043, 1062, 1069, 433), under the Unsplash License. The clips are slow pan-and-zoom renders of those photos, made with ffmpeg.
- The seeded authors, likes and model names are fictional demo data.

## AI agent logs

Built with Claude Code. Every prompt and final response is captured by project hooks to `.agent-logs/`; see [CAPTURE-TEST.md](CAPTURE-TEST.md).
