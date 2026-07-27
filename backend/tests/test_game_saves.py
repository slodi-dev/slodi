from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.domain.game_saves import MAX_STATE_BYTES, SAVEABLE_GAMES, is_saveable
from app.models.user import User
from app.schemas.game_save import GameSaveIn
from app.services.game_saves import GameSaveService

# The save is a durable backup of state the client owns. What matters here is
# that it cannot be clobbered by a stale tab, cannot be used as free storage,
# and cannot be created for a game that does not exist — the last one because
# saves are called directly on the API, with no proxy allowlist in front.

GAME = "arnor-clicker"


# ── which games may save ──────────────────────────────────────────────────────
def test_only_known_games_may_save():
    assert is_saveable(GAME) is True
    assert is_saveable("horpuhopp") is True


def test_an_unknown_game_may_not():
    # Without this the endpoint would happily create rows for any slug a client
    # invented, since nothing sits in front of it.
    assert is_saveable("not-a-game") is False
    assert is_saveable("") is False


def test_the_saveable_list_is_deliberate():
    assert set(SAVEABLE_GAMES) == {"arnor-clicker", "horpuhopp"}


# ── size limit ────────────────────────────────────────────────────────────────
def test_a_normal_save_is_accepted():
    # A fully upgraded Arnór-Clicker save is about 1.3 KB.
    state = {"counts": [250] * 20, "ups": [f"upgrade-{i}" for i in range(70)]}
    assert GameSaveIn(state=state, revision=1).state == state


def test_an_oversized_save_is_rejected():
    state = {"junk": "x" * (MAX_STATE_BYTES + 1)}
    with pytest.raises(ValidationError):
        GameSaveIn(state=state, revision=1)


def test_a_negative_revision_is_rejected():
    with pytest.raises(ValidationError):
        GameSaveIn(state={}, revision=-1)


def test_unexpected_fields_are_rejected():
    # extra="forbid" keeps the payload to what we documented.
    with pytest.raises(ValidationError):
        GameSaveIn(state={}, revision=1, sneaky="value")


# ── stored behaviour ──────────────────────────────────────────────────────────
async def _user(db, name: str, auth0_id: str) -> User:
    user = User(name=name, auth0_id=auth0_id, email=f"{auth0_id}@example.com")
    db.add(user)
    await db.flush()
    return user


@pytest.mark.asyncio
async def test_a_first_save_is_stored_and_read_back(db):
    user = await _user(db, "A", "auth0|save-a")
    svc = GameSaveService(db)

    assert await svc.get_save(user.id, GAME) is None

    save, stored = await svc.put_save(user.id, GAME, {"score": 5}, revision=1)
    assert stored is True
    assert save.state == {"score": 5}
    assert save.revision == 1

    again = await svc.get_save(user.id, GAME)
    assert again is not None
    assert again.state == {"score": 5}


@pytest.mark.asyncio
async def test_a_newer_revision_replaces_the_older_one(db):
    user = await _user(db, "B", "auth0|save-b")
    svc = GameSaveService(db)

    await svc.put_save(user.id, GAME, {"score": 5}, revision=1)
    save, stored = await svc.put_save(user.id, GAME, {"score": 900}, revision=2)

    assert stored is True
    assert save.state == {"score": 900}
    assert save.revision == 2


@pytest.mark.asyncio
async def test_a_stale_tab_cannot_clobber_newer_progress(db):
    # The case the revision counter exists for: a background tab flushes on
    # close, carrying state from before the player's latest run.
    user = await _user(db, "C", "auth0|save-c")
    svc = GameSaveService(db)

    await svc.put_save(user.id, GAME, {"score": 900}, revision=5)
    save, stored = await svc.put_save(user.id, GAME, {"score": 5}, revision=2)

    assert stored is False
    # The caller is handed the surviving save so it can adopt it.
    assert save.state == {"score": 900}
    assert save.revision == 5


@pytest.mark.asyncio
async def test_replaying_the_same_revision_changes_nothing(db):
    user = await _user(db, "D", "auth0|save-d")
    svc = GameSaveService(db)

    await svc.put_save(user.id, GAME, {"score": 10}, revision=3)
    save, stored = await svc.put_save(user.id, GAME, {"score": 999}, revision=3)

    assert stored is False
    assert save.state == {"score": 10}


@pytest.mark.asyncio
async def test_saves_are_per_game(db):
    user = await _user(db, "E", "auth0|save-e")
    svc = GameSaveService(db)

    await svc.put_save(user.id, GAME, {"which": "arnor"}, revision=1)
    await svc.put_save(user.id, "horpuhopp", {"which": "harpa"}, revision=1)

    arnor = await svc.get_save(user.id, GAME)
    harpa = await svc.get_save(user.id, "horpuhopp")
    assert arnor is not None and arnor.state == {"which": "arnor"}
    assert harpa is not None and harpa.state == {"which": "harpa"}


@pytest.mark.asyncio
async def test_saves_are_per_player(db):
    a = await _user(db, "F", "auth0|save-f")
    b = await _user(db, "G", "auth0|save-g")
    svc = GameSaveService(db)

    await svc.put_save(a.id, GAME, {"who": "a"}, revision=9)
    await svc.put_save(b.id, GAME, {"who": "b"}, revision=1)

    # B's low revision must not be judged against A's high one.
    save_a = await svc.get_save(a.id, GAME)
    save_b = await svc.get_save(b.id, GAME)
    assert save_a is not None and save_a.state == {"who": "a"}
    assert save_b is not None and save_b.state == {"who": "b"}


@pytest.mark.asyncio
async def test_nested_state_survives_a_round_trip(db):
    # jsonb, so the structure must come back as it went in — not stringified.
    user = await _user(db, "H", "auth0|save-h")
    svc = GameSaveService(db)
    state = {
        "counts": [1, 2, 3],
        "ups": ["ristabraud", "kaffi"],
        "chairs": ["arnor", "aron"],
        "nested": {"deep": {"value": 1.5}},
    }

    await svc.put_save(user.id, GAME, state, revision=1)
    back = await svc.get_save(user.id, GAME)

    assert back is not None
    assert back.state == state
