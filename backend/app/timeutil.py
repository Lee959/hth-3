from datetime import datetime, timezone


def parse_timestamp(value):
    """A client timestamp -> timezone-aware UTC datetime, or None if absent.

    Accepts ISO 8601 strings (JS `toISOString()`, trailing "Z" included) and
    Unix epoch milliseconds (JS `Date.now()`), as a number or numeric
    string. Raises ValueError for anything else.
    """
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise ValueError(f"not a timestamp: {value!r}")
    if isinstance(value, (int, float)) or (isinstance(value, str) and value.replace(".", "", 1).isdigit()):
        return datetime.fromtimestamp(float(value) / 1000, tz=timezone.utc)
    if not isinstance(value, str):
        raise ValueError(f"not a timestamp: {value!r}")
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
