"""Unit tests for the VEYRA FastAPI backend (main.py).

Run:  cd backend && pip install -r requirements-dev.txt && pytest -v
"""

import asyncio
import re

import pytest

import main
from conftest import IMAGE_PAYLOAD, VIDEO_PAYLOAD

# Captured before any fixture patches it, so tests can drive the real worker directly.
REAL_WORKER = main.run_generation_job

API = "/api/v1"
JOB_ID = re.compile(r"^job_[0-9a-f]{16}$")
GEN_ID = re.compile(r"^gen_[0-9a-f]{12}$")


# --------------------------------------------------------------------------------------
# Health
# --------------------------------------------------------------------------------------


class TestHealth:
    def test_returns_online(self, client):
        res = client.get(f"{API}/health")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "online"
        assert body["engine_version"] == main.ENGINE_VERSION
        assert body["api_version"] == main.API_VERSION

    def test_reports_queue_and_generation_counts(self, client):
        body = client.get(f"{API}/health").json()
        assert set(body["queue"]) == {"queued", "processing", "completed", "failed"}
        assert body["generations"] == len(main.GENERATIONS_DB)

    def test_queue_counts_update_after_a_job(self, client):
        client.post(f"{API}/generate", json=IMAGE_PAYLOAD)
        assert client.get(f"{API}/health").json()["queue"]["completed"] == 1


# --------------------------------------------------------------------------------------
# Feed
# --------------------------------------------------------------------------------------


class TestFeed:
    def test_returns_all_items_with_count(self, client):
        res = client.get(f"{API}/generations")
        assert res.status_code == 200
        body = res.json()
        assert isinstance(body["items"], list)
        assert body["total"] == len(main.GENERATIONS_DB) == len(body["items"])
        assert body["media_type"] is None

    def test_items_are_newest_first(self, client):
        stamps = [g["created_at"] for g in client.get(f"{API}/generations").json()["items"]]
        assert stamps == sorted(stamps, reverse=True)

    def test_items_carry_metadata(self, client):
        item = client.get(f"{API}/generations").json()["items"][0]
        for field in ("id", "prompt", "model", "aspect_ratio", "parameters", "asset_urls", "thumbnail_url", "created_at"):
            assert field in item

    @pytest.mark.parametrize("media_type", ["image", "video"])
    def test_filter_by_media_type(self, client, media_type):
        body = client.get(f"{API}/generations", params={"media_type": media_type}).json()
        expected = [g for g in main.GENERATIONS_DB.values() if g.media_type.value == media_type]
        assert body["total"] == len(expected) > 0
        assert body["media_type"] == media_type
        assert all(item["media_type"] == media_type for item in body["items"])

    def test_video_items_have_duration_and_images_do_not(self, client):
        videos = client.get(f"{API}/generations", params={"media_type": "video"}).json()["items"]
        images = client.get(f"{API}/generations", params={"media_type": "image"}).json()["items"]
        assert all(re.fullmatch(r"0:\d{2}", v["duration"]) for v in videos)
        assert all(i["duration"] is None for i in images)

    def test_image_and_video_totals_add_up(self, client):
        total = client.get(f"{API}/generations").json()["total"]
        images = client.get(f"{API}/generations", params={"media_type": "image"}).json()["total"]
        videos = client.get(f"{API}/generations", params={"media_type": "video"}).json()["total"]
        assert images + videos == total

    def test_rejects_unknown_media_type(self, client):
        assert client.get(f"{API}/generations", params={"media_type": "gif"}).status_code == 422

    def test_pagination(self, client):
        page = client.get(f"{API}/generations", params={"limit": 2, "offset": 1}).json()
        everything = client.get(f"{API}/generations").json()["items"]
        assert [g["id"] for g in page["items"]] == [g["id"] for g in everything[1:3]]
        assert page["total"] == len(everything)

    def test_filter_by_model_and_tag(self, client):
        by_model = client.get(f"{API}/generations", params={"model": "motion-pro"}).json()["items"]
        assert by_model and all(g["model"] == "motion-pro" for g in by_model)
        by_tag = client.get(f"{API}/generations", params={"tag": "landscape"}).json()["items"]
        assert by_tag and all("Landscape" in g["tags"] for g in by_tag)


