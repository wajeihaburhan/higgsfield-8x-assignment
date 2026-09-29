"""
VEYRA Studio API: a single-file FastAPI backend for the VEYRA image/video generation platform.
(Imagine. Generate. Evolve.)

What it does
------------
* Accepts image and video generation requests, validates them against a model registry,
  and queues them as jobs.
* Runs each job in a non-blocking background worker that simulates a three-stage AI pipeline
  (queueing -> sampling/diffusion -> rendering & storage) with live progress.
* Exposes job polling, a filterable generation feed, and a fork/remix endpoint that clones
  a generation's parameters, applies overrides, and tracks lineage.

Storage is in memory (JOBS_DB, GENERATIONS_DB) so the server runs with zero setup;
everything resets on restart. Media URLs point at the mock assets served by the
Next.js frontend (public/mock), configurable with ASSET_BASE_URL.

Run
---
    cd backend
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

Interactive docs: http://localhost:8000/docs
"""

from __future__ import annotations

import asyncio
import logging
import os
import random
import re
import time
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Any, Literal

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator

# --------------------------------------------------------------------------------------
# Configuration (environment variables with safe defaults)
# --------------------------------------------------------------------------------------

API_VERSION = "1.0.0"
ENGINE_VERSION = "veyra-diffusion-sim/2.3.0"
API_PREFIX = "/api/v1"

# Base URL for mock media. The frontend serves /mock/img and /mock/vid from public/.
ASSET_BASE_URL = os.getenv("ASSET_BASE_URL", "http://localhost:3000").rstrip("/")
# Comma-separated list of allowed origins; "*" allows any origin (credentials are then disabled).
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
# Multiplies simulated render times (e.g. 0.1 for fast demos/tests, 2 for slower ones).
SIM_SPEED = float(os.getenv("SIM_SPEED", "1.0"))
# Probability (0..1) that a job fails during rendering, to exercise error handling in clients.
SIM_FAILURE_RATE = float(os.getenv("SIM_FAILURE_RATE", "0"))
# How often the worker publishes progress, in seconds (tests lower it together with SIM_SPEED).
TICK_SECONDS = float(os.getenv("SIM_TICK_SECONDS", "0.25"))

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("veyra.api")

STARTED_AT = time.monotonic()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------------------
# Domain enums and registry
# --------------------------------------------------------------------------------------


class MediaType(str, Enum):
    image = "image"
    video = "video"


class AspectRatio(str, Enum):
    square = "1:1"
    landscape = "16:9"
    portrait = "9:16"
    classic = "4:3"  # image only


class JobStatus(str, Enum):
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class JobStage(str, Enum):
    queueing = "queueing"
    sampling = "sampling"
    rendering = "rendering"
    done = "done"


class ModelSpec(BaseModel):
    id: str
    name: str
    media_type: MediaType
    tagline: str
    cost_per_unit: int = Field(description="Credits per image, or per second of video.")
    base_seconds: float = Field(description="Typical render time before settings multipliers.")


MODEL_REGISTRY: dict[str, ModelSpec] = {
    m.id: m
    for m in [
        ModelSpec(id="aurora-xl", name="Aurora-XL", media_type=MediaType.image, tagline="Photoreal detail", cost_per_unit=3, base_seconds=6),
        ModelSpec(id="prism-2", name="Prism-2", media_type=MediaType.image, tagline="Stylized & illustrative", cost_per_unit=2, base_seconds=4.5),
        ModelSpec(id="lumen-turbo", name="Lumen-Turbo", media_type=MediaType.image, tagline="Instant drafts", cost_per_unit=1, base_seconds=2.5),
        ModelSpec(id="higgsfield-v2", name="Higgsfield-V2", media_type=MediaType.video, tagline="Balanced all-rounder", cost_per_unit=3, base_seconds=8),
        ModelSpec(id="motion-pro", name="Motion-Pro", media_type=MediaType.video, tagline="Physics-true motion", cost_per_unit=4, base_seconds=10),
        ModelSpec(id="cinematic-ai", name="Cinematic-AI", media_type=MediaType.video, tagline="Film-grade light & color", cost_per_unit=5, base_seconds=12),
    ]
}

Sampler = Literal["dpmpp-2m-karras", "euler-a", "ddim", "unipc"]
Resolution = Literal["1080p", "4K"]
Camera = Literal["static", "zoom", "pan", "tilt", "orbit"]
MotionModel = Literal["vector-s", "vector-p", "vector-x"]
Duration = Literal[3, 5, 10]
Fps = Literal[24, 30, 60]

