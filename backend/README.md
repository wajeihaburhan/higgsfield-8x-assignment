# Takes Studio API (FastAPI)

A single-file backend (`main.py`) for the Takes image/video studio. It provides:
- an async generation queue with a simulated three-stage AI pipeline;
- job polling;
- a feed filterable by image/video;
- parameter forking with lineage.

Storage is in memory (`JOBS_DB`, `GENERATIONS_DB`) and is seeded with 7 generations; everything resets on restart.

## Run

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- Interactive docs: http://localhost:8000/docs (ReDoc at `/redoc`).
- Alternative start command: `python main.py`.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `ASSET_BASE_URL` | `http://localhost:3000` | Base for media URLs. The Next.js app serves the mock assets under `/mock`. |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins. Credentials are enabled only with an explicit list. |
| `SIM_SPEED` | `1.0` | Multiplies simulated render time; for example, `0.2` for quick demos. |
| `SIM_FAILURE_RATE` | `0` | Probability (0–1) that a job fails while rendering. |
| `LOG_LEVEL` | `INFO` | Logging level. |
| `PORT` | `8000` | Port for `python main.py`. |

## Endpoints (`/api/v1`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Status, API and engine version, uptime, queue counts by status |
| GET | `/models?media_type=` | Model registry (3 image models, 3 video models) |
| GET | `/generations?media_type=image\|video&model=&tag=&limit=&offset=` | Feed, newest first |
| GET | `/generations/{id}` | One generation |
| POST | `/generate` | Queue a job → **202** `{job_id, poll_url, estimated_seconds, cost}` |
| GET | `/jobs/{job_id}` | Status, stage, progress %, ETA, message; includes `result` when completed |
| GET | `/jobs?status=` | Recent jobs |
| POST | `/fork` | Clone a generation's configuration with overrides, and return a lineage-tracked parameter tree |

### Pipeline

`POST /generate` stores the job as `queued` and schedules `run_generation_job` with FastAPI `BackgroundTasks`. The worker only awaits `asyncio.sleep`, so the event loop keeps serving requests while jobs run. In testing, polls answered in about 1–3 ms with four jobs running.

| Stage | Progress | Message detail |
|---|---|---|
| `queueing` | 0 → 25% | allocating GPU |
| `sampling` | 25 → 75% | `(steps n/N)` for images, `(frame n/N)` for video |
| `rendering` | 75 → 100% | `completed`; the asset is appended to `GENERATIONS_DB` |

- **Render time** depends on the model, steps, resolution and image count, or on duration and fps for video.
- **Failures** set `status: failed` with an `error` message.

### Validation (422 / 404)

- The model must exist and match `media_type`.
- `4:3` is image-only.
- Parameters must belong to the media type:
  - image only: `cfg_scale`, `steps`, `sampler`, `resolution`, `num_images`, `negative_prompt`;
  - video only: `duration_sec` (3/5/10), `fps` (24/30/60), `motion_score`, `camera`, `motion_model`, keyframe URLs.
- Ranges are enforced, unknown fields are rejected, blank prompts are rejected, and a `parent_id` must exist.

## Examples

```bash
# Queue a video job
curl -s -X POST localhost:8000/api/v1/generate -H 'Content-Type: application/json' -d '{
  "prompt": "A jellyfish drifting through deep blue water, neon glow",
  "media_type": "video", "model": "motion-pro", "aspect_ratio": "9:16",
  "parameters": {"duration_sec": 5, "fps": 30, "motion_score": 65, "camera": "zoom"}
}'

# Poll it
curl -s localhost:8000/api/v1/jobs/<job_id>

# Image-only feed
curl -s 'localhost:8000/api/v1/generations?media_type=image'

# Fork an image with a new prompt, CFG and seed; submit it straight away
curl -s -X POST localhost:8000/api/v1/fork -H 'Content-Type: application/json' -d '{
  "parent_id": "gen_fjord_4k", "new_prompt": "Aerial view of a fjord at dusk, cinematic",
  "cfg_scale": 9, "seed": 42, "submit": true
}'
```

**What a fork returns:**
- `forked_from` and `lineage`, the ancestor ids from root to parent;
- `changed_fields` and `diff`, as `{field: {from, to}}`;
- the merged `parameter_tree`;
- `request`, a `GenerationRequest` you can POST to `/generate` as-is;
- `job`, when `submit: true` was set.

## Production notes

This is a demo backend. Before real use, it would need:
- a durable store (Postgres) and a real queue (Redis with Celery or arq, or a managed queue), because `BackgroundTasks` work is lost on restart and isn't shared across workers;
- authentication, rate limits and credit accounting;
- object storage for assets.

The Pydantic schemas and endpoint contracts are written to survive that swap.