# --------------------------------------------------------------------------------------
# Create generation
# --------------------------------------------------------------------------------------


class TestGenerateValidation:
    @pytest.mark.parametrize("missing", ["prompt", "media_type", "model"])
    def test_rejects_missing_required_field(self, client, missing):
        payload = {k: v for k, v in IMAGE_PAYLOAD.items() if k != missing}
        res = client.post(f"{API}/generate", json=payload)
        assert res.status_code == 422
        assert any(missing in err["loc"] for err in res.json()["detail"])

    @pytest.mark.parametrize(
        "patch, message",
        [
            ({"prompt": "   "}, "prompt must not be blank"),
            ({"model": "not-a-model"}, "unknown model"),
            ({"media_type": "video"}, "generates image, not video"),
            ({"parameters": {"cfg_scale": 40}}, "less than or equal to 15"),
            ({"parameters": {"fps": 30}}, "fps not supported for image"),
            ({"colour": "red"}, "Extra inputs are not permitted"),
        ],
    )
    def test_rejects_invalid_payload(self, client, patch, message):
        res = client.post(f"{API}/generate", json={**IMAGE_PAYLOAD, **patch})
        assert res.status_code == 422
        assert message in str(res.json()["detail"])

    def test_rejects_4_3_video(self, client):
        res = client.post(f"{API}/generate", json={**VIDEO_PAYLOAD, "aspect_ratio": "4:3"})
        assert res.status_code == 422
        assert "4:3 is only available for images" in str(res.json()["detail"])

    def test_rejects_unknown_parent(self, client):
        res = client.post(f"{API}/generate", json={**IMAGE_PAYLOAD, "parent_id": "gen_missing"})
        assert res.status_code == 404


class TestGenerateEnqueue:
    def test_enqueues_job(self, client, paused_worker):
        res = client.post(f"{API}/generate", json=IMAGE_PAYLOAD)
        assert res.status_code == 202
        body = res.json()
        assert JOB_ID.match(body["job_id"])
        assert body["status"] == "queued"
        assert body["poll_url"].endswith(f"{API}/jobs/{body['job_id']}")
        assert body["estimated_seconds"] > 0
        # Aurora-XL costs 3 per image, 2 images at 1080p
        assert body["cost"] == 6
        assert main.JOBS_DB[body["job_id"]]["status"] == main.JobStatus.queued

    def test_video_cost_accounts_for_fps(self, client, paused_worker):
        body = client.post(f"{API}/generate", json=VIDEO_PAYLOAD).json()
        # Cinematic-AI: 5 credits/sec x 5s x 1.5 (60fps)
        assert body["cost"] == round(5 * 5 * 1.5)

    def test_defaults_fill_unset_parameters(self, client, paused_worker):
        payload = {"prompt": "A pug on a bed", "media_type": "image", "model": "prism-2"}
        job_id = client.post(f"{API}/generate", json=payload).json()["job_id"]
        params = main.JOBS_DB[job_id]["parameters"]
        assert params["steps"] == main.IMAGE_DEFAULTS["steps"]
        assert params["sampler"] == main.IMAGE_DEFAULTS["sampler"]
        assert isinstance(params["seed"], int)

    def test_explicit_nulls_fall_back_to_defaults(self, client, paused_worker):
        payload = {**IMAGE_PAYLOAD, "parameters": {"steps": None, "cfg_scale": None}}
        job_id = client.post(f"{API}/generate", json=payload).json()["job_id"]
        assert main.JOBS_DB[job_id]["parameters"]["steps"] == main.IMAGE_DEFAULTS["steps"]


# --------------------------------------------------------------------------------------
# Job polling and the background worker
# --------------------------------------------------------------------------------------


