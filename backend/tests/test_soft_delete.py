"""
Comprehensive tests for soft-delete behaviour.

Router-level unit tests mock the service layer to verify HTTP semantics.
Integration tests (marked @pytest.mark.integration) use a real Postgres
container to verify that deleted_at is set and cascades work correctly.
"""

from __future__ import annotations

import datetime as dt
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException, status
from sqlalchemy import select

from app import models as m
from app.utils import get_current_datetime

# ── Helpers ───────────────────────────────────────────────────────────────────


def _ws_id():
    return uuid4()


def _prog(workspace_id=None):
    from app.schemas.program import ProgramOut
    from app.schemas.user import UserOut
    from app.schemas.workspace import WorkspaceNested

    wid = workspace_id or uuid4()
    return ProgramOut(
        id=uuid4(),
        workspace_id=wid,
        name="Test Program",
        author_id=uuid4(),
        created_at=dt.datetime.now(dt.timezone.utc),
        like_count=0,
        author=UserOut(id=uuid4(), name="Author", email="a@b.com", auth0_id="auth0|x"),
        workspace=WorkspaceNested(id=wid, name="WS"),
    )


def _not_found():
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


# ── Program delete ─────────────────────────────────────────────────────────────


def test_delete_program_returns_204(client):
    program_id = uuid4()
    sample = _prog()

    with (
        patch("app.services.programs.ProgramService.get", new_callable=AsyncMock) as mock_get,
        patch("app.services.programs.ProgramService.delete", new_callable=AsyncMock) as mock_del,
    ):
        mock_get.return_value = sample
        mock_del.return_value = None

        resp = client.delete(f"/programs/{program_id}")
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        mock_del.assert_called_once_with(program_id)


