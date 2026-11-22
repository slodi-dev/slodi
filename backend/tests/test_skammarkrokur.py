"""The skammarkrókur — a timed pause on submitting.

What it blocks matters less than what it does not. Someone under review keeps
reading, and keeps being able to flag genuinely unsafe content: taking that away
helps nobody, and it is the part a future refactor is most likely to break.
"""

import datetime as dt
import inspect
from collections.abc import Iterator
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
from app.domain.icelandic_dates import format_date
from app.domain.posting_suspension_constraints import MAX_DAYS
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


def test_a_suspension_may_be_open_ended():
    """Null days means it runs until somebody lifts it. Dagskrárstjórnarteymið
    owns that decision — every one is recorded, attributed and reversible."""
    assert SuspensionCreate(days=None, reason="Ítrekað").days is None


def test_a_dated_suspension_still_has_sane_bounds():
    """Zero days is not a decision, and past ten years "open-ended" is the
    honest word — reached deliberately, not by typing a large number."""
    with pytest.raises(ValueError):
        SuspensionCreate(days=0, reason="Nei")
    with pytest.raises(ValueError):
        SuspensionCreate(days=MAX_DAYS + 1, reason="Of langt")


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
    assert format_date(until) in exc.value.detail


@pytest.mark.asyncio
async def test_someone_not_suspended_passes_straight_through():
    with patch(ACTIVE_LOOKUP, new_callable=AsyncMock) as active:
        active.return_value = None
        user = _user()
        assert await require_not_suspended(user, AsyncMock()) is user


def _iter_endpoints(routes: object) -> "Iterator[object]":
    """Yield leaf routes, flattening whatever nesting this FastAPI uses.

    `app.routes` is **not** a flat list of endpoints on every version. On
    FastAPI 0.128 it is already flattened; on 0.141 it holds one
    `_IncludedRouter` wrapper per `include_router` call, and that wrapper
    exposes its contents as `original_router.routes` rather than as `.routes`.
    Walking it without unwrapping yields objects with no `endpoint`, no
    `methods` and no `dependant`, which is how this test found zero guarded
    routes on CI while passing locally.

    Both shapes are handled rather than either being pinned, because the point
    of the test is what the assembled app serves, not which FastAPI built it.
    """
    for route in routes:  # type: ignore[attr-defined]
        nested = getattr(route, "routes", None)
        if nested is None:
            nested = getattr(getattr(route, "original_router", None), "routes", None)
        if nested:
            yield from _iter_endpoints(nested)
        else:
            yield route


def _guarded_routes() -> set[tuple[tuple[str, ...], str]]:
    """Every (methods, path) that declares `require_not_suspended`.

    Read from the endpoint's own signature, duck-typed rather than
    `isinstance(..., params.Depends)`, so it does not depend on either FastAPI
    internals or on two modules resolving to the same class object.
    """
    guarded: set[tuple[tuple[str, ...], str]] = set()
    for route in _iter_endpoints(create_app().routes):
        endpoint = getattr(route, "endpoint", None)
        methods = getattr(route, "methods", None)
        path = getattr(route, "path", None)
        if endpoint is None or not methods or path is None:
            continue
        for param in inspect.signature(endpoint).parameters.values():
            dependency = getattr(param.default, "dependency", None)
            if getattr(dependency, "__name__", "") == "require_not_suspended":
                guarded.add((tuple(sorted(methods)), path))
                break

    # An empty set must never be mistaken for "nothing is wrong": both callers
    # assert the *absence* of something, so a lookup that quietly comes back
    # empty turns them into tests that cannot fail.
    assert guarded, "found no guarded routes at all — the lookup is broken, not the app"
    return guarded


def test_reporting_is_never_blocked():
    """Someone in skammarkrókur can still flag genuinely unsafe content.
    Removing that protects nobody."""
    assert not [p for _, p in _guarded_routes() if "reports" in p]


def test_the_guard_is_on_writes_and_not_on_reads():
    guarded = _guarded_routes()
    methods = {m for ms, _ in guarded for m in ms}
    assert methods <= {"POST", "PATCH", "PUT", "DELETE"}, f"a read path is guarded: {guarded}"

    # Withdrawing your own submission while suspended is exactly what should
    # happen, so the endpoints that remove content are deliberately open.
    withdrawals = {"/programs/{program_id}", "/events/{event_id}", "/tasks/{task_id}"}
    assert not [p for ms, p in guarded if "DELETE" in ms and p in withdrawals]

    assert len(guarded) >= 8


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


