"""Hiding means unlisted — for everyone, on every read path — but not unreachable
by the author. See sc-481 and sc-482."""

import pytest

from app import models as m
from app import schemas as s
from app.repositories.events import EventRepository
from app.repositories.tasks import TaskRepository
from app.utils import get_current_datetime


async def _workspace_with_hidden_and_visible(db):
    user = m.User(name="Jana", auth0_id="auth0|hidden-vis", email="jana@example.com")
    db.add(user)
    w_in = s.WorkspaceCreate(name="Bankinn")
    ws = m.Workspace(
        name=w_in.name,
        default_meeting_weekday=w_in.default_meeting_weekday,
        default_start_time=w_in.default_start_time,
        default_end_time=w_in.default_end_time,
        default_interval=w_in.default_interval,
        season_start=w_in.season_start,
        settings=w_in.settings,
        group_id=w_in.group_id,
    )
    db.add(ws)
    await db.flush()
    return user, ws


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_hidden_task_is_absent_from_listings_and_counts(db):
    user, ws = await _workspace_with_hidden_and_visible(db)
    db.add_all(
        [
            m.Task(
                name="Sýnilegt",
                created_at=get_current_datetime(),
                author_id=user.id,
                workspace_id=ws.id,
                content_type=m.ContentType.task,
            ),
            m.Task(
                name="Falið",
                created_at=get_current_datetime(),
                author_id=user.id,
                workspace_id=ws.id,
                content_type=m.ContentType.task,
                hidden_at=get_current_datetime(),
            ),
        ]
    )
    await db.flush()

    repo = TaskRepository(db)
    names = [t.name for t, _ in await repo.list_for_workspace(ws.id, user.id)]

    assert names == ["Sýnilegt"]
    assert await repo.count_for_workspace(ws.id) == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_hidden_event_is_absent_from_listings_and_counts(db):
    user, ws = await _workspace_with_hidden_and_visible(db)
    db.add_all(
        [
            m.Event(
                name="Sýnilegur",
                created_at=get_current_datetime(),
                author_id=user.id,
                workspace_id=ws.id,
                content_type=m.ContentType.event,
            ),
            m.Event(
                name="Falinn",
                created_at=get_current_datetime(),
                author_id=user.id,
                workspace_id=ws.id,
                content_type=m.ContentType.event,
                hidden_at=get_current_datetime(),
            ),
        ]
    )
    await db.flush()

    repo = EventRepository(db)
    names = [e.name for e, _ in await repo.list_for_workspace(ws.id, user.id)]

    assert names == ["Sýnilegur"]
    assert await repo.count_for_workspace(ws.id) == 1
