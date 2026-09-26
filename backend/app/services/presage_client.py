"""Thin wrapper around the Presage Physiology REST API.

Flow (see docs/ARCHITECTURE.md): request an upload URL -> PUT the video
bytes straight to that (presigned S3) URL -> tell Presage the upload is
complete -> poll for results. This is what lets a Python/Flask backend use
Presage at all: SmartSpectra's real-time SDK only ships for iOS, Android,
C++ and Node/Electron, not Python, so the REST API + async job pattern is
the supported integration path from Flask.

IMPORTANT: the endpoint paths and field names below (`upload_url`,
`upload_id`, `pulse_rate`, `breathing_rate`, `hrv`, `status`) are the
publicly documented shape as of when this boilerplate was written. Confirm
them against the real docs (https://docs.physiology.presagetech.com/) and
your own API key/response payloads before relying on this in a demo, and
adjust `analyze_video_chunk` / the callers in routes/vitals.py if the
actual response fields differ.
"""
import time

import requests
from flask import current_app


class PresageError(Exception):
    pass


def _headers() -> dict:
    api_key = current_app.config["PRESAGE_API_KEY"]
    return {"Authorization": f"Bearer {api_key}"}


def _base_url() -> str:
    return current_app.config["PRESAGE_API_BASE"].rstrip("/")


def request_upload_url() -> dict:
    resp = requests.post(f"{_base_url()}/v1/upload-url", headers=_headers(), timeout=10)
    resp.raise_for_status()
    return resp.json()


def upload_video_chunk(upload_url: str, file_bytes: bytes, content_type: str = "video/webm") -> None:
    resp = requests.put(upload_url, data=file_bytes, headers={"Content-Type": content_type}, timeout=30)
    resp.raise_for_status()


def mark_upload_complete(upload_id: str) -> dict:
    resp = requests.post(
        f"{_base_url()}/v1/complete",
        json={"upload_id": upload_id},
        headers=_headers(),
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def poll_for_results(upload_id: str, timeout_s: int = 30, interval_s: float = 2.0) -> dict:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        resp = requests.post(
            f"{_base_url()}/retrieve-data",
            json={"upload_id": upload_id},
            headers=_headers(),
            timeout=10,
        )
        resp.raise_for_status()
        payload = resp.json()
        if payload.get("status") == "complete":
            return payload
        time.sleep(interval_s)
    raise PresageError(f"Timed out waiting for Presage results for upload {upload_id}")


def analyze_video_chunk(file_bytes: bytes, content_type: str = "video/webm") -> dict:
    """End-to-end helper: upload a short recorded clip and return vitals."""
    upload_info = request_upload_url()
    upload_video_chunk(upload_info["upload_url"], file_bytes, content_type)
    mark_upload_complete(upload_info["upload_id"])
    return poll_for_results(upload_info["upload_id"])
