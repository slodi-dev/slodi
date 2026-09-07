"""The skammarkrókur — a timed pause on submitting.

What it blocks matters less than what it does not. Someone under review keeps
reading, and keeps being able to flag genuinely unsafe content: taking that away
helps nobody, and it is the part a future refactor is most likely to break.
"""

import datetime as dt
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import BackgroundTasks, HTTPException, status
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app import models as m
from app.core.auth import get_current_user, require_not_suspended
from app.core.db import get_session
from app.domain.enums import Permissions
from app.domain.posting_suspension_constraints import MODERATOR_MAX_DAYS
from app.main import create_app
from app.schemas.posting_suspension import SuspensionCreate, SuspensionLift
from app.schemas.user import UserOut
from app.services.posting_suspensions import PostingSuspensionService
from app.utils import get_current_datetime


def _user(permissions=Permissions.viewer):
    return UserOut(
        id=uuid4(),
        auth0_id=f"auth0|{uuid4()}",
        email=f"{uuid4()}@test.is",
        name="Foringi",
        permissions=permissions,
    )


def _client(mock_db_session, user):
    app = create_app()

    async def override_get_session():
        yield mock_db_session

    async def override_get_current_user():
        return user

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_current_user
    return TestClient(app)


# ── Who may issue one ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_moderator_cannot_suspend_beyond_a_season():
    """Past 90 days it is a judgement about somebody's place in the movement
    rather than about one piece of content, and that belongs to an admin."""
    svc = PostingSuspensionService(AsyncMock())
    with pytest.raises(HTTPException) as exc:
        await svc.suspend(
            uuid4(),
            _user(Permissions.moderator),
            SuspensionCreate(days=MODERATOR_MAX_DAYS + 1, reason="Ítrekað"),
            BackgroundTasks(),
        )
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_nobody_suspends_themselves():
    issuer = _user(Permissions.moderator)
    svc = PostingSuspensionService(AsyncMock())
    with pytest.raises(HTTPException) as exc:
        await svc.suspend(
            issuer.id, issuer, SuspensionCreate(days=7, reason="Æfing"), BackgroundTasks()
        )
    assert exc.value.status_code == status.HTTP_400_BAD_REQUEST


def test_a_suspension_must_carry_a_reason():
    """Someone told they cannot contribute deserves to know why."""
    with pytest.raises(ValueError):
        SuspensionCreate(days=7, reason="  ")


def test_a_suspension_is_bounded_at_both_ends():
    """Zero days is not a decision; unbounded is a ban by another name."""
    with pytest.raises(ValueError):
        SuspensionCreate(days=0, reason="Nei")


# ── What it blocks, and what it must not ─────────────────────────────────────


def _suspended_client(mock_db_session, user, until):
    """A client whose user is in skammarkrókur until `until`."""
    app = create_app()

    async def override_get_session():
        yield mock_db_session

    async def override_get_current_user():
        return user

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_current_user
    return TestClient(app)


ACTIVE_LOOKUP = "app.repositories.posting_suspensions.PostingSuspensionRepository.active_for"


@pytest.mark.asyncio
async def test_the_refusal_says_when_it_ends():
    """ "You cannot post" with no end reads as permanent, which is not what this
    is. The date is the message."""
    until = get_current_datetime() + dt.timedelta(days=7)
    suspension = m.PostingSuspension(
        user_id=uuid4(),
        starts_at=get_current_datetime(),
        expires_at=until,
        reason="Ítrekað",
        created_at=get_current_datetime(),
    )
    with patch(ACTIVE_LOOKUP, new_callable=AsyncMock) as active:
        active.return_value = suspension
        with pytest.raises(HTTPException) as exc:
            await require_not_suspended(_user(), AsyncMock())

    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    assert until.date().isoformat() in exc.value.detail
    assert exc.value.headers["X-Suspended-Until"] == until.date().isoformat()


@pytest.mark.asyncio
async def test_someone_not_suspended_passes_straight_through():
    with patch(ACTIVE_LOOKUP, new_callable=AsyncMock) as active:
        active.return_value = None
        user = _user()
        assert await require_not_suspended(user, AsyncMock()) is user