# Parameter names that only make sense for one media type.
IMAGE_ONLY_PARAMS = {"negative_prompt", "cfg_scale", "steps", "sampler", "resolution", "num_images"}
VIDEO_ONLY_PARAMS = {"duration_sec", "fps", "motion_score", "camera", "motion_model", "start_frame_url", "end_frame_url"}

# Defaults filled in when a request omits a parameter.
IMAGE_DEFAULTS: dict[str, Any] = {
    "negative_prompt": "blurry, low detail, watermark, extra limbs",
    "cfg_scale": 7.0,
    "steps": 30,
    "sampler": "dpmpp-2m-karras",
    "resolution": "1080p",
    "num_images": 1,
}
VIDEO_DEFAULTS: dict[str, Any] = {
    "duration_sec": 5,
    "fps": 24,
    "motion_score": 50,
    "camera": "static",
    "motion_model": "vector-s",
    "start_frame_url": None,
    "end_frame_url": None,
}

# --------------------------------------------------------------------------------------
# Pydantic schemas
# --------------------------------------------------------------------------------------


class GenerationParameters(BaseModel):
    """Optional model configuration. Unset fields fall back to per-media-type defaults."""

    model_config = ConfigDict(extra="forbid")

    seed: Annotated[int, Field(ge=0, le=2_147_483_647)] | None = Field(None, description="Omit for a random seed.")
    # Image
    negative_prompt: Annotated[str, Field(max_length=1000)] | None = None
    cfg_scale: Annotated[float, Field(ge=1, le=15)] | None = Field(None, description="Classifier-free guidance scale (image).")
    steps: Annotated[int, Field(ge=10, le=60)] | None = None
    sampler: Sampler | None = None
    resolution: Resolution | None = None
    num_images: Annotated[int, Field(ge=1, le=4)] | None = None
    # Video
    duration_sec: Duration | None = None
    fps: Fps | None = None
    motion_score: Annotated[int, Field(ge=0, le=100)] | None = Field(None, description="Motion intensity (video).")
    camera: Camera | None = None
    motion_model: MotionModel | None = None
    start_frame_url: Annotated[str, Field(max_length=2048)] | None = None
    end_frame_url: Annotated[str, Field(max_length=2048)] | None = None

    def set_fields(self) -> dict[str, Any]:
        """Only the fields the caller actually provided; an explicit null means "use the default"."""
        return self.model_dump(exclude_unset=True, exclude_none=True)


def check_params_for_media(media_type: MediaType, params: dict[str, Any]) -> None:
    """Rejects parameters that belong to the other media type."""
    wrong = (VIDEO_ONLY_PARAMS if media_type == MediaType.image else IMAGE_ONLY_PARAMS) & {k for k, v in params.items() if v is not None}
    if wrong:
        raise ValueError(f"{', '.join(sorted(wrong))} not supported for {media_type.value} generation")


class GenerationRequest(BaseModel):
    """Payload for POST /generate."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {"prompt": "Aerial view of a Norwegian fjord at sunrise, volumetric light", "media_type": "image", "model": "aurora-xl", "aspect_ratio": "16:9", "parameters": {"cfg_scale": 7.5, "steps": 32, "num_images": 2}},
                {"prompt": "A jellyfish drifting through deep blue water, neon glow", "media_type": "video", "model": "motion-pro", "aspect_ratio": "9:16", "parameters": {"duration_sec": 5, "fps": 30, "motion_score": 65, "camera": "zoom"}},
            ]
        },
    )

    prompt: Annotated[str, Field(min_length=1, max_length=2000)]
    media_type: MediaType
    model: str = Field(description="Model id from GET /models, e.g. 'aurora-xl' or 'motion-pro'.")
    aspect_ratio: AspectRatio = AspectRatio.landscape
    parameters: GenerationParameters = Field(default_factory=GenerationParameters)
    parent_id: str | None = Field(None, description="Generation this request was derived from (lineage).")

    @field_validator("prompt")
    @classmethod
    def strip_prompt(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("prompt must not be blank")
        return v

    @field_serializer("parameters")
    def serialize_parameters(self, parameters: GenerationParameters) -> dict[str, Any]:
        # Omit unset/other-media fields so a serialized request can be POSTed back to /generate unchanged.
        return parameters.model_dump(exclude_none=True)

    @model_validator(mode="after")
    def check_compatibility(self) -> "GenerationRequest":
        spec = MODEL_REGISTRY.get(self.model)
        if spec is None:
            raise ValueError(f"unknown model '{self.model}'; choose one of {sorted(MODEL_REGISTRY)}")
        if spec.media_type != self.media_type:
            raise ValueError(f"model '{self.model}' generates {spec.media_type.value}, not {self.media_type.value}")
        if self.media_type == MediaType.video and self.aspect_ratio == AspectRatio.classic:
            raise ValueError("aspect_ratio 4:3 is only available for images")
        check_params_for_media(self.media_type, self.parameters.set_fields())
        return self


class ForkRequest(BaseModel):
    """Payload for POST /fork: clone a generation's configuration and override some of it."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={"examples": [{"parent_id": "gen_fjord", "new_prompt": "Aerial view of a fjord at dusk, cinematic", "cfg_scale": 9, "seed": 42}]},
    )

    parent_id: str = Field(description="Generation (media card) id to clone.")
    new_prompt: Annotated[str, Field(min_length=1, max_length=2000)] | None = None
    cfg_scale: Annotated[float, Field(ge=1, le=15)] | None = Field(None, description="Image forks only.")
    seed: Annotated[int, Field(ge=0, le=2_147_483_647)] | None = None
    motion_score: Annotated[int, Field(ge=0, le=100)] | None = Field(None, description="Video forks only.")
    reroll_seed: bool = Field(False, description="Pick a fresh random seed (ignored when 'seed' is given).")
    model: str | None = Field(None, description="Switch to another model of the same media type.")
    aspect_ratio: AspectRatio | None = None
    parameters: GenerationParameters | None = Field(None, description="Any other parameter overrides.")
    submit: bool = Field(False, description="Also queue the forked request as a new generation job.")

    @field_validator("new_prompt")
    @classmethod
    def strip_prompt(cls, v: str | None) -> str | None:
        return v.strip() if v is not None else v