def test_delete_program_not_found_returns_404(client):
    with patch("app.services.programs.ProgramService.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = _not_found()

        resp = client.delete(f"/programs/{uuid4()}")
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ── Workspace delete ───────────────────────────────────────────────────────────


def test_delete_workspace_returns_204(client):
    ws_id = uuid4()

    with patch(
        "app.services.workspaces.WorkspaceService.delete", new_callable=AsyncMock
    ) as mock_del:
        mock_del.return_value = None

        resp = client.delete(f"/workspaces/{ws_id}")
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        mock_del.assert_called_once_with(ws_id)


def test_delete_workspace_not_found_returns_404(client):
    with patch(
        "app.services.workspaces.WorkspaceService.delete", new_callable=AsyncMock
    ) as mock_del:
        mock_del.side_effect = HTTPException(status_code=404, detail="Not found")

        resp = client.delete(f"/workspaces/{uuid4()}")
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ── Group delete ───────────────────────────────────────────────────────────────


def test_delete_group_returns_204(client):
    from app.schemas.group import GroupOut

    group_id = uuid4()
    sample_group = GroupOut(id=group_id, name="Test Group")

    with (
        patch("app.services.groups.GroupService.get", new_callable=AsyncMock) as mock_get,
        patch("app.services.groups.GroupService.delete", new_callable=AsyncMock) as mock_del,
    ):
        mock_get.return_value = sample_group
        mock_del.return_value = None

        resp = client.delete(f"/groups/{group_id}")
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        mock_del.assert_called_once_with(group_id)


def test_delete_group_not_found_returns_404(client):
    # Groups router calls svc.delete() directly; 404 is raised inside the service
    with patch("app.services.groups.GroupService.delete", new_callable=AsyncMock) as mock_del:
        mock_del.side_effect = _not_found()

        resp = client.delete(f"/groups/{uuid4()}")
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ── Tag delete ─────────────────────────────────────────────────────────────────


def test_delete_tag_returns_204(client):
    from app.schemas.tag import TagOut

    tag_id = uuid4()
    sample_tag = TagOut(id=tag_id, name="nature")

    with (
        patch("app.services.tags.TagService.get", new_callable=AsyncMock) as mock_get,
        patch("app.services.tags.TagService.delete", new_callable=AsyncMock) as mock_del,
    ):
        mock_get.return_value = sample_tag
        mock_del.return_value = None

        resp = client.delete(f"/tags/{tag_id}")
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        mock_del.assert_called_once_with(tag_id)


def test_delete_tag_not_found_returns_404(client):
    # Tags router calls svc.delete() directly; 404 is raised inside the service
    with patch("app.services.tags.TagService.delete", new_callable=AsyncMock) as mock_del:
        mock_del.side_effect = _not_found()

        resp = client.delete(f"/tags/{uuid4()}")
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ── Comment delete ─────────────────────────────────────────────────────────────


def test_delete_comment_returns_204(client, admin_user):
    from app.schemas.comment import CommentOut

    comment_id = uuid4()
    sample_comment = CommentOut(
        id=comment_id,
        body="Nice!",
        user_id=admin_user.id,
        content_id=uuid4(),
        created_at=dt.datetime.now(dt.timezone.utc),
    )

    with (
        patch("app.services.comments.CommentService.get", new_callable=AsyncMock) as mock_get,
        patch("app.services.comments.CommentService.delete", new_callable=AsyncMock) as mock_del,
    ):
        mock_get.return_value = sample_comment
        mock_del.return_value = None

        resp = client.delete(f"/comments/{comment_id}")
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        mock_del.assert_called_once_with(comment_id)


def test_delete_comment_not_found_returns_404(client):
    with patch("app.services.comments.CommentService.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = _not_found()

        resp = client.delete(f"/comments/{uuid4()}")
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ── User delete ────────────────────────────────────────────────────────────────


def test_delete_user_returns_204(client, sample_user):
    with (
        patch("app.services.users.UserService.get", new_callable=AsyncMock) as mock_get,
        patch("app.services.users.UserService.delete", new_callable=AsyncMock) as mock_del,
    ):
        mock_get.return_value = sample_user
        mock_del.return_value = None

        resp = client.delete(f"/users/{sample_user.id}")
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        mock_del.assert_called_once_with(sample_user.id)


def test_delete_user_not_found_returns_404(client):
    # Users router calls svc.delete() directly; 404 is raised inside the service
    with patch("app.services.users.UserService.delete", new_callable=AsyncMock) as mock_del:
        mock_del.side_effect = _not_found()

        resp = client.delete(f"/users/{uuid4()}")
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ── GET after soft-delete returns 404 (router level) ──────────────────────────


def test_get_program_returns_404_after_soft_delete(client):
    """Once soft-deleted, the service raises 404 on GET (repo filters deleted_at IS NULL)."""
    with patch("app.services.programs.ProgramService.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = _not_found()

        resp = client.get(f"/programs/{uuid4()}")
        assert resp.status_code == status.HTTP_404_NOT_FOUND


def test_get_workspace_returns_404_after_soft_delete(client):
    with patch("app.services.workspaces.WorkspaceService.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = _not_found()

        resp = client.get(f"/workspaces/{uuid4()}")
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ── Integration: soft delete persists deleted_at, row survives ────────────────


@pytest.mark.integration
@pytest.mark.asyncio
async def test_soft_delete_sets_deleted_at_not_hard_delete(db):
    """Soft-deleting a model sets deleted_at but does not remove the DB row."""
    user = m.User(name="Del User", auth0_id="auth0|del1", email="del1@test.com")
    ws = m.Workspace(
        name="Del WS",
        default_meeting_weekday=m.Weekday.monday,
        default_start_time=dt.time(20, 0),
        default_end_time=dt.time(21, 0),
        default_interval=m.EventInterval.weekly,
        season_start=dt.date.today(),
    )
    db.add_all([user, ws])
    await db.flush()

    program = m.Program(
        name="Del Prog",
        like_count=0,
        created_at=get_current_datetime(),
        author_id=user.id,
        workspace_id=ws.id,
        content_type=m.ContentType.program,
    )
    db.add(program)
    await db.flush()
    program_id = program.id

    # Simulate soft delete (what the repository UPDATE does)
    program.deleted_at = get_current_datetime()
    await db.commit()

    # Row must still exist in the DB
    raw = await db.scalar(select(m.Program).where(m.Program.id == program_id))
    assert raw is not None, "Row should not be physically deleted"
    assert raw.deleted_at is not None, "deleted_at must be set"

    # But filtered query (what the repo uses) returns nothing
    filtered = await db.scalar(
        select(m.Program).where(m.Program.id == program_id, m.Program.deleted_at.is_(None))
    )
    assert filtered is None, "Filtered query must exclude soft-deleted rows"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_workspace_soft_delete_cascade(db):
    """Soft-deleting a workspace must cascade deleted_at to Programs, Events, Tasks, Troops."""
    from app.repositories.workspaces import WorkspaceRepository

    user = m.User(name="Cascade User", auth0_id="auth0|casc1", email="casc@test.com")
    ws = m.Workspace(
        name="Cascade WS",
        default_meeting_weekday=m.Weekday.monday,
        default_start_time=dt.time(20, 0),
        default_end_time=dt.time(21, 0),
        default_interval=m.EventInterval.weekly,
        season_start=dt.date.today(),
    )
    db.add_all([user, ws])
    await db.flush()

    program = m.Program(
        name="Cascade Prog",
        like_count=0,
        created_at=get_current_datetime(),
        author_id=user.id,
        workspace_id=ws.id,
        content_type=m.ContentType.program,
    )
    event = m.Event(
        name="Cascade Event",
        like_count=0,
        created_at=get_current_datetime(),
        author_id=user.id,
        workspace_id=ws.id,
        content_type=m.ContentType.event,
        start_dt=get_current_datetime(),
        end_dt=None,
    )
    troop = m.Troop(name="Cascade Troop", workspace_id=ws.id)
    db.add_all([program, event, troop])
    await db.flush()

    task = m.Task(
        name="Cascade Task",
        like_count=0,
        created_at=get_current_datetime(),
        author_id=user.id,
        event_id=event.id,
        content_type=m.ContentType.task,
    )
    db.add(task)
    await db.flush()

    prog_id, event_id, task_id, troop_id, ws_id = (
        program.id,
        event.id,
        task.id,
        troop.id,
        ws.id,
    )

    # Soft-delete via repository
    repo = WorkspaceRepository(db)
    rows_affected = await repo.delete(ws_id)
    await db.commit()

    assert rows_affected == 1, "Workspace delete should report 1 affected row"

    # Workspace row still in DB with deleted_at set
    raw_ws = await db.scalar(select(m.Workspace).where(m.Workspace.id == ws_id))
    assert raw_ws is not None and raw_ws.deleted_at is not None

    # Program row still in DB with deleted_at set
    raw_prog = await db.scalar(select(m.Program).where(m.Program.id == prog_id))
    assert raw_prog is not None and raw_prog.deleted_at is not None

    # Event row still in DB with deleted_at set
    raw_event = await db.scalar(select(m.Event).where(m.Event.id == event_id))
    assert raw_event is not None and raw_event.deleted_at is not None

    # Task row still in DB with deleted_at set
    raw_task = await db.scalar(select(m.Task).where(m.Task.id == task_id))
    assert raw_task is not None and raw_task.deleted_at is not None

    # Troop row still in DB with deleted_at set
    raw_troop = await db.scalar(select(m.Troop).where(m.Troop.id == troop_id))
    assert raw_troop is not None and raw_troop.deleted_at is not None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_program_soft_delete_cascade(db):
    """Soft-deleting a program cascades deleted_at to its Events and Tasks."""
    from app.repositories.programs import ProgramRepository

    user = m.User(name="Prog Casc", auth0_id="auth0|pc1", email="pc@test.com")
    ws = m.Workspace(
        name="Prog Casc WS",
        default_meeting_weekday=m.Weekday.monday,
        default_start_time=dt.time(20, 0),
        default_end_time=dt.time(21, 0),
        default_interval=m.EventInterval.weekly,
        season_start=dt.date.today(),
    )
    db.add_all([user, ws])
    await db.flush()

    program = m.Program(
        name="Prog Casc Program",
        like_count=0,
        created_at=get_current_datetime(),
        author_id=user.id,
        workspace_id=ws.id,
        content_type=m.ContentType.program,
    )
    db.add(program)
    await db.flush()

    event = m.Event(
        name="Prog Casc Event",
        like_count=0,
        created_at=get_current_datetime(),
        author_id=user.id,
        workspace_id=ws.id,
        program_id=program.id,
        content_type=m.ContentType.event,
        start_dt=get_current_datetime(),
        end_dt=None,
    )
    db.add(event)
    await db.flush()

    task = m.Task(
        name="Prog Casc Task",
        like_count=0,
        created_at=get_current_datetime(),
        author_id=user.id,
        event_id=event.id,
        content_type=m.ContentType.task,
    )
    db.add(task)
    await db.flush()

    prog_id, event_id, task_id = program.id, event.id, task.id

    # Soft-delete the program via repository
    repo = ProgramRepository(db)
    rows_affected = await repo.delete(prog_id)
    await db.commit()

    assert rows_affected == 1

    # All three rows still exist but are soft-deleted
    for model_cls, entity_id in [
        (m.Program, prog_id),
        (m.Event, event_id),
        (m.Task, task_id),
    ]:
        raw = await db.scalar(select(model_cls).where(model_cls.id == entity_id))
        assert raw is not None, f"{model_cls.__name__} row must not be hard-deleted"
        assert raw.deleted_at is not None, f"{model_cls.__name__}.deleted_at must be set"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_event_soft_delete_cascade(db):
    """Soft-deleting an event cascades deleted_at to its Tasks."""
    from app.repositories.events import EventRepository

    user = m.User(name="Ev Casc", auth0_id="auth0|ec1", email="ec@test.com")
    ws = m.Workspace(
        name="Ev Casc WS",
        default_meeting_weekday=m.Weekday.monday,
        default_start_time=dt.time(20, 0),
        default_end_time=dt.time(21, 0),
        default_interval=m.EventInterval.weekly,
        season_start=dt.date.today(),
    )
    db.add_all([user, ws])
    await db.flush()

    event = m.Event(
        name="Ev Casc Event",
        like_count=0,
        created_at=get_current_datetime(),
        author_id=user.id,
        workspace_id=ws.id,
        content_type=m.ContentType.event,
        start_dt=get_current_datetime(),
        end_dt=None,
    )
    db.add(event)
    await db.flush()

    task = m.Task(
        name="Ev Casc Task",
        like_count=0,
        created_at=get_current_datetime(),
        author_id=user.id,
        event_id=event.id,
        content_type=m.ContentType.task,
    )
    db.add(task)
    await db.flush()

    event_id, task_id = event.id, task.id

    repo = EventRepository(db)
    rows_affected = await repo.delete(event_id)
    await db.commit()

    assert rows_affected == 1

    raw_event = await db.scalar(select(m.Event).where(m.Event.id == event_id))
    assert raw_event is not None and raw_event.deleted_at is not None

    raw_task = await db.scalar(select(m.Task).where(m.Task.id == task_id))
    assert raw_task is not None and raw_task.deleted_at is not None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_soft_deleted_rows_excluded_from_list_queries(db):
    """Repository list/count queries must not return soft-deleted records."""
    from app.repositories.programs import ProgramRepository

    user = m.User(name="List User", auth0_id="auth0|lu1", email="lu@test.com")
    ws = m.Workspace(
        name="List WS",
        default_meeting_weekday=m.Weekday.monday,
        default_start_time=dt.time(20, 0),
        default_end_time=dt.time(21, 0),
        default_interval=m.EventInterval.weekly,
        season_start=dt.date.today(),
    )
    db.add_all([user, ws])
    await db.flush()

    # Create two programs
    p1 = m.Program(
        name="Active",
        like_count=0,
        created_at=get_current_datetime(),
        author_id=user.id,
        workspace_id=ws.id,
        content_type=m.ContentType.program,
    )
    p2 = m.Program(
        name="Deleted",
        like_count=0,
        created_at=get_current_datetime(),
        author_id=user.id,
        workspace_id=ws.id,
        content_type=m.ContentType.program,
    )
    db.add_all([p1, p2])
    await db.flush()

    repo = ProgramRepository(db)

    # Both show up before deletion
    count_before = await repo.count_programs_for_workspace(ws.id)
    assert count_before == 2

    # Soft-delete p2
    await repo.delete(p2.id)
    await db.commit()

    # Only p1 should appear now
    count_after = await repo.count_programs_for_workspace(ws.id)
    assert count_after == 1

    listed = await repo.list_by_workspace(ws.id)
    assert len(listed) == 1
    assert listed[0].id == p1.id


@pytest.mark.integration
@pytest.mark.asyncio
async def test_soft_delete_idempotent(db):
    """Soft-deleting an already-deleted record returns 0 rows affected."""
    from app.repositories.programs import ProgramRepository

    user = m.User(name="Idemp User", auth0_id="auth0|idemp1", email="idemp@test.com")
    ws = m.Workspace(
        name="Idemp WS",
        default_meeting_weekday=m.Weekday.monday,
        default_start_time=dt.time(20, 0),
        default_end_time=dt.time(21, 0),
        default_interval=m.EventInterval.weekly,
        season_start=dt.date.today(),
    )
    db.add_all([user, ws])
    await db.flush()

    program = m.Program(
        name="Idemp Prog",
        like_count=0,
        created_at=get_current_datetime(),
        author_id=user.id,
        workspace_id=ws.id,
        content_type=m.ContentType.program,
    )
    db.add(program)
    await db.flush()

    repo = ProgramRepository(db)

    first = await repo.delete(program.id)
    await db.commit()
    assert first == 1

    # Second delete on same ID — already has deleted_at set, so 0 rows
    second = await repo.delete(program.id)
    await db.commit()
    assert second == 0