def test_reporting_is_never_blocked(mock_db_session):
    """Someone in skammarkrókur can still flag genuinely unsafe content.
    Removing that protects nobody."""
    app = create_app()
    guarded = [
        r.path
        for r in app.routes
        if any(
            getattr(d.call, "__name__", "") == "require_not_suspended"
            for d in getattr(getattr(r, "dependant", None), "dependencies", [])
        )
    ]
    assert not any("reports" in p for p in guarded)


def test_the_guard_is_on_writes_and_not_on_reads():
    app = create_app()
    guarded = {
        (tuple(sorted(r.methods)), r.path)
        for r in app.routes
        if any(
            getattr(d.call, "__name__", "") == "require_not_suspended"
            for d in getattr(getattr(r, "dependant", None), "dependencies", [])
        )
    }
    methods = {m for ms, _ in guarded for m in ms}
    assert methods <= {"POST", "PATCH"}, f"a read path is guarded: {guarded}"
    # Deleting is deliberately not guarded: withdrawing your own submission
    # while suspended is exactly what should happen.
    assert "DELETE" not in methods
    assert len(guarded) >= 10


# ── The record ───────────────────────────────────────────────────────────────


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_suspension_cannot_end_before_it_starts(db):
    user = m.User(name="F", auth0_id=f"auth0|{uuid4()}", email=f"{uuid4()}@t.is")
    db.add(user)
    await db.flush()
    now = get_current_datetime()
    db.add(
        m.PostingSuspension(
            user_id=user.id,
            starts_at=now,
            expires_at=now - dt.timedelta(days=1),
            reason="Aftur á bak",
            created_at=now,
        )
    )
    with pytest.raises(IntegrityError, match="ck_posting_suspensions_ends_after_start"):
        await db.flush()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_the_history_survives_the_spell_ending(db):
    """ "Third time this year" is the thing a reviewer needs, and a boolean would
    lose it the moment the second one started."""
    user = m.User(name="F", auth0_id=f"auth0|{uuid4()}", email=f"{uuid4()}@t.is")
    db.add(user)
    await db.flush()
    now = get_current_datetime()
    for weeks_ago in (20, 10):
        db.add(
            m.PostingSuspension(
                user_id=user.id,
                starts_at=now - dt.timedelta(weeks=weeks_ago),
                expires_at=now - dt.timedelta(weeks=weeks_ago - 1),
                reason=f"Spell {weeks_ago}",
                created_at=now,
            )
        )
    await db.flush()

    svc = PostingSuspensionService(db)
    history = await svc.history(user.id)

    assert len(history) == 2
    assert all(not s.is_active for s in history), "both have expired"
    assert await svc.active(user.id) is None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_lifting_early_is_recorded_as_its_own_act(db):
    """A suspension that was reconsidered is not the same as one that ran."""
    user = m.User(name="F", auth0_id=f"auth0|{uuid4()}", email=f"{uuid4()}@t.is")
    mod = m.User(name="Yfirferð", auth0_id=f"auth0|{uuid4()}", email=f"{uuid4()}@t.is")
    db.add_all([user, mod])
    await db.flush()
    now = get_current_datetime()
    suspension = m.PostingSuspension(
        user_id=user.id,
        starts_at=now,
        expires_at=now + dt.timedelta(days=30),
        reason="Ítrekað",
        created_at=now,
    )
    db.add(suspension)
    await db.flush()

    svc = PostingSuspensionService(db)
    assert (await svc.active(user.id)) is not None

    lifter = UserOut(
        id=mod.id,
        auth0_id=mod.auth0_id,
        email=mod.email,
        name=mod.name,
        permissions=Permissions.moderator,
    )
    lifted = await svc.lift(suspension.id, lifter, SuspensionLift(reason="Rætt og leyst"))

    assert lifted.lifted_at is not None
    assert lifted.lift_reason == "Rætt og leyst"
    assert not lifted.is_active
    # And the person can post again immediately — no cache to wait out.
    assert await svc.active(user.id) is None