class TestJobPolling:
    def test_valid_job_returns_progress_and_status(self, client, paused_worker):
        job_id = client.post(f"{API}/generate", json=IMAGE_PAYLOAD).json()["job_id"]
        res = client.get(f"{API}/jobs/{job_id}")
        assert res.status_code == 200
        body = res.json()
        assert body["job_id"] == job_id
        assert body["status"] == "queued"
        assert body["stage"] == "queueing"
        assert body["progress"] == 0
        assert body["eta_seconds"] > 0
        assert body["result"] is None

    def test_invalid_job_returns_404(self, client):
        res = client.get(f"{API}/jobs/job_doesnotexist0")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"]

    def test_completed_job_includes_result_and_updates_feed(self, client):
        # TestClient runs the background worker before returning, so the job is already done.
        job_id = client.post(f"{API}/generate", json=IMAGE_PAYLOAD).json()["job_id"]
        body = client.get(f"{API}/jobs/{job_id}").json()
        assert body["status"] == "completed"
        assert body["stage"] == "done"
        assert body["progress"] == 100
        assert body["eta_seconds"] is None
        result = body["result"]
        assert GEN_ID.match(body["generation_id"]) and result["id"] == body["generation_id"]
        assert result["media_type"] == "image" and len(result["asset_urls"]) == 2
        assert result["parameters"]["seed"] == 1234
        assert "Wildlife" in result["tags"]
        assert "/mock/img/219-16x9.jpg" in result["asset_urls"][0]  # the leopard asset

        feed_ids = [g["id"] for g in client.get(f"{API}/generations", params={"media_type": "image"}).json()["items"]]
        assert feed_ids[0] == body["generation_id"]

    def test_completed_video_job(self, client):
        job_id = client.post(f"{API}/generate", json=VIDEO_PAYLOAD).json()["job_id"]
        result = client.get(f"{API}/jobs/{job_id}").json()["result"]
        assert result["duration"] == "0:05"
        assert result["asset_urls"][0].endswith("/mock/vid/452-16x9.mp4")  # the concert clip
        assert {"Camera Pan", "High Motion"} <= set(result["tags"])

    def test_same_seed_reproduces_the_same_assets(self, client):
        first = client.get(f"{API}/jobs/{client.post(f'{API}/generate', json=IMAGE_PAYLOAD).json()['job_id']}").json()
        second = client.get(f"{API}/jobs/{client.post(f'{API}/generate', json=IMAGE_PAYLOAD).json()['job_id']}").json()
        assert first["result"]["asset_urls"] == second["result"]["asset_urls"]

    def test_list_jobs_filters_by_status(self, client):
        client.post(f"{API}/generate", json=IMAGE_PAYLOAD)
        jobs = client.get(f"{API}/jobs", params={"status": "completed"}).json()
        assert len(jobs) == 1 and jobs[0]["status"] == "completed"
        assert client.get(f"{API}/jobs", params={"status": "failed"}).json() == []


class TestWorkerPipeline:
    def test_progress_moves_through_the_three_stages(self, client, paused_worker):
        job_id = client.post(f"{API}/generate", json=VIDEO_PAYLOAD).json()["job_id"]
        job = main.JOBS_DB[job_id]
        samples: list[tuple[str, str, int, str]] = []

        async def run_and_sample():
            task = asyncio.create_task(REAL_WORKER(job_id))
            while not task.done():
                samples.append((job["status"].value, job["stage"].value, job["progress"], job["message"]))
                await asyncio.sleep(0.0005)
            samples.append((job["status"].value, job["stage"].value, job["progress"], job["message"]))

        asyncio.run(run_and_sample())

        progress = [s[2] for s in samples]
        assert progress == sorted(progress), "progress must never go backwards"
        stages = list(dict.fromkeys(s[1] for s in samples))
        assert stages == ["queueing", "sampling", "rendering", "done"]
        assert any("frame" in s[3] and "/300" in s[3] for s in samples)  # 5s x 60fps
        assert all(s[2] <= 25 for s in samples if s[1] == "queueing")
        assert all(25 <= s[2] <= 75 for s in samples if s[1] == "sampling")
        assert samples[-1][:3] == ("completed", "done", 100)
        assert job["generation_id"] in main.GENERATIONS_DB

    def test_failed_job_reports_error(self, client, monkeypatch):
        monkeypatch.setattr(main, "SIM_FAILURE_RATE", 1.0)
        job_id = client.post(f"{API}/generate", json=IMAGE_PAYLOAD).json()["job_id"]
        body = client.get(f"{API}/jobs/{job_id}").json()
        assert body["status"] == "failed"
        assert "simulated" in body["error"]
        assert body["generation_id"] is None
        assert client.get(f"{API}/health").json()["queue"]["failed"] == 1


