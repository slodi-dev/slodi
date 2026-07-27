from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.domain.game_score_policy import REPLACE_SCORE_GAMES, score_replaces
from app.models.user import User
from app.schemas.game_score import GameScoreCreate
from app.services.game_scores import GameScoreService

# Two different meanings share one leaderboard endpoint:
#
#   Hörpuhopp submits an arcade high score, which must never fall.
#   Arnór-Clicker submits the Þingstig the player currently holds, and those
#   are spent to hire a fundarstjóri — so that score has to be able to fall,
#   or buying one would be competitively free.
#
# These tests pin both behaviours, and that the default is the safe one.

ARCADE = "horpuhopp"
HOLDINGS = "arnor-clicker"


# ── policy ────────────────────────────────────────────────────────────────────
def test_only_arnor_clicker_may_lower_its_score():
    assert score_replaces(HOLDINGS) is True
    assert score_replaces(ARCADE) is False


def test_an_unknown_game_defaults_to_never_falling():
    # A new game added to the registry must not silently inherit replace
    # semantics — it has to opt in here.
    assert score_replaces("laddi-bird") is False
    assert score_replaces("") is False


def test_the_replace_list_stays_deliberately_small():
    assert set(REPLACE_SCORE_GAMES) == {HOLDINGS}


# ── stored behaviour ──────────────────────────────────────────────────────────
async def _user(db, name: str, auth0_id: str) -> User:
    user = User(name=name, auth0_id=auth0_id, email=f"{auth0_id}@example.com")
    db.add(user)
    await db.flush()
    return user


async def _submit(db, user: User, game: str, score: int) -> list:
    svc = GameScoreService(db)
    return await svc.submit_score(user_id=user.id, user_name=user.name, game_slug=game, score=score)


async def _score_of(db, user: User, game: str) -> int:
    svc = GameScoreService(db)
    rows = await svc.get_top_scores(game)
    mine = [r for r in rows if r.user_name == user.name]
    assert mine, f"no row for {user.name} in {game}"
    return mine[0].score


@pytest.mark.asyncio
async def test_arcade_score_never_falls(db):
    user = await _user(db, "Harpa", "auth0|arcade")

    await _submit(db, user, ARCADE, 500)
    assert await _score_of(db, user, ARCADE) == 500

    await _submit(db, user, ARCADE, 200)  # a worse run
    assert await _score_of(db, user, ARCADE) == 500  # best is kept


@pytest.mark.asyncio
async def test_arcade_score_still_rises(db):
    user = await _user(db, "Harpa2", "auth0|arcade2")

    await _submit(db, user, ARCADE, 500)
    await _submit(db, user, ARCADE, 900)
    assert await _score_of(db, user, ARCADE) == 900


@pytest.mark.asyncio
async def test_holdings_score_falls_when_thingstig_is_spent(db):
    user = await _user(db, "Arnor", "auth0|holdings")

    await _submit(db, user, HOLDINGS, 120)
    assert await _score_of(db, user, HOLDINGS) == 120

    # The player hires Aron for 50 Þingstig and resubmits what is left.
    await _submit(db, user, HOLDINGS, 70)
    assert await _score_of(db, user, HOLDINGS) == 70


@pytest.mark.asyncio
async def test_holdings_score_rises_on_prestige(db):
    user = await _user(db, "Arnor2", "auth0|holdings2")

    await _submit(db, user, HOLDINGS, 70)
    await _submit(db, user, HOLDINGS, 130)
    assert await _score_of(db, user, HOLDINGS) == 130


@pytest.mark.asyncio
async def test_the_two_games_do_not_affect_each_other(db):
    user = await _user(db, "Both", "auth0|both")

    await _submit(db, user, ARCADE, 800)
    await _submit(db, user, HOLDINGS, 800)

    await _submit(db, user, HOLDINGS, 100)  # spent Þingstig

    assert await _score_of(db, user, HOLDINGS) == 100  # fell, as it should
    assert await _score_of(db, user, ARCADE) == 800  # untouched


@pytest.mark.asyncio
async def test_one_players_spending_does_not_disturb_another(db):
    a = await _user(db, "Spender", "auth0|a")
    b = await _user(db, "Hoarder", "auth0|b")

    await _submit(db, a, HOLDINGS, 300)
    await _submit(db, b, HOLDINGS, 250)
    await _submit(db, a, HOLDINGS, 50)

    assert await _score_of(db, a, HOLDINGS) == 50
    assert await _score_of(db, b, HOLDINGS) == 250


@pytest.mark.asyncio
async def test_spending_everything_lands_the_player_at_nought(db):
    # Held Þingstig can legitimately reach zero, so the schema allows it and the
    # stored score must follow it down rather than keeping the old figure.
    user = await _user(db, "Broke", "auth0|broke")

    await _submit(db, user, HOLDINGS, 50)
    await _submit(db, user, HOLDINGS, 0)
    assert await _score_of(db, user, HOLDINGS) == 0


def test_a_score_of_zero_is_accepted_but_a_negative_one_is_not():
    assert GameScoreCreate(score=0).score == 0
    assert GameScoreCreate(score=999_999_999).score == 999_999_999
    with pytest.raises(ValidationError):
        GameScoreCreate(score=-1)
    with pytest.raises(ValidationError):
        GameScoreCreate(score=1_000_000_000)


@pytest.mark.asyncio
async def test_board_reorders_once_the_leader_spends(db):
    a = await _user(db, "WasFirst", "auth0|first")
    b = await _user(db, "WasSecond", "auth0|second")

    await _submit(db, a, HOLDINGS, 300)
    await _submit(db, b, HOLDINGS, 250)

    svc = GameScoreService(db)
    top = await svc.get_top_scores(HOLDINGS)
    assert [r.user_name for r in top][:2] == ["WasFirst", "WasSecond"]

    await _submit(db, a, HOLDINGS, 100)  # hires a fundarstjóri

    top = await svc.get_top_scores(HOLDINGS)
    assert [r.user_name for r in top][:2] == ["WasSecond", "WasFirst"]


def test_the_cap_matches_the_frontend_and_fits_the_column():
    # SCORE_CAP in the frontend's arnor-clicker gameData.ts must agree with this
    # bound, and both must stay inside the INTEGER column that stores the score.
    cap = 999_999_999
    assert GameScoreCreate(score=cap).score == cap
    with pytest.raises(ValidationError):
        GameScoreCreate(score=cap + 1)
    assert cap < 2_147_483_647
