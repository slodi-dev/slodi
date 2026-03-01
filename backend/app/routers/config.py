"""Public config endpoint — returns runtime settings the frontend needs.

No authentication required. Only exposes non-sensitive values.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["config"])

# Seed output written by seed.py at container startup
_SEED_OUTPUT = Path(__file__).parent.parent.parent / "seed_output.json"


class PublicConfig(BaseModel):
    default_workspace_id: str | None = None


def _read_seed_output() -> dict:
    # Prefer the env var set by the entrypoint (fast path)
    ws_id = os.getenv("DEFAULT_WORKSPACE_ID")
    if ws_id:
        return {"dagskrarbankinn_workspace_id": ws_id}
    # Fall back to reading the file directly
    if _SEED_OUTPUT.exists():
        try:
            return json.loads(_SEED_OUTPUT.read_text())
        except Exception:
            pass
    return {}


@router.get("/config/public", response_model=PublicConfig)
async def get_public_config() -> PublicConfig:
    """Return public runtime configuration values for the frontend."""
    data = _read_seed_output()
    return PublicConfig(
        default_workspace_id=data.get("dagskrarbankinn_workspace_id"),
    )
