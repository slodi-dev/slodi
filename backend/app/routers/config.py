"""Public config endpoint — returns runtime settings the frontend needs.

No authentication required. Only exposes non-sensitive values.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.seed import SEED_KEY_DEFAULT_WS, read_seed_output

logger = logging.getLogger(__name__)

router = APIRouter(tags=["config"])


class PublicConfig(BaseModel):
    default_workspace_id: str | None = None


@router.get("/config/public", response_model=PublicConfig)
async def get_public_config() -> PublicConfig:
    """Return public runtime configuration values for the frontend."""
    data = read_seed_output()
    return PublicConfig(
        default_workspace_id=data.get(SEED_KEY_DEFAULT_WS),
    )
