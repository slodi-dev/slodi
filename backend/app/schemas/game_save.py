from __future__ import annotations

import datetime as dt
import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domain.game_saves import MAX_STATE_BYTES


class GameSaveIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Opaque to the backend by design — the client owns the save format and
    # sanitises it on load. Only the size is our business.
    state: dict[str, Any]
    revision: int = Field(ge=0)

    @field_validator("state")
    @classmethod
    def _within_size_limit(cls, v: dict[str, Any]) -> dict[str, Any]:
        size = len(json.dumps(v, separators=(",", ":")).encode())
        if size > MAX_STATE_BYTES:
            raise ValueError(f"state is {size} bytes, limit is {MAX_STATE_BYTES}")
        return v


class GameSaveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    state: dict[str, Any]
    revision: int
    updated_at: dt.datetime
