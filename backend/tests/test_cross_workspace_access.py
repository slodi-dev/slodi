"""Reads and writes that addressed content by id without checking the workspace — sc-538.

- `GET /tags/{tag_id}/content` listed every tagged item in every workspace,
  hidden ones included.
- `GET /content/{content_id}/tags` and `GET /comments/{comment_id}` answered for
  content the caller could not otherwise reach.
- `PUT /events/{event_id}/troops/{troop_id}` attached a troop to any event id,
  deleted or in another workspace.
"""

import datetime as dt
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import models as m
from app import schemas as s
from app.core.auth import get_current_user
from app.core.db import get_session
from app.domain.enums import Permissions, WorkspaceRole
from app.main import create_app
from app.repositories.content import ContentAccess
from app.repositories.tags import TagRepository
from app.schemas.comment import CommentOut
from app.schemas.content import ContentListOut
from app.schemas.user import UserOut
from app.services.troops import TroopService
from app.utils import get_current_datetime

ACCESS = "app.repositories.content.ContentRepository.get_access"
ROLE = "app.core.auth._get_workspace_role"


def _client_as(user, session):
    app = create_app()

    async def _user():
        return user

    async def _session():
        yield session

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_session] = _session
    return TestClient(app)


# ── Content tags (unit) ───────────────────────────────────────────────────────


def test_a_non_member_cannot_read_an_items_tags(mock_db_session, viewer_user):
    with (
        patch(ACCESS, new_callable=AsyncMock) as access,
        patch(ROLE, new_callable=AsyncMock) as role,
        patch("app.services.tags.TagService.list_content_tags", new_callable=AsyncMock) as lst,
    ):
        access.return_value = ContentAccess(uuid4(), uuid4(), None)
        role.return_value = None

        res = _client_as(viewer_user, mock_db_session).get(f"/content/{uuid4()}/tags")

    assert res.status_code == 404
    lst.assert_not_called()


def test_a_member_can_read_an_items_tags(mock_db_session, viewer_user):
    with (
        patch(ACCESS, new_callable=AsyncMock) as access,
        patch(ROLE, new_callable=AsyncMock) as role,
        patch("app.services.tags.TagService.count_content_tags", new_callable=AsyncMock) as cnt,
        patch("app.services.tags.TagService.list_content_tags", new_callable=AsyncMock) as lst,
    ):
        access.return_value = ContentAccess(uuid4(), uuid4(), None)
        role.return_value = WorkspaceRole.viewer
        cnt.return_value = 0
        lst.return_value = []

        res = _client_as(viewer_user, mock_db_session).get(f"/content/{uuid4()}/tags")

    assert res.status_code == 200


# ── Tagged content (unit: who gets limited) ───────────────────────────────────


def _tagged_content_member_id(user, session):
    with (
        patch("app.services.tags.TagService.count_tagged_content", new_callable=AsyncMock) as cnt,
        patch("app.services.tags.TagService.list_tagged_content", new_callable=AsyncMock) as lst,
    ):
        cnt.return_value = 0
        lst.return_value = []
        res = _client_as(user, session).get(f"/tags/{uuid4()}/content")
    assert res.status_code == 200
    assert cnt.await_args.args[1] == lst.await_args.kwargs["member_id"]
    return lst.await_args.kwargs["member_id"]


def test_tagged_content_is_limited_to_the_callers_workspaces(mock_db_session, viewer_user):
    assert _tagged_content_member_id(viewer_user, mock_db_session) == viewer_user.id


def test_tagged_content_is_unlimited_for_a_platform_admin(mock_db_session, admin_user):
    assert _tagged_content_member_id(admin_user, mock_db_session) is None


@pytest.mark.parametrize(
    "permissions,expected",
    [
        (Permissions.viewer, False),
        (Permissions.member, False),
        (Permissions.moderator, True),
        (Permissions.admin, True),
    ],
)
def test_only_moderators_get_hidden_tagged_content(mock_db_session, permissions, expected):
    """Moderators need to find what the team hid; everyone else must not see it."""
    user = UserOut(
        id=uuid4(),
        auth0_id=f"auth0|{permissions}",
        email=f"{permissions}@test.is",
        name=permissions.value.title(),
        permissions=permissions,
    )
    with (
        patch("app.services.tags.TagService.count_tagged_content", new_callable=AsyncMock) as cnt,
        patch("app.services.tags.TagService.list_tagged_content", new_callable=AsyncMock) as lst,
    ):
        cnt.return_value = 0
        lst.return_value = []
        res = _client_as(user, mock_db_session).get(f"/tags/{uuid4()}/content")
    assert res.status_code == 200
    assert lst.await_args.kwargs["include_hidden"] is expected
    # The total header has to count the same rows the page lists.
    assert cnt.await_args.kwargs["include_hidden"] is expected


# ── Single comment (unit) ─────────────────────────────────────────────────────


def _comment(content_id):
    return CommentOut(
        id=uuid4(),
        body="Halló",
        author_name="Jana",
        created_at=dt.datetime.now(dt.UTC),
        user_id=uuid4(),
        content_id=content_id,
    )


def test_a_non_member_cannot_read_a_comment_by_id(mock_db_session, viewer_user):
    content_id = uuid4()
    with (
        patch("app.services.comments.CommentService.get", new_callable=AsyncMock) as get,
        patch(ACCESS, new_callable=AsyncMock) as access,
        patch(ROLE, new_callable=AsyncMock) as role,
    ):
        get.return_value = _comment(content_id)
        access.return_value = ContentAccess(uuid4(), uuid4(), None)
        role.return_value = None

        res = _client_as(viewer_user, mock_db_session).get(f"/comments/{uuid4()}")

    assert res.status_code == 404
    access.assert_awaited_once_with(content_id)