# --------------------------------------------------------------------------------------
# Fork / remix
# --------------------------------------------------------------------------------------


class TestFork:
    def test_clones_parent_with_overrides(self, client):
        parent = main.GENERATIONS_DB["gen_fjord_4k"]
        res = client.post(
            f"{API}/fork",
            json={"parent_id": "gen_fjord_4k", "new_prompt": "Aerial view of a fjord at dusk, cinematic", "cfg_scale": 9, "seed": 42},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["forked_from"] == "gen_fjord_4k"
        assert body["lineage"] == ["gen_fjord", "gen_fjord_4k"]
        assert body["media_type"] == "image"
        assert set(body["changed_fields"]) == {"prompt", "parameters.cfg_scale", "parameters.seed"}
        assert body["diff"]["parameters.cfg_scale"] == {"from": parent.parameters["cfg_scale"], "to": 9.0}

        tree = body["parameter_tree"]
        assert tree["forked_from"] == "gen_fjord_4k"
        assert tree["prompt"] == "Aerial view of a fjord at dusk, cinematic"
        assert tree["parameters"]["seed"] == 42
        # Untouched values are inherited from the parent
        assert tree["model"] == parent.model
        assert tree["parameters"]["resolution"] == "4K"
        assert tree["parameters"]["steps"] == parent.parameters["steps"]
        assert body["job"] is None

    def test_does_not_mutate_the_parent(self, client):
        before = dict(main.GENERATIONS_DB["gen_fjord_4k"].parameters)
        client.post(f"{API}/fork", json={"parent_id": "gen_fjord_4k", "cfg_scale": 12, "seed": 7})
        assert main.GENERATIONS_DB["gen_fjord_4k"].parameters == before

    def test_forked_request_can_be_posted_to_generate(self, client, paused_worker):
        request = client.post(f"{API}/fork", json={"parent_id": "gen_pug", "cfg_scale": 10}).json()["request"]
        assert all(v is not None for v in request["parameters"].values())
        res = client.post(f"{API}/generate", json=request)
        assert res.status_code == 202

    def test_video_fork_with_motion_score_and_submit(self, client):
        body = client.post(f"{API}/fork", json={"parent_id": "gen_pug_loop", "motion_score": 85, "reroll_seed": True, "submit": True}).json()
        assert body["media_type"] == "video"
        assert "parameters.motion_score" in body["changed_fields"]
        assert "parameters.seed" in body["changed_fields"]
        job = client.get(f"{API}/jobs/{body['job']['job_id']}").json()
        assert job["status"] == "completed"
        assert job["result"]["forked_from"] == "gen_pug_loop"
        assert job["result"]["parameters"]["motion_score"] == 85

    def test_lineage_follows_multiple_generations(self, client):
        first = client.post(f"{API}/fork", json={"parent_id": "gen_pug_loop", "motion_score": 60, "submit": True}).json()
        child_id = client.get(f"{API}/jobs/{first['job']['job_id']}").json()["generation_id"]
        body = client.post(f"{API}/fork", json={"parent_id": child_id, "motion_score": 10}).json()
        assert body["lineage"] == ["gen_pug", "gen_pug_loop", child_id]

    def test_unknown_parent_returns_404(self, client):
        res = client.post(f"{API}/fork", json={"parent_id": "gen_nope"})
        assert res.status_code == 404
        assert "not found" in res.json()["detail"]

    @pytest.mark.parametrize(
        "parent, override, message",
        [
            ("gen_jelly", {"cfg_scale": 8}, "cfg_scale not supported for video"),
            ("gen_pug", {"motion_score": 8}, "motion_score not supported for image"),
            ("gen_pug", {"model": "motion-pro"}, "generates video, not image"),
            ("gen_jelly", {"aspect_ratio": "4:3"}, "4:3 is only available for images"),
        ],
    )
    def test_rejects_overrides_that_do_not_fit_the_media_type(self, client, parent, override, message):
        res = client.post(f"{API}/fork", json={"parent_id": parent, **override})
        assert res.status_code == 422
        assert message in str(res.json()["detail"])

    def test_rejects_missing_parent_id(self, client):
        assert client.post(f"{API}/fork", json={"new_prompt": "x"}).status_code == 422