@pytest.mark.integration
@pytest.mark.asyncio
async def test_an_open_ended_suspension_runs_until_lifted(db):
    """It has no expiry to be past, so nothing but a person ends it."""
    user = m.User(name="F", auth0_id=f"auth0|{uuid4()}", email=f"{uuid4()}@t.is")
    db.add(user)
    await db.flush()
    now = get_current_datetime()
    db.add(
        m.PostingSuspension(
            user_id=user.id,
            starts_at=now,
            expires_at=None,
            reason="Ótímabundið",
            created_at=now,
        )
    )
    await db.flush()

    svc = PostingSuspensionService(db)
    active = await svc.active(user.id)
    assert active is not None
    assert active.expires_at is None
    assert active.is_active


@pytest.mark.asyncio
async def test_an_open_ended_refusal_names_no_date():
    """Inventing an end date would be a lie; saying so plainly is better than a
    vague refusal."""
    suspension = m.PostingSuspension(
        user_id=uuid4(),
        starts_at=get_current_datetime(),
        expires_at=None,
        reason="Ótímabundið",
        created_at=get_current_datetime(),
    )
    with patch(ACTIVE_LOOKUP, new_callable=AsyncMock) as active:
        active.return_value = suspension
        with pytest.raises(HTTPException) as exc:
            await require_not_suspended(_user(), AsyncMock())

    assert "fram til" not in exc.value.detail
    assert "Dagskrárstjórnarteymið" in exc.value.detail


# ── Who may suspend whom ─────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "issuer,target,allowed",
    [
        (Permissions.moderator, Permissions.member, True),
        (Permissions.moderator, Permissions.moderator, False),
        (Permissions.moderator, Permissions.admin, False),
        (Permissions.admin, Permissions.moderator, True),
        (Permissions.admin, Permissions.admin, False),
    ],
)
async def test_moderators_suspend_members_and_only_admins_suspend_moderators(
    issuer, target, allowed
):
    target_row = m.User(id=uuid4(), name="T", auth0_id="auth0|t", email="t@t.is")
    target_row.permissions = target
    session = AsyncMock()
    session.add = lambda _: None
    svc = PostingSuspensionService(session)
    with (
        patch("app.services.posting_suspensions.UserRepository.get", new_callable=AsyncMock) as get,
        patch.object(svc.repo, "active_for", new_callable=AsyncMock, return_value=None),
        patch.object(svc, "_reread", new_callable=AsyncMock) as reread,
    ):
        get.return_value = target_row
        call = svc.suspend(
            target_row.id,
            _user(issuer),
            SuspensionCreate(days=7, reason="Æfing"),
            BackgroundTasks(),
        )
        if allowed:
            await call
            reread.assert_awaited_once()
        else:
            with pytest.raises(HTTPException) as exc:
                await call
            assert exc.value.status_code == status.HTTP_403_FORBIDDEN


# ── Against the database: the answer names who issued and lifted it ─────────


def _as_out(row: m.User) -> UserOut:
    return UserOut(
        id=row.id,
        auth0_id=row.auth0_id,
        email=row.email,
        name=row.name,
        permissions=row.permissions,
    )


@pytest.mark.integration
@pytest.mark.asyncio
async def test_suspending_answers_with_who_issued_it(db):
    """It used to read `issued_by` off the new row, which raised under async after saving."""
    user = m.User(name="F", auth0_id=f"auth0|{uuid4()}", email=f"{uuid4()}@t.is")
    mod = m.User(
        name="Rýnir",
        auth0_id=f"auth0|{uuid4()}",
        email=f"{uuid4()}@t.is",
        permissions=Permissions.moderator,
    )
    db.add_all([user, mod])
    await db.flush()
    issuer = _as_out(mod)
    db.expunge(mod)  # as in a request, where the caller comes from the user cache

    svc = PostingSuspensionService(db)
    out = await svc.suspend(
        user.id, issuer, SuspensionCreate(days=7, reason="Æfing"), BackgroundTasks()
    )
    assert out.issued_by_name == "Rýnir"

    db.expunge_all()
    active = await svc.active(user.id)
    assert active is not None and active.issued_by_name == "Rýnir"

    lifted = await svc.lift(out.id, issuer, SuspensionLift(reason="Rætt"))
    assert lifted.lifted_by_name == "Rýnir"