class Generation(BaseModel):
    """A finished media asset in the feed."""

    id: str
    media_type: MediaType
    title: str
    prompt: str
    model: str
    model_name: str
    aspect_ratio: AspectRatio
    duration: str | None = Field(None, description="Clip length as m:ss for video; null for images.")
    parameters: dict[str, Any] = Field(description="Fully resolved parameters used for this asset.")
    asset_urls: list[str]
    thumbnail_url: str
    tags: list[str]
    cost: int
    forked_from: str | None = None
    job_id: str | None = None
    render_seconds: float | None = None
    created_at: datetime


class FeedResponse(BaseModel):
    items: list[Generation]
    total: int
    limit: int
    offset: int
    media_type: MediaType | None


class GenerateResponse(BaseModel):
    job_id: str
    status: JobStatus
    poll_url: str
    estimated_seconds: float
    cost: int


class JobResponse(BaseModel):
    """Progress of one generation job."""

    job_id: str
    status: JobStatus
    stage: JobStage
    progress: Annotated[int, Field(ge=0, le=100)]
    message: str
    media_type: MediaType
    model: str
    eta_seconds: float | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
    generation_id: str | None = None
    result: Generation | None = None
    error: str | None = None
    poll_url: str


class ForkResponse(BaseModel):
    fork_id: str
    forked_from: str
    lineage: list[str] = Field(description="Ancestor generation ids, root first, ending with the parent.")
    media_type: MediaType
    changed_fields: list[str]
    diff: dict[str, dict[str, Any]] = Field(description="field -> {from, to} for every overridden value.")
    parameter_tree: dict[str, Any] = Field(description="The parent's full configuration with overrides applied.")
    request: GenerationRequest = Field(description="Ready to POST to /generate as-is.")
    job: GenerateResponse | None = Field(None, description="Present when submit=true.")


class HealthResponse(BaseModel):
    status: Literal["online"]
    api_version: str
    engine_version: str
    uptime_seconds: float
    queue: dict[str, int]
    generations: int
    time: datetime


# --------------------------------------------------------------------------------------
# In-memory data stores
# --------------------------------------------------------------------------------------

JOBS_DB: dict[str, dict[str, Any]] = {}
GENERATIONS_DB: dict[str, Generation] = {}

# --------------------------------------------------------------------------------------
# Mock media library: pick relevant assets for a prompt, deterministically per seed
# --------------------------------------------------------------------------------------

