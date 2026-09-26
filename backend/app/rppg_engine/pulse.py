"""Heart rate from a face's skin color over time (the signal half of rPPG).

Blood volume in facial skin rises and falls with every heartbeat, shifting
skin color very slightly (well under 1% of pixel intensity). Given per-frame
mean skin RGB (see face_roi.py), this module:

1. resamples the trace onto an even clock (browser-recorded video has a
   variable frame rate),
2. projects it with POS (Wang et al. 2017, "Algorithmic Principles of Remote
   PPG"): normalizing each ~1.6 s window by its own mean color cancels
   brightness and shading changes, leaving the pulse,
3. band-passes to plausible heart rates and takes the strongest frequency,
4. scores that peak's SNR, so a clip with no clear pulse is rejected rather
   than reported as a number.

Steps 2-4 follow github.com/hschn58/rPPG (POS, Butterworth band-pass,
spectral peak, peak-power SNR), a pipeline built for standoff cameras.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.signal import butter, detrend, filtfilt, periodogram

FS = 30.0  # Hz: the even clock traces are resampled onto
HR_BAND_HZ = (0.7, 3.5)  # 42-210 bpm, resting through max effort
POS_WINDOW_S = 1.6  # Wang et al.'s window: about one heartbeat at rest
MIN_DURATION_S = 5.0
# Share of frames the face must be found in; gaps are interpolated over.
MIN_FACE_COVERAGE = 0.6
# Below this the "peak" is indistinguishable from noise. On synthetic 10 s
# traces, pure noise scores about -3 dB (99th percentile about 2 dB), so under
# 1% of pulseless clips get through, while 97%+ of pulse clips that pass are
# within 5 bpm.
MIN_SNR_DB = 2.0


class NoPulseReading(Exception):
    """The clip didn't contain a trustworthy pulse; the message says why."""


@dataclass
class PulseEstimate:
    heart_rate_bpm: float
    snr_db: float


def pos_pulse(rgb: np.ndarray, fs: float = FS) -> np.ndarray:
    """POS pulse signal from an evenly sampled (T, 3) RGB trace."""
    n = len(rgb)
    window = int(round(POS_WINDOW_S * fs))
    projection = np.array([[0.0, 1.0, -1.0], [-2.0, 1.0, 1.0]])
    pulse = np.zeros(n)
    for start in range(n - window + 1):
        block = rgb[start : start + window]
        s = (block / block.mean(axis=0)) @ projection.T
        h = s[:, 0] + (s[:, 0].std() / (s[:, 1].std() + 1e-12)) * s[:, 1]
        pulse[start : start + window] += h - h.mean()
    return pulse


def estimate_pulse(times: np.ndarray, rgb: np.ndarray) -> PulseEstimate:
    """Heart rate from per-frame mean skin color: times (T,) in seconds, rgb
    (T, 3) with NaN rows where no face was found. Raises NoPulseReading when
    the clip can't support a reading."""
    times = np.asarray(times, dtype=float)
    rgb = np.asarray(rgb, dtype=float)
    found = ~np.isnan(rgb).any(axis=1)
    duration = times[-1] - times[0] if len(times) > 1 else 0.0
    if duration < MIN_DURATION_S:
        raise NoPulseReading(f"clip is {duration:.1f}s; at least {MIN_DURATION_S:.0f}s is needed")
    if found.mean() < MIN_FACE_COVERAGE:
        raise NoPulseReading(
            f"face found in {found.mean():.0%} of frames; stay facing the camera, "
            "or move closer if you're far away"
        )

    grid = np.arange(times[0], times[-1], 1.0 / FS)
    even_rgb = np.column_stack([np.interp(grid, times[found], rgb[found, c]) for c in range(3)])
    b, a = butter(3, [HR_BAND_HZ[0] / (FS / 2), HR_BAND_HZ[1] / (FS / 2)], btype="band")
    pulse = filtfilt(b, a, detrend(pos_pulse(even_rgb)))
    freqs, power = periodogram(pulse, fs=FS, window="hann", nfft=max(4096, len(pulse)))

    in_band = (freqs >= HR_BAND_HZ[0]) & (freqs <= HR_BAND_HZ[1])
    peak_hz = freqs[in_band][np.argmax(power[in_band])]
    # A Hann-windowed sinusoid spreads over +-2/duration Hz; count that lobe
    # (and the first harmonic's) as signal and the rest of the band as noise.
    lobe = 2.0 / duration
    signal = in_band & ((np.abs(freqs - peak_hz) <= lobe) | (np.abs(freqs - 2 * peak_hz) <= lobe))
    snr_db = 10 * np.log10(power[signal].sum() / power[in_band & ~signal].sum())
    if snr_db < MIN_SNR_DB:
        raise NoPulseReading(f"no clear pulse in this clip (SNR {snr_db:.1f} dB)")
    return PulseEstimate(heart_rate_bpm=float(peak_hz * 60), snr_db=float(snr_db))