def test_a_comment_under_hidden_content_is_not_readable(mock_db_session, viewer_user):
    with (
        patch("app.services.comments.CommentService.get", new_callable=AsyncMock) as get,
        patch(ACCESS, new_callable=AsyncMock) as access,
        patch(ROLE, new_callable=AsyncMock) as role,
    ):
        get.return_value = _comment(uuid4())
        access.return_value = ContentAccess(uuid4(), uuid4(), get_current_datetime())
        role.return_value = WorkspaceRole.viewer

        res = _client_as(viewer_user, mock_db_session).get(f"/comments/{uuid4()}")

    assert res.status_code == 404


def test_a_member_can_read_a_comment_by_id(mock_db_session, viewer_user):
    with (
        patch("app.services.comments.CommentService.get", new_callable=AsyncMock) as get,
        patch(ACCESS, new_callable=AsyncMock) as access,
        patch(ROLE, new_callable=AsyncMock) as role,
    ):
        get.return_value = _comment(uuid4())
        access.return_value = ContentAccess(uuid4(), uuid4(), None)
        role.return_value = WorkspaceRole.viewer

        res = _client_as(viewer_user, mock_db_session).get(f"/comments/{uuid4()}")

    assert res.status_code == 200


# ── Integration: tagged content and troop participation ───────────────────────


async def _workspace(db, name):
    w_in = s.WorkspaceCreate(name=name)
    ws = m.Workspace(
        name=w_in.name,
        default_meeting_weekday=w_in.default_meeting_weekday,
        default_start_time=w_in.default_start_time,
        default_end_time=w_in.default_end_time,
        default_interval=w_in.default_interval,
        season_start=w_in.season_start,
    )
    db.add(ws)
    await db.flush()
    return ws


async def _user(db):
    user = m.User(name="Jana", auth0_id=f"auth0|{uuid4()}", email=f"{uuid4()}@example.com")
    db.add(user)
    await db.flush()
    return user


def _task(user, ws, name, **extra):
    return m.Task(
        name=name,
        created_at=get_current_datetime(),
        author_id=user.id,
        workspace_id=ws.id,
        content_type=m.ContentType.task,
        **extra,
    )


@pytest.mark.integration
@pytest.mark.asyncio
async def test_tagged_content_lists_only_visible_items_in_the_callers_workspaces(db):
    member = await _user(db)
    mine, theirs = await _workspace(db, "Mitt"), await _workspace(db, "Annarra")
    db.add(
        m.WorkspaceMembership(workspace_id=mine.id, user_id=member.id, role=WorkspaceRole.viewer)
    )
    tag = m.Tag(name=f"útivist-{uuid4()}")
    db.add(tag)
    items = [
        _task(member, mine, "Sýnilegt"),
        _task(member, mine, "Falið", hidden_at=get_current_datetime()),
        _task(member, mine, "Eytt", deleted_at=get_current_datetime()),
        _task(member, theirs, "Annars staðar"),
    ]
    db.add_all(items)
    await db.flush()
    db.add_all([m.ContentTag(content_id=i.id, tag_id=tag.id) for i in items])
    await db.flush()

    repo = TagRepository(db)
    rows = await repo.list_tagged_content(tag.id, member.id, member_id=member.id)
    assert [c.name for c, _ in rows] == ["Sýnilegt"]
    assert await repo.count_tagged_content(tag.id, member.id) == 1

    # No workspace limit (platform admin) but without include_hidden: still no
    # hidden or deleted items.
    everywhere = await repo.list_tagged_content(tag.id, member.id)
    assert sorted(c.name for c, _ in everywhere) == ["Annars staðar", "Sýnilegt"]
    assert await repo.count_tagged_content(tag.id) == 2

    # A moderator (include_hidden): the hidden item too, flagged; deleted still out.
    rows = await repo.list_tagged_content(
        tag.id, member.id, member_id=member.id, include_hidden=True
    )
    listed = {o.name: o for o in (ContentListOut.from_row(c, st) for c, st in rows)}
    assert set(listed) == {"Sýnilegt", "Falið"}
    assert listed["Falið"].hidden_at is not None
    assert listed["Sýnilegt"].hidden_at is None
    assert await repo.count_tagged_content(tag.id, member.id, include_hidden=True) == 2


async def _troop_and_events(db):
    author = await _user(db)
    ws, other = await _workspace(db, "Skátafélag"), await _workspace(db, "Annað")
    troop = m.Troop(name="Fálkar", workspace_id=ws.id)
    db.add(troop)

    def _event(workspace, name, **extra):
        return m.Event(
            name=name,
            created_at=get_current_datetime(),
            author_id=author.id,
            workspace_id=workspace.id,
            content_type=m.ContentType.event,
            **extra,
        )

    own = _event(ws, "Fundur")
    deleted = _event(ws, "Aflýst", deleted_at=get_current_datetime())
    foreign = _event(other, "Fundur annarra")
    db.add_all([own, deleted, foreign])
    await db.flush()
    return troop, own, deleted, foreign


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_troop_joins_an_event_in_its_own_workspace(db):
    troop, own, _, _ = await _troop_and_events(db)

    created, participation = await TroopService(db).add_participation(own.id, troop.id)

    assert created
    assert participation.event_id == own.id


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.parametrize("which", ["deleted", "foreign", "missing"])
async def test_a_troop_cannot_join_a_deleted_foreign_or_missing_event(db, which):
    troop, _, deleted, foreign = await _troop_and_events(db)
    event_id = {"deleted": deleted.id, "foreign": foreign.id, "missing": uuid4()}[which]

    with pytest.raises(HTTPException) as exc:
        await TroopService(db).add_participation(event_id, troop.id)

    assert exc.value.status_code == 404