ASSET_TAGS: dict[str, set[str]] = {
    "1015": {"fjord", "mountain", "ridge", "cliff", "hiker", "landscape", "lake", "water", "dawn", "sky", "aerial", "norway"},
    "1025": {"pug", "dog", "puppy", "pet", "blanket", "wool", "forest", "cozy", "cute"},
    "1069": {"jellyfish", "ocean", "sea", "underwater", "water", "blue", "glow", "glowing", "macro", "neon"},
    "1043": {"mountain", "forest", "river", "valley", "trees", "landscape", "nature", "yosemite", "misty", "granite"},
    "1062": {"pug", "dog", "pet", "blanket", "bed", "window", "cozy", "portrait", "soft", "cute"},
    "433": {"bear", "animal", "wildlife", "portrait", "fur", "wild", "grizzly", "close"},
    "15": {"waterfall", "falls", "river", "stream", "rocks", "gorge", "canyon", "nature", "mist", "cascade"},
    "57": {"city", "street", "urban", "buildings", "downtown", "brick", "road", "alley", "architecture", "morning"},
    "274": {"city", "night", "neon", "times", "square", "lights", "billboards", "cyberpunk", "nightlife", "signs"},
    "111": {"car", "vintage", "classic", "retro", "automobile", "hotrod", "chrome", "oldtimer", "vehicle"},
    "219": {"leopard", "cheetah", "cat", "safari", "wildlife", "savanna", "jungle", "predator", "africa", "spotted"},
    "237": {"puppy", "dog", "labrador", "black", "pet", "cute", "wooden", "floor", "eyes"},
    "431": {"coffee", "latte", "cafe", "espresso", "cup", "barista", "foam", "art", "breakfast", "food"},
    "401": {"balloon", "hot", "air", "sky", "flight", "adventure", "travel", "colorful", "float", "rise"},
    "452": {"concert", "crowd", "music", "stage", "festival", "lights", "party", "fans", "rave", "live"},
    "65": {"woman", "girl", "golden", "hour", "sunset", "field", "hair", "backlit", "wheat", "summer"},
    "152": {"flower", "flowers", "petunia", "petals", "purple", "violet", "bloom", "garden", "botanical", "spring"},
    "29": {"snow", "snowy", "peaks", "alpine", "alps", "himalaya", "glacier", "mountains", "winter", "summit"},
}
SUBJECT_TAGS: dict[str, list[str]] = {
    "1015": ["Landscape", "Aerial"],
    "1025": ["Animals", "Portrait"],
    "1069": ["Underwater", "Macro"],
    "1043": ["Landscape", "Nature"],
    "1062": ["Animals", "Cozy"],
    "433": ["Wildlife", "Portrait"],
    "15": ["Nature", "Waterfall"],
    "57": ["Urban", "Architecture"],
    "274": ["Urban", "Night"],
    "111": ["Vehicles", "Retro"],
    "219": ["Wildlife", "Safari"],
    "237": ["Animals", "Pets"],
    "431": ["Food", "Coffee"],
    "401": ["Travel", "Sky"],
    "452": ["Music", "Crowd"],
    "65": ["Portrait", "Golden Hour"],
    "152": ["Macro", "Flowers"],
    "29": ["Landscape", "Snow"],
}
STYLE_TAGS = [(r"\b(cinematic|volumetric|anamorphic|rim)\b", "Cinematic Lighting"), (r"\b(neon|cyberpunk)\b", "Cyberpunk"), (r"\b(film|35mm|grain)\b", "Film Grain")]
CAMERA_TAGS = {"zoom": "Zoom", "pan": "Camera Pan", "tilt": "Tilt", "orbit": "Orbit"}
STOP_WORDS = {"a", "an", "the", "of", "in", "on", "at", "with", "and", "shot", "view", "through", "around"}


def asset_url(key: str, media_type: MediaType, aspect_ratio: AspectRatio) -> str:
    slug = aspect_ratio.value.replace(":", "x")
    folder, ext = ("img", "jpg") if media_type == MediaType.image else ("vid", "mp4")
    return f"{ASSET_BASE_URL}/mock/{folder}/{key}-{slug}.{ext}"


def pick_assets(prompt: str, seed: int, count: int) -> list[str]:
    """Ranks assets by prompt keyword overlap; the seed breaks ties so results are reproducible."""
    words = set(re.findall(r"[a-z]+", prompt.lower()))
    rng = random.Random(seed)
    ranked = sorted(ASSET_TAGS, key=lambda k: (-len(ASSET_TAGS[k] & words), rng.random()))
    return [ranked[i % len(ranked)] for i in range(count)]


def derive_tags(req: GenerationRequest, params: dict[str, Any], first_key: str) -> list[str]:
    prompt = req.prompt.lower()
    tags = [t for pattern, t in STYLE_TAGS if re.search(pattern, prompt)] + SUBJECT_TAGS.get(first_key, [])
    if req.media_type == MediaType.image:
        tags += ["4K"] if params["resolution"] == "4K" else []
    else:
        tags += [CAMERA_TAGS[params["camera"]]] if params["camera"] in CAMERA_TAGS else []
        tags += ["High Motion"] if params["motion_score"] >= 70 else []
        tags += ["60fps"] if params["fps"] == 60 else []
    return list(dict.fromkeys(tags))[:4]


def title_from(prompt: str) -> str:
    words = [w for w in re.sub(r"[^\w\s'-]", " ", prompt).split() if w.lower() not in STOP_WORDS]
    return " ".join(w.capitalize() for w in words[:3]) or "Untitled"


