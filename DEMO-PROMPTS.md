# Demo prompts

Generation in Takes is simulated. Each result is picked from a local library of **18 subjects**; every subject exists as a still in 1:1, 16:9, 9:16 and 4:3, and as a 4-second clip in 1:1, 16:9 and 9:16. The mock ranks subjects by keywords in your prompt.

Every prompt below was checked to land on its subject whatever the seed. Paste one into **Image Studio** or **Video Studio** and press **Generate** (⌘/Ctrl + Enter). The first six in each studio are also one-click chips under the prompt box.

## Image Studio

| # | Prompt | You get | Suggested settings |
|---|---|---|---|
| 1 | Neon-lit city street at night, rain reflections, cyberpunk, cinematic | Neon city | 16:9 · Aurora-XL · style *Cyberpunk* · CFG 8.5 |
| 2 | Latte art in a ceramic cup on a wooden cafe table, soft morning light | Latte | 4:3 · Prism-2 · style *Studio product* |
| 3 | Leopard on a dusty safari trail, wildlife photography, telephoto | Leopard | 16:9 · Aurora-XL · 4K · steps 40 |
| 4 | Portrait of a woman in a wheat field at golden hour, backlit hair | Golden-hour portrait | 9:16 · Aurora-XL · style *35mm film grain* |
| 5 | Macro shot of purple petunia flowers, dew on the petals | Petunia macro | 1:1 · Prism-2 · ×4 images |
| 6 | Vintage 1930s car parked on a city street, chrome details, film grain | Vintage car (a second image adds the street) | 4:3 · Lumen-Turbo · ×2 |
| 7 | Aerial view of a Norwegian fjord at sunrise, volumetric light | Fjord | 16:9 · Aurora-XL · style *Cinematic lighting* |
| 8 | Close portrait of a grizzly bear, cinematic rim lighting | Grizzly | 4:3 · Aurora-XL |
| 9 | Pug wrapped in a wool blanket on a forest trail, 35mm film | Pug on a forest trail | 1:1 · Prism-2 |
| 10 | Quiet brick street in downtown at morning, empty road, architecture photography | City street | 9:16 · Aurora-XL |
| 11 | Snowy alpine peaks and glaciers under a clear winter sky | Snowy peaks | 16:9 · 4K |
| 12 | Black labrador puppy on a wooden floor, big eyes, studio portrait | Black puppy | 1:1 · style *Studio product* |

## Video Studio

| # | Prompt | You get | Suggested settings |
|---|---|---|---|
| 1 | Hot air balloon rising into a clear sky, slow drift | Hot-air balloon | 9:16 · Motion-Pro · Zoom · motion 35 |
| 2 | Concert crowd with hands up under stage lights, energetic | Concert crowd | 16:9 · Cinematic-AI · Pan · 60 fps · motion 85 |
| 3 | Waterfall cascading through a mossy gorge, mist in the air | Waterfall | 9:16 · 10s · Zoom |
| 4 | Slow camera pan across snowy alpine peaks above the clouds | Snowy peaks | 16:9 · Cinematic-AI · Pan · motion 30 |
| 5 | Black labrador puppy looking up at the camera, gentle handheld | Black puppy | 1:1 · 3s · motion 20 |
| 6 | A jellyfish drifting through deep blue water, neon glow | Jellyfish | 9:16 · Vector-X · 60 fps |
| 7 | Slow push down a neon city street at night, billboards glowing | Neon city | 16:9 · Zoom · 30 fps |
| 8 | Leopard walking toward camera on a safari trail, slow motion | Leopard | 16:9 · motion 40 |
| 9 | Golden hour breeze through a wheat field, woman's hair backlit | Golden-hour portrait | 9:16 · Motion-Pro |
| 10 | Steam rising from a latte on a cafe table, slow dolly in | Latte | 1:1 · Zoom · motion 25 |
| 11 | Slow orbit around a granite valley and river at golden hour | Granite valley | 16:9 · Orbit · 10s |
| 12 | Pug breathing softly under a blanket on a bed, cozy | Pug on a bed | 9:16 · 3s · motion 15 |

**Why these words work:** the subject words carry the match (for example *leopard*, *safari*, *balloon*, *concert*, *petunia*, *latte*). Style and camera words (*cinematic*, *neon*, *golden hour*, *pan*, *dolly*) light up the prompt heatmap and add feed tags, but don't change the subject.

## Three-minute demo script

1. **Showcase:** open http://localhost:3000. Point out the stats, the images-then-videos layout, hover-to-play and the filter pills (try **Night** or **Wildlife**).
2. **Image Studio:** click the chip *Neon-lit city street…*.
   - Watch the heatmap light up, set **16:9**, then **Generate**.
   - The card goes through *In queue* and *Rendering nn%* before the result appears.
3. **Iterate on the result:**
   - **Variations** gives 4 distinct takes.
   - **Upscale** gives a 4K child with a green 4K badge.
   - **Inpaint:** drag over the street and type *a red umbrella*.
4. **Remix drawer:** click the card to see the live `recipe.json`. Change **CFG** and the aspect ratio (changed keys highlight), then **Remix with changes**.
5. **Animate:** in the drawer, press **Animate**. Video Studio opens with the still as the **start frame**.
   - Pick **Pan**, **5s** and **30 fps**, then **Generate**.
   - The card shows "frame n/150" while it renders.
6. **Extract a frame:** hover the finished clip, press **Extract frame**, then choose **Use as start frame** in the toast.
   - Or open the drawer's filmstrip and send a frame to Image Studio as a style reference.
7. **Graph view:** toggle **Graph** to see the branch you just built: *Variation → Upscale → Inpaint → Animate*.

## Same prompts against the API

With the FastAPI backend running (`cd backend && uvicorn main:app --reload --port 8000`):

```bash
curl -s -X POST localhost:8000/api/v1/generate -H 'Content-Type: application/json' -d '{
  "prompt": "Concert crowd with hands up under stage lights, energetic",
  "media_type": "video", "model": "cinematic-ai", "aspect_ratio": "16:9",
  "parameters": {"duration_sec": 5, "fps": 60, "motion_score": 85, "camera": "pan"}
}'
```

The finished job's `asset_urls` point at the same `/mock` files the frontend serves.

## Asset credits

The photos are from [Unsplash](https://unsplash.com) via [Lorem Picsum](https://picsum.photos), under the Unsplash License. Picsum IDs:

| Subject | ID | Subject | ID | Subject | ID |
|---|---|---|---|---|---|
| fjord | 1015 | pug (forest) | 1025 | jellyfish | 1069 |
| granite valley | 1043 | pug (bed) | 1062 | grizzly | 433 |
| waterfall | 15 | city street | 57 | neon city | 274 |
| vintage car | 111 | leopard | 219 | black puppy | 237 |
| latte | 431 | hot-air balloon | 401 | concert | 452 |
| golden-hour portrait | 65 | petunia | 152 | snowy peaks | 29 |

The clips are slow zoom and pan renders of those photos, made with ffmpeg.
