"""Soft-deleted comments, and deleted or hidden child items, stay gone — see sc-537.

Deleting a comment set `deleted_at`, and the comment count respected it, but the
detail loaders eager-loaded the unfiltered `comments` relationship, so a deleted
comment reappeared on the next page load. The same held for a Program's events
and an Event's tasks: deleting or hiding one left it listed under its parent.
"""

import pytest

from app import models as m
from app import schemas as s
from app.repositories.events import EventRepository
from app.repositories.programs import ProgramRepository
from app.repositories.tasks import TaskRepository
from app.schemas.event import EventOut
from app.schemas.program import ProgramOut
from app.utils import get_current_datetime


async def _workspace(db):
    user = m.User(name="Jana", auth0_id="auth0|sc-537", email="sc537@example.com")
    db.add(user)
    w_in = s.WorkspaceCreate(name="Bankinn")
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
    return user, ws


def _content(model, user, ws, name, **extra):
    return model(
        name=name,
        created_at=get_current_datetime(),
        author_id=user.id,
        workspace_id=ws.id,
        **extra,
    )


async def _with_comments(db, user, content_id):
    db.add_all(
        [
            m.Comment(
                body="Stendur",
                user_id=user.id,
                content_id=content_id,
                created_at=get_current_datetime(),
            ),
            m.Comment(
                body="Eytt",
                created_at=get_current_datetime(),
                user_id=user.id,
                content_id=content_id,
                deleted_at=get_current_datetime(),
            ),
        ]
    )
    await db.flush()
    # Read back from the database, not from collections populated in memory.
    db.expunge_all()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_deleted_comment_does_not_come_back_on_a_task(db):
    user, ws = await _workspace(db)
    task = _content(m.Task, user, ws, "Verkefni", content_type=m.ContentType.task)
    db.add(task)
    await db.flush()
    await _with_comments(db, user, task.id)

    row = await TaskRepository(db).get(task.id)

    assert row is not None
    loaded, stats = row
    assert [c.body for c in loaded.comments] == ["Stendur"]
    assert stats.comment_count == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_an_event_hides_deleted_comments_and_deleted_or_hidden_tasks(db):
    user, ws = await _workspace(db)
    event = _content(m.Event, user, ws, "Viðburður", content_type=m.ContentType.event)
    db.add(event)
    await db.flush()
    now = get_current_datetime()
    db.add_all(
        [
            _content(
                m.Task, user, ws, "Sýnilegt", content_type=m.ContentType.task, event_id=event.id
            ),
            _content(
                m.Task,
                user,
                ws,
                "Eytt",
                content_type=m.ContentType.task,
                event_id=event.id,
                deleted_at=now,
            ),
            _content(
                m.Task,
                user,
                ws,
                "Falið",
                content_type=m.ContentType.task,
                event_id=event.id,
                hidden_at=now,
            ),
        ]
    )
    await _with_comments(db, user, event.id)

    row = await EventRepository(db).get(event.id)

    assert row is not None
    loaded, _ = row
    assert [c.body for c in loaded.comments] == ["Stendur"]
    assert [t.name for t in loaded.tasks] == ["Sýnilegt"]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_program_hides_deleted_comments_and_deleted_or_hidden_events(db):
    user, ws = await _workspace(db)
    program = _content(m.Program, user, ws, "Dagskrá", content_type=m.ContentType.program)
    db.add(program)
    await db.flush()
    now = get_current_datetime()
    db.add_all(
        [
            _content(
                m.Event,
                user,
                ws,
                "Sýnilegur",
                content_type=m.ContentType.event,
                program_id=program.id,
            ),
            _content(
                m.Event,
                user,
                ws,
                "Eytt",
                content_type=m.ContentType.event,
                program_id=program.id,
                deleted_at=now,
            ),
            _content(
                m.Event,
                user,
                ws,
                "Falinn",
                content_type=m.ContentType.event,
                program_id=program.id,
                hidden_at=now,
            ),
        ]
    )
    await _with_comments(db, user, program.id)

    repo = ProgramRepository(db)
    for row in (await repo.get(program.id), await repo.get_in_workspace(program.id, ws.id)):
        assert row is not None
        loaded, _ = row
        assert [c.body for c in loaded.comments] == ["Stendur"]
        assert [e.name for e in loaded.events] == ["Sýnilegur"]


# ── Moderators see hidden children, marked ───────────────────────────────────
#
# Dagskrárstjórnarteymið has to be able to find what it hid in order to unhide
# it, so the detail loaders keep hidden children for them — flagged through
# `hidden_at` so the frontend can grey them out. Deleted children stay gone for
# everyone.


async def _program_with_children(db):
    user, ws = await _workspace(db)
    program = _content(m.Program, user, ws, "Dagskrá", content_type=m.ContentType.program)
    db.add(program)
    await db.flush()
    now = get_current_datetime()
    db.add_all(
        [
            _content(
                m.Event,
                user,
                ws,
                "Sýnilegur",
                content_type=m.ContentType.event,
                program_id=program.id,
            ),
            _content(
                m.Event,
                user,
                ws,
                "Eytt",
                content_type=m.ContentType.event,
                program_id=program.id,
                deleted_at=now,
            ),
            _content(
                m.Event,
                user,
                ws,
                "Falinn",
                content_type=m.ContentType.event,
                program_id=program.id,
                hidden_at=now,
            ),
        ]
    )
    await db.flush()
    db.expunge_all()
    return program.id, ws.id


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_moderator_sees_hidden_events_flagged_but_not_deleted_ones(db):
    program_id, ws_id = await _program_with_children(db)
    repo = ProgramRepository(db)

    for row in (
        await repo.get(program_id, include_hidden_children=True),
        await repo.get_in_workspace(program_id, ws_id, include_hidden_children=True),
    ):
        assert row is not None
        out = ProgramOut.from_row(*row)
        by_name = {e.name: e for e in out.events}
        assert set(by_name) == {"Sýnilegur", "Falinn"}
        assert by_name["Falinn"].hidden_at is not None
        assert by_name["Sýnilegur"].hidden_at is None
        db.expunge_all()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_without_the_moderator_flag_hidden_events_stay_out(db):
    program_id, _ = await _program_with_children(db)

    row = await ProgramRepository(db).get(program_id)

    assert row is not None
    out = ProgramOut.from_row(*row)
    assert [e.name for e in out.events] == ["Sýnilegur"]
    assert out.events[0].hidden_at is None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_moderator_sees_hidden_tasks_flagged_but_not_deleted_ones(db):
    user, ws = await _workspace(db)
    event = _content(m.Event, user, ws, "Viðburður", content_type=m.ContentType.event)
    db.add(event)
    await db.flush()
    now = get_current_datetime()
    db.add_all(
        [
            _content(
                m.Task, user, ws, "Sýnilegt", content_type=m.ContentType.task, event_id=event.id
            ),
            _content(
                m.Task,
                user,
                ws,
                "Eytt",
                content_type=m.ContentType.task,
                event_id=event.id,
                deleted_at=now,
            ),
            _content(
                m.Task,
                user,
                ws,
                "Falið",
                content_type=m.ContentType.task,
                event_id=event.id,
                hidden_at=now,
            ),
        ]
    )
    await db.flush()
    db.expunge_all()

    row = await EventRepository(db).get(event.id, include_hidden_children=True)

    assert row is not None
    out = EventOut.from_row(*row)
    by_name = {t.name: t for t in out.tasks}
    assert set(by_name) == {"Sýnilegt", "Falið"}
    assert by_name["Falið"].hidden_at is not None
    assert by_name["Sýnilegt"].hidden_at is None
