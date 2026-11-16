import datetime as dt
from uuid import uuid4

import pytest

from app import models as m
from app import schemas as s
from app.domain.enums import ContentLevel, ContentType, ReviewState
from app.main import app
from app.schemas.content import ContentCreateAtLevel, ContentUpdate
from app.schemas.moderation import ReviewFilters
from app.schemas.program import ProgramFilters
from app.services.content import ContentService
from app.services.moderation import ModerationService
from app.services.programs import ProgramService
from app.utils import get_current_datetime

START = dt.datetime(2026, 10, 14, 18, 0, tzinfo=dt.UTC)


async def _workspace(db, name="Ernir"):
    w_in = s.WorkspaceCreate(name=name)
    workspace = m.Workspace(
        name=w_in.name,
        default_meeting_weekday=w_in.default_meeting_weekday,
        default_start_time=w_in.default_start_time,
        default_end_time=w_in.default_end_time,
        default_interval=w_in.default_interval,
        season_start=w_in.season_start,
    )
    db.add(workspace)
    await db.flush()
    return workspace


async def _user(db):
    user = m.User(name="Jane", auth0_id=f"auth0|{uuid4()}", email=f"{uuid4()}@example.com")
    db.add(user)
    await db.flush()
    return user


async def _create(db, workspace, user, level, name="Slit"):
    body = ContentCreateAtLevel(name=name, level=level, author_id=user.id)
    return await ContentService(db).create(workspace.id, body)


async def _place(db, content, parent=None):
    placement = m.Placement(
        workspace_id=content.workspace_id,
        content_id=content.id,
        content_level=content.level,
        parent_id=parent.id if parent else None,
        parent_level=parent.content_level if parent else None,
        starts_at=START,
        ends_at=START + dt.timedelta(minutes=90),
        created_at=get_current_datetime(),
    )
    db.add(placement)
    await db.flush()
    return placement


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("level", "content_type"),
    [
        (ContentLevel.task, ContentType.task),
        (ContentLevel.event, ContentType.event),
        (ContentLevel.program, ContentType.program),
        (ContentLevel.season, ContentType.season),
    ],
)
async def test_content_is_created_at_its_level(db, level, content_type):
    workspace, user = await _workspace(db), await _user(db)

    item = await _create(db, workspace, user, level)

    assert (item.level, item.content_type) == (level, content_type)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_times_used_counts_placements_and_copies(db):
    workspace, user = await _workspace(db), await _user(db)
    slit = await _create(db, workspace, user, ContentLevel.task)
    fundur = await _place(db, await _create(db, workspace, user, ContentLevel.event, "Fundur"))
    await _place(db, slit, parent=fundur)
    db.add(
        m.Task(
            name="Slit 2",
            created_at=get_current_datetime(),
            author_id=user.id,
            workspace_id=workspace.id,
            copied_from_id=slit.id,
        )
    )
    await db.flush()

    assert (await ContentService(db).get(slit.id)).times_used == 2


@pytest.mark.integration
@pytest.mark.asyncio
async def test_updating_content_keeps_its_level(db):
    workspace, user = await _workspace(db), await _user(db)
    fundur = await _create(db, workspace, user, ContentLevel.event, "Fundur")

    updated = await ContentService(db).update(fundur.id, ContentUpdate(name="Fundur um hnúta"))

    assert (updated.name, updated.level) == ("Fundur um hnúta", ContentLevel.event)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_deleting_content_removes_its_placements_and_what_they_hold(db):
    workspace, user = await _workspace(db), await _user(db)
    fundur_content = await _create(db, workspace, user, ContentLevel.event, "Fundur")
    fundur = await _place(db, fundur_content)
    slit = await _place(db, await _create(db, workspace, user, ContentLevel.task), parent=fundur)
    slit_id = slit.id

    await ContentService(db).delete(fundur_content.id)
    db.expunge_all()

    assert await db.get(m.Placement, slit_id) is None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_the_bank_list_filters_by_level(db):
    workspace, user = await _workspace(db), await _user(db)
    task = await _create(db, workspace, user, ContentLevel.task)
    await _create(db, workspace, user, ContentLevel.event, "Fundur")

    items = await ProgramService(db).list_content_for_workspace(
        workspace.id, user.id, filters=ProgramFilters(level=[ContentLevel.task])
    )

    assert [i.id for i in items] == [task.id]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_the_review_queue_reads_only_the_given_workspace(db):
    user = await _user(db)
    bank, plan = await _workspace(db, "Bankinn"), await _workspace(db, "Ernir")
    in_bank = await _create(db, bank, user, ContentLevel.task)
    await _create(db, plan, user, ContentLevel.task, "Í dagskrá")

    items = await ModerationService(db).queue(
        ReviewFilters(review_state=ReviewState.unreviewed, workspace_id=bank.id),
        limit=50,
        offset=0,
    )

    assert [i.id for i in items] == [in_bank.id]


def test_the_old_content_routes_are_marked_deprecated():
    deprecated = {
        (path, method)
        for path, ops in app.openapi()["paths"].items()
        for method, op in ops.items()
        if op.get("deprecated")
    }

    assert deprecated == {
        ("/workspaces/{workspace_id}/programs", "post"),
        ("/workspaces/{workspace_id}/events", "post"),
        ("/workspaces/{workspace_id}/tasks", "post"),
        ("/programs/{program_id}", "patch"),
        ("/programs/{program_id}", "delete"),
        ("/events/{event_id}", "patch"),
        ("/events/{event_id}", "delete"),
        ("/tasks/{task_id}", "patch"),
        ("/tasks/{task_id}", "delete"),
    }
