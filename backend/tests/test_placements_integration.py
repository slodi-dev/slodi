import datetime as dt
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app import models as m
from app import schemas as s
from app.domain.enums import ContentLevel
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


async def _content(db, cls, workspace, user, name="Slit"):
    item = cls(
        name=name,
        created_at=get_current_datetime(),
        author_id=user.id,
        workspace_id=workspace.id,
    )
    db.add(item)
    await db.flush()
    return item


async def _placement(db, content, parent=None, workspace_id=None):
    placement = m.Placement(
        workspace_id=workspace_id or content.workspace_id,
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


async def _unit(db, workspace, parent=None, color="#2f8f4e"):
    unit = m.Unit(
        workspace_id=workspace.id,
        parent_id=parent.id if parent else None,
        name="Fálkar",
        color=color,
        created_at=get_current_datetime(),
    )
    db.add(unit)
    await db.flush()
    return unit


@pytest.mark.integration
@pytest.mark.asyncio
async def test_new_content_takes_its_level_from_its_type(db):
    workspace, user = await _workspace(db), await _user(db)

    task = await _content(db, m.Task, workspace, user)
    event = await _content(db, m.Event, workspace, user)
    program = await _content(db, m.Program, workspace, user)

    assert (task.level, event.level, program.level) == (
        ContentLevel.task,
        ContentLevel.event,
        ContentLevel.program,
    )


@pytest.mark.integration
@pytest.mark.asyncio
async def test_task_placed_in_an_event(db):
    workspace, user = await _workspace(db), await _user(db)
    fundur = await _placement(db, await _content(db, m.Event, workspace, user, "Fundur"))

    slit = await _placement(db, await _content(db, m.Task, workspace, user), parent=fundur)

    assert slit.parent_level == ContentLevel.event


@pytest.mark.integration
@pytest.mark.asyncio
async def test_placement_level_must_be_below_its_parent(db):
    workspace, user = await _workspace(db), await _user(db)
    fundur = await _placement(db, await _content(db, m.Event, workspace, user, "Fundur"))
    other_fundur = await _content(db, m.Event, workspace, user, "Annar fundur")

    with pytest.raises(IntegrityError, match="ck_placements_level_below_parent"):
        await _placement(db, other_fundur, parent=fundur)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_placement_in_another_workspace_is_refused(db):
    user = await _user(db)
    ours, theirs = await _workspace(db, "Ernir"), await _workspace(db, "Fálkar")
    slit = await _content(db, m.Task, theirs, user)

    with pytest.raises(IntegrityError, match="fk_placements_content"):
        await _placement(db, slit, workspace_id=ours.id)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_raising_a_placed_items_level_past_its_parent_is_refused(db):
    workspace, user = await _workspace(db), await _user(db)
    fundur = await _placement(db, await _content(db, m.Event, workspace, user, "Fundur"))
    slit = await _content(db, m.Task, workspace, user)
    await _placement(db, slit, parent=fundur)

    slit.level = ContentLevel.event
    with pytest.raises(IntegrityError, match="ck_placements_level_below_parent"):
        await db.flush()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_deleting_a_placement_deletes_what_it_holds(db):
    workspace, user = await _workspace(db), await _user(db)
    fundur = await _placement(db, await _content(db, m.Event, workspace, user, "Fundur"))
    slit = await _placement(db, await _content(db, m.Task, workspace, user), parent=fundur)
    slit_id = slit.id

    await db.delete(fundur)
    await db.flush()
    db.expunge_all()

    assert await db.scalar(select(m.Placement).where(m.Placement.id == slit_id)) is None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_unit_parent_in_another_workspace_is_refused(db):
    ours, theirs = await _workspace(db, "Ernir"), await _workspace(db, "Fálkar")
    sveit = await _unit(db, theirs)

    with pytest.raises(IntegrityError, match="fk_units_parent"):
        await _unit(db, ours, parent=sveit)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_unit_colour_must_be_hex(db):
    workspace = await _workspace(db)

    with pytest.raises(IntegrityError, match="ck_units_color_hex"):
        await _unit(db, workspace, color="green")
