from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.run_tokens import TOKEN_TTL_SECONDS, RunTokenError, _sign, issue, verify
from app.domain.game_score_policy import (
    REPLACE_SCORE_GAMES,
    max_score,
    min_seconds_per_point,
    requires_run_token,
    score_replaces,
)
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


# ── run tokens and plausibility ───────────────────────────────────────────────
#
# A score is computed on the player's machine, so it can never be trusted
# outright. These pin the two things that bound a forgery: it has to be a score
# the game can produce, and it has to have taken as long as it would to play.

FLAPPY = "laddi-bird"


@pytest.fixture(autouse=True)
def _signing_key(monkeypatch):
    """
    Pin a signing key for every test in this module.

    Without it these depend on the ambient .env: a checkout with ENV=Production
    and no GAME_TOKEN_SECRET makes token minting raise, which is correct
    behaviour but nothing to do with what is under test here.
    """
    import app.core.run_tokens as rt

    monkeypatch.setattr(rt.settings, "game_token_secret", "test-signing-key", raising=False)


def _retimed(token: str, seconds_ago: int) -> str:
    """Re-stamp a token as if issued in the past, signed correctly."""
    game, issued, nonce, _ = token.split(".")
    payload = f"{game}.{int(issued) - seconds_ago}.{nonce}"
    return f"{payload}.{_sign(payload)}"


def test_a_freshly_issued_token_verifies_for_its_own_user_and_game():
    elapsed, nonce = verify(issue(FLAPPY), FLAPPY)
    assert elapsed < 5
    assert nonce


def test_a_token_is_not_bound_to_a_user_so_a_signed_out_run_can_be_saved():
    # Binding to a user would break the whole point: a player who finishes a run
    # while signed out has to obtain a token, park the run, log in, and submit
    # it. Identity comes from the session at submission time, not the token.
    elapsed, nonce = verify(issue(FLAPPY), FLAPPY)
    assert elapsed < 5 and nonce


def test_a_token_cannot_be_used_for_another_game():
    with pytest.raises(RunTokenError):
        verify(issue(FLAPPY), ARCADE)


def test_a_tampered_timestamp_is_rejected():
    # Back-dating the stamp is exactly how a cheat would claim a long run, so
    # the signature has to cover it.
    game, issued, nonce, signature = issue(FLAPPY).split(".")
    forged = f"{game}.{int(issued) - 100_000}.{nonce}.{signature}"
    with pytest.raises(RunTokenError):
        verify(forged, FLAPPY)


def test_a_tampered_signature_is_rejected():
    token = issue(FLAPPY)
    flipped = token[:-1] + ("A" if token[-1] != "A" else "B")
    with pytest.raises(RunTokenError):
        verify(flipped, FLAPPY)


@pytest.mark.parametrize("bad", ["", "nonsense", "a.b", "a.b.c.d.e"])
def test_malformed_tokens_are_rejected(bad):
    with pytest.raises(RunTokenError):
        verify(bad, FLAPPY)


def test_an_expired_token_is_rejected():
    with pytest.raises(RunTokenError):
        verify(_retimed(issue(FLAPPY), TOKEN_TTL_SECONDS + 60), FLAPPY)


def test_a_token_still_inside_its_window_reports_the_elapsed_time():
    # The elapsed figure is what the router divides by to decide whether the
    # claimed score was physically playable.
    elapsed, _ = verify(_retimed(issue(FLAPPY), 600), FLAPPY)
    assert 595 < elapsed < 615


# ── policy numbers ────────────────────────────────────────────────────────────
def test_laddi_bird_requires_a_run_token_and_others_do_not():
    assert requires_run_token(FLAPPY) is True
    assert requires_run_token(HOLDINGS) is False
    assert requires_run_token("") is False


def test_the_plausibility_ceiling_is_reachable_but_bounded():
    # One pipe per 100 frames at 60fps = 1.67s a point, so 2000 points is over
    # 55 minutes of flawless play — high enough never to bite an honest run,
    # low enough that the old 999,999,999 (about 53 years) is gone.
    assert max_score(FLAPPY) == 2_000
    # Hörpuhopp keeps the default: a ceiling has not been measured against its
    # live board, and one set too low would reject an existing player's runs.
    assert max_score(ARCADE) == 999_999_999
    assert max_score("unknown-game") == 999_999_999
    assert 45 * 60 < max_score(FLAPPY) * 1.67 < 70 * 60


def test_the_pace_limit_sits_under_the_real_rate():
    # Must be below 1.67s or latency and frame timing would reject honest runs;
    # must be well above zero or it bounds nothing.
    assert 0 < min_seconds_per_point(FLAPPY) < 100 / 60
    assert min_seconds_per_point("unknown-game") == 0.0


def test_the_console_one_liner_is_now_impossible():
    # The whole point: pasting a fetch with a huge score and no token.
    assert requires_run_token(FLAPPY)
    assert max_score(FLAPPY) < 999_999_999
    # And even holding a token, the score is paced.
    _, _ = verify(issue(FLAPPY), FLAPPY)
    assert max_score(FLAPPY) * min_seconds_per_point(FLAPPY) > 45 * 60


def test_the_signing_key_is_not_derived_from_the_database_password(monkeypatch):
    # /runs is unauthenticated and the derivation is public, so anyone could
    # collect HMACs over a known payload. Deriving from DB_PASSWORD turned every
    # token into a free offline oracle for the database credential.
    import app.core.run_tokens as rt

    monkeypatch.setattr(rt.settings, "game_token_secret", "", raising=False)
    monkeypatch.setattr(rt.settings, "env", "dev", raising=False)
    monkeypatch.setattr(rt.settings, "db_password", "hunter2", raising=False)
    before = rt._secret()

    monkeypatch.setattr(rt.settings, "db_password", "totally-different", raising=False)
    assert rt._secret() == before, "signing key must not depend on DB_PASSWORD"


def test_production_refuses_to_sign_with_a_guessable_key(monkeypatch):
    import app.core.run_tokens as rt

    monkeypatch.setattr(rt.settings, "game_token_secret", "", raising=False)
    monkeypatch.setattr(rt.settings, "env", "production", raising=False)
    with pytest.raises(RuntimeError, match="GAME_TOKEN_SECRET"):
        rt._secret()


def test_a_configured_key_is_used_verbatim(monkeypatch):
    import app.core.run_tokens as rt

    monkeypatch.setattr(rt.settings, "game_token_secret", "a-real-secret", raising=False)
    monkeypatch.setattr(rt.settings, "env", "production", raising=False)
    assert rt._secret() == b"a-real-secret"