# --------------------------------------------------------------------------------------
# Business logic helpers
# --------------------------------------------------------------------------------------


def resolve_parameters(req: GenerationRequest) -> dict[str, Any]:
    """Merges caller parameters over defaults and fixes the seed so the run is reproducible."""
    defaults = IMAGE_DEFAULTS if req.media_type == MediaType.image else VIDEO_DEFAULTS
    provided = req.parameters.set_fields()
    params = {**defaults, **{k: v for k, v in provided.items() if k in defaults}}
    params["seed"] = provided.get("seed") if provided.get("seed") is not None else random.randint(0, 999_999)
    return params


def estimate_cost(req: GenerationRequest, params: dict[str, Any]) -> int:
    spec = MODEL_REGISTRY[req.model]
    if req.media_type == MediaType.image:
        return spec.cost_per_unit * params["num_images"] * (2 if params["resolution"] == "4K" else 1)
    fps_multiplier = {24: 1.0, 30: 1.2, 60: 1.5}[params["fps"]]
    return round(spec.cost_per_unit * params["duration_sec"] * fps_multiplier) + (2 if params["end_frame_url"] else 0)


def estimate_seconds(req: GenerationRequest, params: dict[str, Any]) -> float:
    spec = MODEL_REGISTRY[req.model]
    if req.media_type == MediaType.image:
        factor = (0.7 + params["steps"] / 100) * (1.5 if params["resolution"] == "4K" else 1) * (1 + 0.15 * (params["num_images"] - 1))
    else:
        factor = (0.6 + params["duration_sec"] / 12) * (1.3 if params["fps"] == 60 else 1)
    return round(spec.base_seconds * factor * SIM_SPEED, 2)


def lineage_of(generation_id: str) -> list[str]:
    """Walks forked_from links up to the root; returns ids root-first, ending with generation_id."""
    chain: list[str] = []
    current: str | None = generation_id
    while current and current in GENERATIONS_DB and current not in chain:  # cycle guard
        chain.append(current)
        current = GENERATIONS_DB[current].forked_from
    return list(reversed(chain))


def generation_config(g: Generation) -> dict[str, Any]:
    """A generation's reproducible configuration (the 'parameter tree' a fork starts from)."""
    return {"prompt": g.prompt, "media_type": g.media_type.value, "model": g.model, "aspect_ratio": g.aspect_ratio.value, "parameters": dict(g.parameters)}


def poll_url_for(request: Request, job_id: str) -> str:
    return str(request.url_for("get_job", job_id=job_id))


def job_to_response(job: dict[str, Any], poll_url: str) -> JobResponse:
    result = GENERATIONS_DB.get(job["generation_id"]) if job.get("generation_id") else None
    remaining = None
    if job["status"] in (JobStatus.queued, JobStatus.processing):
        remaining = max(0.0, round(job["estimated_seconds"] * (1 - job["progress"] / 100), 1))
    return JobResponse(
        job_id=job["id"],
        status=job["status"],
        stage=job["stage"],
        progress=job["progress"],
        message=job["message"],
        media_type=job["request"].media_type,
        model=job["request"].model,
        eta_seconds=remaining,
        created_at=job["created_at"],
        updated_at=job["updated_at"],
        completed_at=job.get("completed_at"),
        generation_id=job.get("generation_id"),
        result=result,
        error=job.get("error"),
        poll_url=poll_url,
    )


def enqueue(req: GenerationRequest, background_tasks: BackgroundTasks, request: Request) -> GenerateResponse:
    """Validates lineage, stores a queued job and schedules its worker."""
    if req.parent_id and req.parent_id not in GENERATIONS_DB:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"parent generation '{req.parent_id}' not found")
    params = resolve_parameters(req)
    job_id = f"job_{uuid.uuid4().hex[:16]}"
    now = utcnow()
    JOBS_DB[job_id] = {
        "id": job_id,
        "request": req,
        "parameters": params,
        "status": JobStatus.queued,
        "stage": JobStage.queueing,
        "progress": 0,
        "message": "Waiting for a free GPU worker",
        "estimated_seconds": estimate_seconds(req, params),
        "cost": estimate_cost(req, params),
        "created_at": now,
        "updated_at": now,
    }
    background_tasks.add_task(run_generation_job, job_id)
    log.info("queued %s (%s, %s, ~%.1fs)", job_id, req.media_type.value, req.model, JOBS_DB[job_id]["estimated_seconds"])
    return GenerateResponse(
        job_id=job_id,
        status=JobStatus.queued,
        poll_url=poll_url_for(request, job_id),
        estimated_seconds=JOBS_DB[job_id]["estimated_seconds"],
        cost=JOBS_DB[job_id]["cost"],
    )


