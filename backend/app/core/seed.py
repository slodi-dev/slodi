"""Utilities for reading the seed_output.json produced by seed.py.

Both auth.py (startup resolution) and routers/config.py (public endpoint)
need to read this file — this module is the single source of truth for that
logic and the key names used in the JSON.
"""

from __future__ import annotations

import contextlib
import json
import logging
import os
from pathlib import Path
from uuid import UUID

logger = logging.getLogger(__name__)

# JSON key written by seed.py for the default workspace ID
SEED_KEY_DEFAULT_WS = "dagskrarbankinn_workspace_id"

_default_seed_dir = str(Path(__file__).parent.parent.parent)
_SEED_OUTPUT = Path(os.getenv("SEED_OUTPUT_DIR", _default_seed_dir)) / "seed_output.json"


def read_seed_output() -> dict:
    """Return the parsed contents of seed_output.json, or {} on any failure.

    Prefers the DEFAULT_WORKSPACE_ID env var (fast path) so Docker deployments
    that inject the value at runtime never need the file on disk.
    """
    ws_id = os.getenv("DEFAULT_WORKSPACE_ID")
    if ws_id:
        return {SEED_KEY_DEFAULT_WS: ws_id}
    if _SEED_OUTPUT.exists():
        try:
            return json.loads(_SEED_OUTPUT.read_text())
        except Exception:
            logger.warning("Failed to read seed_output.json at %s", _SEED_OUTPUT, exc_info=True)
    return {}


def get_default_workspace_id() -> UUID | None:
    """Return the default workspace UUID, or None if not configured.

    Resolution order:
    1. DEFAULT_WORKSPACE_ID environment variable (takes priority)
    2. dagskrarbankinn_workspace_id key in seed_output.json

    Resolved once at startup — treat the return value as a deployment-time constant.
    """
    ws_id: str | None = None
    with contextlib.suppress(Exception):
        ws_id = read_seed_output().get(SEED_KEY_DEFAULT_WS)
    if ws_id:
        try:
            return UUID(ws_id)
        except ValueError:
            logger.warning("DEFAULT_WORKSPACE_ID '%s' is not a valid UUID — ignoring", ws_id)
    return None
