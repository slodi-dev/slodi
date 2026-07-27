from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, ConfigDict, Field


class GameScoreCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    # Zero is allowed because Arnór-Clicker ranks on Þingstig currently held,
    # and a player who spends every point on a fundarstjóri genuinely stands at
    # nought. It is permitted for every game rather than only that one: a stored
    # zero is harmless, since the default upsert never lowers an existing score.
    #
    # The upper bound is the leaderboard cap, and is the ceiling on what any
    # submission — honest or forged — can claim. It sits an order of magnitude
    # inside the `game_scores.score` INTEGER limit of 2,147,483,647, and must be
    # kept in step with SCORE_CAP in the frontend's arnor-clicker gameData.ts.
    score: int = Field(ge=0, le=999_999_999)


class GameScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_name: str
    score: int
    achieved_at: dt.datetime