# --------------------------------------------------------------------------------------
# Background worker: simulated three-stage pipeline
# --------------------------------------------------------------------------------------

# (stage, share of total time, progress at start, progress at end, status message)
PIPELINE: list[tuple[JobStage, float, int, int, str]] = [
    (JobStage.queueing, 0.15, 0, 25, "Queued · allocating GPU and loading model weights"),
    (JobStage.sampling, 0.60, 25, 75, "Sampling · running diffusion steps"),
    (JobStage.rendering, 0.25, 75, 100, "Rendering · decoding, encoding and uploading to storage"),
]


def update_job(job: dict[str, Any], **fields: Any) -> None:
    job.update(fields, updated_at=utcnow())


async def run_generation_job(job_id: str) -> None:
    """
    Advances one job through the pipeline. Every wait is an `await asyncio.sleep`, so the event
    loop keeps serving other requests (including polls for this job) while it runs.
    """
    job = JOBS_DB.get(job_id)
    if job is None:
        return
    req: GenerationRequest = job["request"]
    params: dict[str, Any] = job["parameters"]
    total = job["estimated_seconds"]
    started = time.monotonic()
    try:
        for stage, share, start_pct, end_pct, message in PIPELINE:
            stage_seconds = max(TICK_SECONDS, total * share)
            steps = max(1, round(stage_seconds / TICK_SECONDS))
            for i in range(1, steps + 1):
                await asyncio.sleep(stage_seconds / steps)
                progress = start_pct + round((end_pct - start_pct) * i / steps)
                detail = message
                if stage == JobStage.sampling and req.media_type == MediaType.image:
                    detail = f"{message} ({round(params['steps'] * i / steps)}/{params['steps']})"
                elif stage == JobStage.sampling:
                    frames = params["duration_sec"] * params["fps"]
                    detail = f"{message} (frame {round(frames * i / steps)}/{frames})"
                update_job(job, status=JobStatus.processing, stage=stage, progress=min(progress, 99), message=detail)
            if stage == JobStage.rendering and random.random() < SIM_FAILURE_RATE:
                raise RuntimeError("GPU worker lost during rendering (simulated)")

        generation = build_generation(job_id, req, params, render_seconds=time.monotonic() - started)
        GENERATIONS_DB[generation.id] = generation
        update_job(job, status=JobStatus.completed, stage=JobStage.done, progress=100, message="Completed", generation_id=generation.id, completed_at=utcnow())
        log.info("completed %s -> %s in %.1fs", job_id, generation.id, generation.render_seconds)
    except Exception as exc:  # a failed job must never take the worker down silently
        log.exception("job %s failed", job_id)
        update_job(job, status=JobStatus.failed, message="Failed", error=str(exc))


def build_generation(job_id: str, req: GenerationRequest, params: dict[str, Any], render_seconds: float) -> Generation:
    count = params["num_images"] if req.media_type == MediaType.image else 1
    keys = pick_assets(req.prompt, params["seed"], count)
    return Generation(
        id=f"gen_{uuid.uuid4().hex[:12]}",
        media_type=req.media_type,
        title=title_from(req.prompt),
        prompt=req.prompt,
        model=req.model,
        model_name=MODEL_REGISTRY[req.model].name,
        aspect_ratio=req.aspect_ratio,
        duration=f"0:{params['duration_sec']:02d}" if req.media_type == MediaType.video else None,
        parameters=params,
        asset_urls=[asset_url(k, req.media_type, req.aspect_ratio) for k in keys],
        thumbnail_url=asset_url(keys[0], MediaType.image, req.aspect_ratio),
        tags=derive_tags(req, params, keys[0]),
        cost=estimate_cost(req, params),
        forked_from=req.parent_id,
        job_id=job_id,
        render_seconds=round(render_seconds, 2),
        created_at=utcnow(),
    )


# --------------------------------------------------------------------------------------
# Seed data so the feed and fork endpoints are useful immediately
# --------------------------------------------------------------------------------------


