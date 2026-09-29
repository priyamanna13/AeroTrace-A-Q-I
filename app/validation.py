"""Input validation and security sanitization helpers."""
from __future__ import annotations

import re
from typing import Optional
from fastapi import HTTPException

_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 .()&/,'_-]{0,79}$")


def _sanitize_path_param(value: str, param_name: str = "name") -> str:
    """Reject path traversal, control chars, and oversized identifiers.

    Raises HTTPException(422) rather than silently passing malformed input
    into downstream lookups (city YAML files, station registry, etc.).
    """
    cleaned = (value or "").strip()
    if not cleaned or not _NAME_RE.match(cleaned):
        raise HTTPException(
            status_code=422,
            detail=(
                f"Invalid {param_name}: must be 1-80 characters of letters, digits, "
                "spaces, or .()/,'_- and must not start with a separator."
            ),
        )
    return cleaned


def _sanitize_pollutant(value: Optional[str]) -> Optional[str]:
    """Restrict pollutant keys to the CPCB NAQI canonical set."""
    if value is None:
        return None
    key = value.strip().lower()
    if key not in {"pm25", "pm10", "no2", "so2", "co", "o3"}:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid pollutant {value!r}. Allowed: pm25, pm10, no2, so2, co, o3",
        )
    return key
