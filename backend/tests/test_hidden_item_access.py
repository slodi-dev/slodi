"""A hidden item: its author can still fix or withdraw it, moderators see it marked
as hidden, and other members get 404."""

from __future__ import annotations

import datetime as dt
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.core.db import get_session
from app.domain.enums import (
    ContentType,
    EventInterval,
    Permissions,
    ReviewState,
    Weekday,
    WorkspaceRole,
)
from app.main import create_app
from app.models.content import Content
from app.models.event import Event
from app.models.program import Program
from app.models.task import Task
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMembership
from app.schemas.user import UserOut
from app.utils import get_current_datetime

KINDS = [
    pytest.param(Program, "programs", ContentType.program, id="program"),
    pytest.param(Event, "events", ContentType.event, id="event"),
    pytest.param(Task, "tasks", ContentType.task, id="task"),
]


def _user(name: str, permissions: Permissions) -> UserOut:
    return UserOut(
        id=uuid4(),
        auth0_id=f"auth0|hidden_{name}_{uuid4()}",
        email=f"{name}_{uuid4()}@test.is",
        name=name,
        permissions=permissions,
    )


@pytest.fixture
def people() -> dict[str, UserOut]:
    return {
        "author": _user("author", Permissions.viewer),
        "moderator": _user("moderator", Permissions.moderator),
        "other": _user("other", Permissions.viewer),
    }


@pytest.fixture
def as_user(db):
    def client(user: UserOut) -> TestClient:
        app = create_app()

        async def override_get_session():
            yield db

        async def override_get_current_user():
            return user

        app.dependency_overrides[get_session] = override_get_session
        app.dependency_overrides[get_current_user] = override_get_current_user
        return TestClient(app)

    return client


async def _seed_hidden(
    db,
    people,
    model: type[Content],
    content_type: ContentType,
    monkeypatch: pytest.MonkeyPatch | None = None,
    state: ReviewState = ReviewState.needs_changes,
) -> UUID:
    """A hidden item sent back for changes; with monkeypatch, its workspace is made the bank."""
    ws = Workspace(
        name="Dagskrárbankinn",
        default_meeting_weekday=Weekday.monday,
        default_start_time=dt.time(20, 0),
        default_end_time=dt.time(21, 0),
        default_interval=EventInterval.weekly,
        season_start=dt.date.today(),
        settings=None,
        group_id=None,
    )
    db.add(ws)
    for person in people.values():
        db.add(User(id=person.id, name=person.name, auth0_id=person.auth0_id, email=person.email))
    await db.flush()
    if monkeypatch is not None:
        monkeypatch.setattr("app.core.auth._DEFAULT_WORKSPACE_ID", ws.id)
    for person in people.values():
        db.add(
            WorkspaceMembership(workspace_id=ws.id, user_id=person.id, role=WorkspaceRole.viewer)
        )
    item = model(
        name="Fánaleikur",
        created_at=get_current_datetime(),
        author_id=people["author"].id,
        workspace_id=ws.id,
        content_type=content_type,
        hidden_at=get_current_datetime(),
        review_state=state,
    )
    db.add(item)
    await db.commit()
    return item.id


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.parametrize("model,route,content_type", KINDS)
async def test_the_author_can_fix_their_hidden_item(
    db, people, as_user, model, route, content_type
):
    item_id = await _seed_hidden(db, people, model, content_type)

    resp = as_user(people["author"]).patch(f"/{route}/{item_id}", json={"name": "Lagað"})

    assert resp.status_code == 200, resp.text
    assert resp.json()["name"] == "Lagað"
    db.expire_all()
    stored = await db.get(Content, item_id)
    assert stored is not None
    assert stored.hidden_at is None
    assert stored.review_state == ReviewState.unreviewed


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.parametrize("model,route,content_type", KINDS)
async def test_the_author_can_only_delete_a_rejected_item(
    db, people, as_user, model, route, content_type
):
    item_id = await _seed_hidden(db, people, model, content_type, state=ReviewState.rejected)
    author = as_user(people["author"])

    assert author.patch(f"/{route}/{item_id}", json={"name": "Lagað"}).status_code == 403
    assert author.delete(f"/{route}/{item_id}").status_code == 204


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.parametrize("model,route,content_type", KINDS)
async def test_a_moderator_edit_does_not_requeue_the_item(
    db, people, as_user, model, route, content_type, monkeypatch
):
    item_id = await _seed_hidden(db, people, model, content_type, monkeypatch)

    resp = as_user(people["moderator"]).patch(f"/{route}/{item_id}", json={"name": "Lagað"})

    assert resp.status_code == 200, resp.text
    db.expire_all()
    stored = await db.get(Content, item_id)
    assert stored is not None
    assert stored.review_state == ReviewState.needs_changes


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.parametrize("model,route,content_type", KINDS)
async def test_a_moderator_cannot_edit_outside_the_bank(
    db, people, as_user, model, route, content_type
):
    item_id = await _seed_hidden(db, people, model, content_type)
    moderator = as_user(people["moderator"])

    assert moderator.patch(f"/{route}/{item_id}", json={"name": "Nei"}).status_code == 404
    assert moderator.delete(f"/{route}/{item_id}").status_code == 404


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.parametrize("model,route,content_type", KINDS)
async def test_the_author_can_withdraw_their_hidden_item(
    db, people, as_user, model, route, content_type
):
    item_id = await _seed_hidden(db, people, model, content_type)

    resp = as_user(people["author"]).delete(f"/{route}/{item_id}")

    assert resp.status_code == 204, resp.text


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.parametrize("model,route,content_type", KINDS)
async def test_a_moderator_sees_the_hidden_item_marked_as_hidden(
    db, people, as_user, model, route, content_type
):
    item_id = await _seed_hidden(db, people, model, content_type)
    moderator = as_user(people["moderator"])

    for path in (f"/{route}/{item_id}", f"/content/{item_id}"):
        resp = moderator.get(path)
        assert resp.status_code == 200, f"{path}: {resp.text}"
        assert resp.json()["hidden_at"] is not None, path


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.parametrize("model,route,content_type", KINDS)
async def test_another_member_cannot_read_or_change_the_hidden_item(
    db, people, as_user, model, route, content_type
):
    item_id = await _seed_hidden(db, people, model, content_type)
    other = as_user(people["other"])

    assert other.get(f"/{route}/{item_id}").status_code == 404
    assert other.get(f"/content/{item_id}").status_code == 404
    assert other.patch(f"/{route}/{item_id}", json={"name": "Nei"}).status_code == 404
    assert other.delete(f"/{route}/{item_id}").status_code == 404