def seed_generations() -> None:
    seeds = [
        ("gen_fjord", MediaType.image, "aurora-xl", AspectRatio.landscape, "Aerial view of a Norwegian fjord at sunrise, volumetric light, cinematic", {"cfg_scale": 7.0, "steps": 30, "seed": 214071}, None, 60),
        ("gen_fjord_4k", MediaType.image, "aurora-xl", AspectRatio.landscape, "Aerial view of a Norwegian fjord at sunrise, volumetric light, cinematic", {"cfg_scale": 7.0, "steps": 30, "seed": 214071, "resolution": "4K"}, "gen_fjord", 58),
        ("gen_pug", MediaType.image, "prism-2", AspectRatio.square, "Portrait of a pug wrapped in a wool blanket on a forest trail, 35mm film grain", {"cfg_scale": 6.5, "steps": 28, "seed": 530112}, None, 40),
        ("gen_bear", MediaType.image, "aurora-xl", AspectRatio.classic, "Close portrait of a grizzly bear, wet fur, cinematic rim lighting", {"cfg_scale": 8.0, "steps": 40, "seed": 771203}, None, 18),
        ("gen_fjord_push", MediaType.video, "motion-pro", AspectRatio.landscape, "Slow push forward over the fjord at sunrise, drifting mist", {"duration_sec": 5, "fps": 24, "motion_score": 45, "camera": "zoom", "seed": 118822}, "gen_fjord", 56),
        ("gen_jelly", MediaType.video, "cinematic-ai", AspectRatio.portrait, "A jellyfish pulsing through deep blue water, neon glow, particles", {"duration_sec": 5, "fps": 60, "motion_score": 75, "camera": "zoom", "motion_model": "vector-x", "seed": 402266}, None, 24),
        ("gen_pug_loop", MediaType.video, "motion-pro", AspectRatio.portrait, "A pug breathing softly under a blanket on a bed, gentle motion", {"duration_sec": 3, "fps": 30, "motion_score": 20, "seed": 90417}, "gen_pug", 28),
    ]
    now = time.time()
    for gid, media, model, ar, prompt, raw_params, parent, hours_ago in seeds:
        req = GenerationRequest(prompt=prompt, media_type=media, model=model, aspect_ratio=ar, parameters=GenerationParameters(**raw_params), parent_id=parent)
        params = resolve_parameters(req)
        keys = pick_assets(prompt, params["seed"], 1)
        GENERATIONS_DB[gid] = Generation(
            id=gid,
            media_type=media,
            title=title_from(prompt),
            prompt=prompt,
            model=model,
            model_name=MODEL_REGISTRY[model].name,
            aspect_ratio=ar,
            duration=f"0:{params['duration_sec']:02d}" if media == MediaType.video else None,
            parameters=params,
            asset_urls=[asset_url(keys[0], media, ar)],
            thumbnail_url=asset_url(keys[0], MediaType.image, ar),
            tags=derive_tags(req, params, keys[0]),
            cost=estimate_cost(req, params),
            forked_from=parent,
            render_seconds=estimate_seconds(req, params),
            created_at=datetime.fromtimestamp(now - hours_ago * 3600, tz=timezone.utc),
        )


seed_generations()

# --------------------------------------------------------------------------------------
# Application
# --------------------------------------------------------------------------------------

