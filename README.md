# Takes — an AI image & video studio built around iteration

A front-end MVP of an AI image/video creation product, inspired by the Higgsfield create workflow (prompt composer, model and format settings, credits, a results feed that fills in as jobs finish). Generation is simulated locally.

The product idea that sets it apart: **iteration is a first-class workflow.** Every result is a *take* that stores its complete recipe, and every take can be turned into the next one in a single click.

| Action | What it does |
|---|---|
| **Use recipe** | Loads the take's exact prompt, model, format, style and **seed** back into the composer. Generating again reproduces the same result. |
| **Remix** | Uses the chosen result as the reference image, keeps the recipe, picks a new seed and focuses the prompt so you can change it. |
| **Vary** | Reruns the same recipe with a new seed, immediately. |
| **Animate** | Turns a still into a video: switches to Video mode with that image as the reference. |

Each take records which take it came from (*"From Take 3"*), and the composer shows what you are iterating on (*"Iterating on Take 3"*), so a project reads as a history of decisions rather than a pile of images.

## Run it locally

Requires Node 20+.

```bash
npm install
npm run dev
```

Open http://localhost:3000. For a production build: `npm run build && npm start`.

All data (projects, takes, credits, the composer draft) is saved in the browser's localStorage. To start over, clear site data for `localhost:3000`.

## What's in the MVP

- **Create workspace:** one screen with a sticky top bar, the takes feed, and a composer docked to the bottom.
- **Composer:**
  - Image / Video toggle and a prompt that grows as you type (⌘/Ctrl + Enter to generate).
  - Reference image upload: click, or paste an image into the prompt.
  - Model, aspect ratio (1:1, 16:9, 9:16), number of images (1–4) or video length (4s / 8s), and a style (image) or camera move (video).
- **Credits:** the cost is shown on the Generate button and deducted when you generate. You start with 200, and a demo *Top up* button appears when you run low. The button is disabled when you can't afford a take.
- **Simulated generation:** each take waits *In queue*, then shows *Generating* with a percentage and progress bar. Outputs appear one at a time, and each model has its own speed.
- **Results:** image and video tiles. Hover (or tap on mobile) for Remix / Animate / Download. Click to open the viewer.
- **Full-screen viewer:** the result shown large, prev/next with the arrow keys, Esc to close. A recipe panel shows prompt, model, format, style, seed, cost, reference and parent take, next to the iteration actions and Download.
- **Projects and history:** create and switch projects from the top bar. Each project's feed is its history, newest first, with take numbers, the recipe summary, cost and time.
- **Responsive:** works from phone width up. On small screens the composer's settings row scrolls sideways, tile actions are always visible, and the viewer stacks media over the recipe panel.

## How it works

```
src/
  app/            layout, global styles and design tokens, the single page
  components/     Studio (root), TopBar, Composer, Feed (take cards and tiles), Viewer
  store/          useStudio: Zustand store saved to localStorage, holding all actions
                  (submit, reuseRecipe, remix, vary, projects, credits)
  lib/            types, catalog (models, presets, cost rules), mock generator, image helpers
  hooks/          useNow: a clock that ticks only while jobs are running
public/mock/      curated mock images and clips
```

- **The recipe is data.** `Generation.recipe` is a plain object holding everything needed to reproduce a take. All iteration actions are small transforms of it: copy it, change the seed, or set the reference.
- **Status comes from time.** When you generate, the mock provider returns `startAt`, `endAt` and each output's `readyAt`. Queued, running and done are worked out from the current time, so there are no timers to keep in sync. Jobs still running when you reload pick up where they left off.
- **Believable mock outputs.** Results are picked from a small local set (6 photos, each available as an image and a 4-second clip in every aspect ratio):
  - a remix or animation keeps its reference's subject;
  - otherwise, prompt keywords rank the candidates (try "jellyfish", "pug", "mountain" or "bear");
  - the seed breaks ties, so the same recipe always gives the same result.
- **Swapping in a real provider** means replacing `simulate()` in `src/lib/mock.ts` with an API call that returns the same fields. The UI only reads the generation record.

## Deliberately not built (3-hour scope)

- Sign-in, payments, a real credits backend, or real AI providers.
- A server or database. Everything lives in the browser.
- A library view across projects, favorites, search and filters, retry/cancel, a visual lineage graph, a mobile bottom sheet for settings, and automated tests.
- Uploaded reference images are stored and shown in the recipe, but the mock can't "see" them. Only references taken from previous results steer the output.

## Credits

- Photos: [Unsplash](https://unsplash.com) via [Lorem Picsum](https://picsum.photos) (ids 1015, 1025, 1043, 1062, 1069, 433), under the Unsplash License.
- The clips are slow pan-and-zoom renders of those photos, made with ffmpeg.

## AI agent logs

This project was built with Claude Code. Every prompt and final response is captured by project hooks to `.agent-logs/`; see [CAPTURE-TEST.md](CAPTURE-TEST.md) for how capture works and how it was verified.
