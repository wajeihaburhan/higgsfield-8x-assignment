"""Shared pytest fixtures for the VEYRA API.

The simulated pipeline is sped up *before* main.py is imported (it reads these at import time),
so a full generation job finishes in a few milliseconds.
"""

import os

os.environ.setdefault("SIM_SPEED", "0.02")
os.environ.setdefault("SIM_TICK_SECONDS", "0.002")
os.environ.setdefault("SIM_FAILURE_RATE", "0")
os.environ.setdefault("LOG_LEVEL", "WARNING")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402


@pytest.fixture(autouse=True)
def isolated_db():
    """Each test starts from the seeded store and leaves no jobs or generations behind."""
    generations = dict(main.GENERATIONS_DB)
    jobs = dict(main.JOBS_DB)
    yield
    main.GENERATIONS_DB.clear()
    main.GENERATIONS_DB.update(generations)
    main.JOBS_DB.clear()
    main.JOBS_DB.update(jobs)


@pytest.fixture
def client():
    # Note: Starlette's TestClient runs BackgroundTasks before returning the response,
    # so after POST /generate the (sped-up) job has already finished.
    with TestClient(main.app) as c:
        yield c


@pytest.fixture
def paused_worker(monkeypatch):
    """Replaces the background worker with a no-op so jobs stay 'queued' for inspection."""

    async def noop(job_id: str) -> None:
        return None

    monkeypatch.setattr(main, "run_generation_job", noop)


IMAGE_PAYLOAD = {
    "prompt": "Leopard on a dusty safari trail, wildlife photography, telephoto",
    "media_type": "image",
    "model": "aurora-xl",
    "aspect_ratio": "16:9",
    "parameters": {"cfg_scale": 7.5, "steps": 32, "num_images": 2, "seed": 1234},
}

VIDEO_PAYLOAD = {
    "prompt": "Concert crowd with hands up under stage lights, energetic",
    "media_type": "video",
    "model": "cinematic-ai",
    "aspect_ratio": "16:9",
    "parameters": {"duration_sec": 5, "fps": 60, "motion_score": 85, "camera": "pan"},
}
