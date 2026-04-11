from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, ConfigDict, Field


class GameScoreCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    score: int = Field(ge=0)


class GameScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_name: str
    score: int
    achieved_at: dt.datetime
