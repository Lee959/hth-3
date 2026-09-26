import numpy as np
import pytest

from app.rppg_engine.pulse import NoPulseReading, estimate_pulse


def _skin_trace(bpm=None, seconds=10, fps=30, noise=0.2, seed=0):
    rng = np.random.default_rng(seed)
    times = np.arange(0, seconds, 1 / fps)
    rgb = np.array([170.0, 120.0, 100.0]) + rng.normal(0, noise, (len(times), 3))
    if bpm:
        # Pulse shows most in green, then blue, then red.
        rgb += np.outer(0.4 * np.sin(2 * np.pi * bpm / 60 * times), [0.43, 1.0, 0.69])
    return times, rgb


@pytest.mark.parametrize("bpm", [60, 95, 150])
def test_recovers_heart_rate_from_skin_color(bpm):
    estimate = estimate_pulse(*_skin_trace(bpm))
    assert estimate.heart_rate_bpm == pytest.approx(bpm, abs=3)


def test_rejects_clip_without_a_pulse():
    with pytest.raises(NoPulseReading):
        estimate_pulse(*_skin_trace(None))


def test_rejects_clip_where_face_is_mostly_missing():
    times, rgb = _skin_trace(72)
    rgb[: len(rgb) // 2] = np.nan
    with pytest.raises(NoPulseReading, match="face found"):
        estimate_pulse(times, rgb)