app = FastAPI(
    title="VEYRA Studio API",
    version=API_VERSION,
    description="Async image & video generation queue with job polling, feed filtering and parameter forking.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    # Browsers reject credentialed requests to a wildcard origin, so only allow credentials with an explicit list.
    allow_credentials="*" not in CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get(f"{API_PREFIX}/health", response_model=HealthResponse, tags=["system"])
async def health() -> HealthResponse:
    """API status, engine version and queue depth."""
    counts = {s.value: 0 for s in JobStatus}
    for job in JOBS_DB.values():
        counts[job["status"].value] += 1
    return HealthResponse(
        status="online",
        api_version=API_VERSION,
        engine_version=ENGINE_VERSION,
        uptime_seconds=round(time.monotonic() - STARTED_AT, 1),
        queue=counts,
        generations=len(GENERATIONS_DB),
        time=utcnow(),
    )


@app.get(f"{API_PREFIX}/models", response_model=list[ModelSpec], tags=["system"])
async def list_models(media_type: MediaType | None = None) -> list[ModelSpec]:
    """Model registry, optionally filtered by media type."""
    return [m for m in MODEL_REGISTRY.values() if media_type is None or m.media_type == media_type]


@app.get(f"{API_PREFIX}/generations", response_model=FeedResponse, tags=["generations"])
async def list_generations(
    media_type: MediaType | None = Query(None, description="Filter the feed to 'image' or 'video'."),
    model: str | None = Query(None, description="Filter by model id."),
    tag: str | None = Query(None, description="Filter by tag (case-insensitive)."),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> FeedResponse:
    """Generation feed, newest first."""
    items = sorted(GENERATIONS_DB.values(), key=lambda g: g.created_at, reverse=True)
    if media_type:
        items = [g for g in items if g.media_type == media_type]
    if model:
        items = [g for g in items if g.model == model]
    if tag:
        items = [g for g in items if tag.lower() in (t.lower() for t in g.tags)]
    return FeedResponse(items=items[offset : offset + limit], total=len(items), limit=limit, offset=offset, media_type=media_type)


@app.get(f"{API_PREFIX}/generations/{{generation_id}}", response_model=Generation, tags=["generations"])
async def get_generation(generation_id: str) -> Generation:
    generation = GENERATIONS_DB.get(generation_id)
    if generation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"generation '{generation_id}' not found")
    return generation


@app.post(f"{API_PREFIX}/generate", response_model=GenerateResponse, status_code=status.HTTP_202_ACCEPTED, tags=["jobs"])
async def create_generation(body: GenerationRequest, background_tasks: BackgroundTasks, request: Request) -> GenerateResponse:
    """Queues an image or video generation job and returns immediately (202) with a polling URL."""
    return enqueue(body, background_tasks, request)


@app.get(f"{API_PREFIX}/jobs/{{job_id}}", response_model=JobResponse, tags=["jobs"], name="get_job")
async def get_job(job_id: str, request: Request) -> JobResponse:
    """Current stage, progress and ETA; includes the finished generation once completed."""
    job = JOBS_DB.get(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"job '{job_id}' not found")
    return job_to_response(job, poll_url_for(request, job_id))


@app.get(f"{API_PREFIX}/jobs", response_model=list[JobResponse], tags=["jobs"])
async def list_jobs(request: Request, status_filter: JobStatus | None = Query(None, alias="status"), limit: int = Query(50, ge=1, le=100)) -> list[JobResponse]:
    """Recent jobs, newest first."""
    jobs = sorted(JOBS_DB.values(), key=lambda j: j["created_at"], reverse=True)
    if status_filter:
        jobs = [j for j in jobs if j["status"] == status_filter]
    return [job_to_response(j, poll_url_for(request, j["id"])) for j in jobs[:limit]]


@app.post(f"{API_PREFIX}/fork", response_model=ForkResponse, tags=["generations"])
async def fork_generation(body: ForkRequest, background_tasks: BackgroundTasks, request: Request) -> ForkResponse:
    """
    Clones a generation's configuration, applies overrides and returns the new parameter tree
    with lineage. With submit=true the fork is also queued as a job.
    """
    parent = GENERATIONS_DB.get(body.parent_id)
    if parent is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"parent generation '{body.parent_id}' not found")

    base = generation_config(parent)
    tree = generation_config(parent)
    params = tree["parameters"]

    # Collect overrides; params that belong to the other media type are rejected below.
    param_overrides: dict[str, Any] = body.parameters.set_fields() if body.parameters else {}
    if body.cfg_scale is not None:
        param_overrides["cfg_scale"] = body.cfg_scale
    if body.motion_score is not None:
        param_overrides["motion_score"] = body.motion_score
    if body.seed is not None:
        param_overrides["seed"] = body.seed
    elif body.reroll_seed:
        param_overrides["seed"] = random.randint(0, 999_999)
    try:
        check_params_for_media(parent.media_type, param_overrides)
    except ValueError as exc:
        raise HTTPException(422, detail=str(exc)) from exc
    params.update(param_overrides)

    if body.new_prompt is not None:
        tree["prompt"] = body.new_prompt
    if body.model is not None:
        tree["model"] = body.model
    if body.aspect_ratio is not None:
        tree["aspect_ratio"] = body.aspect_ratio.value

    # Re-validate the merged tree through the same schema /generate uses (model/media/aspect checks).
    try:
        forked_request = GenerationRequest(
            prompt=tree["prompt"],
            media_type=parent.media_type,
            model=tree["model"],
            aspect_ratio=AspectRatio(tree["aspect_ratio"]),
            parameters=GenerationParameters(**{k: v for k, v in params.items() if v is not None}),
            parent_id=parent.id,
        )
    except ValueError as exc:
        raise HTTPException(422, detail=str(exc)) from exc

    diff: dict[str, dict[str, Any]] = {}
    for key in ("prompt", "model", "aspect_ratio"):
        if tree[key] != base[key]:
            diff[key] = {"from": base[key], "to": tree[key]}
    for key, value in params.items():
        if base["parameters"].get(key) != value:
            diff[f"parameters.{key}"] = {"from": base["parameters"].get(key), "to": value}

    job = enqueue(forked_request, background_tasks, request) if body.submit else None
    return ForkResponse(
        fork_id=f"fork_{uuid.uuid4().hex[:12]}",
        forked_from=parent.id,
        lineage=lineage_of(parent.id),
        media_type=parent.media_type,
        changed_fields=list(diff),
        diff=diff,
        parameter_tree={**tree, "forked_from": parent.id},
        request=forked_request,
        job=job,
    )


if __name__ == "__main__":  # python main.py
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=False)
