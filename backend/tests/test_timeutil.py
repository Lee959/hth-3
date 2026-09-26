from datetime import datetime, timezone

import pytest

from app.timeutil import parse_timestamp

EXPECTED = datetime(2026, 9, 26, 18, 0, 0, tzinfo=timezone.utc)


def test_iso_with_z_suffix():
    assert parse_timestamp("2026-09-26T18:00:00.000Z") == EXPECTED


def test_iso_with_offset_and_naive():
    assert parse_timestamp("2026-09-26T20:00:00+02:00") == EXPECTED
    assert parse_timestamp("2026-09-26T18:00:00") == EXPECTED  # naive -> UTC


def test_epoch_milliseconds():
    ms = int(EXPECTED.timestamp() * 1000)
    assert parse_timestamp(ms) == EXPECTED
    assert parse_timestamp(str(ms)) == EXPECTED


def test_missing_is_none():
    assert parse_timestamp(None) is None
    assert parse_timestamp("") is None


@pytest.mark.parametrize("bad", ["yesterday", True, {"t": 1}, [1]])
def test_rejects_garbage(bad):
    with pytest.raises(ValueError):
        parse_timestamp(bad)
