import datetime as dt

import pytest
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app import models as m
from app import schemas as s
from app.utils import get_current_datetime


@pytest.mark.integration
@pytest.mark.asyncio
async def test_user_workspace_program_event_task_flow(db):
    # 1) Create a user (ORM normalization lowers email)
    u_in = s.UserCreate(name="Jane", auth0_id="auth0|1", email="JANE@EXAMPLE.COM")
    user = m.User(
        name=u_in.name,
        auth0_id=u_in.auth0_id,
        email=u_in.email,
        pronouns=m.Pronouns.she_her,
    )
    db.add(user)

    # 2) Create a workspace
    w_in = s.WorkspaceCreate(name="Pack 42")
    workspace = m.Workspace(
        name=w_in.name,
        default_meeting_weekday=w_in.default_meeting_weekday,
        default_start_time=w_in.default_start_time,
        default_end_time=w_in.default_end_time,
        default_interval=w_in.default_interval,
        season_start=w_in.season_start,
        settings=w_in.settings,
        group_id=w_in.group_id,
    )
    db.add(workspace)
    await db.flush()

    # 3) Program (single-table child of content)
    program = m.Program(
        name="Fall Skills",
        description=None,
        created_at=get_current_datetime(),
        author_id=user.id,
        workspace_id=workspace.id,
        content_type=m.ContentType.program,
    )
    db.add(program)
    await db.flush()

    # Ensure Content row exists & polymorphic identity set
    row = await db.scalar(select(m.Content).where(m.Content.id == program.id))
    assert row is not None and row.content_type == m.ContentType.program

    # 4) Event under program
    event = m.Event(
        name="Campout",
        description="Overnight",
        created_at=get_current_datetime(),
        author_id=user.id,
        workspace_id=workspace.id,
        program_id=program.id,
        content_type=m.ContentType.event,
        start_dt=get_current_datetime(),
        end_dt=None,
    )
    db.add(event)
    await db.flush()

    # 5) Task under event
    task = m.Task(
        name="Setup tents",
        description=None,
        created_at=get_current_datetime(),
        author_id=user.id,
        event_id=event.id,
        content_type=m.ContentType.task,
    )
    db.add(task)
    await db.commit()

    # 6) Load back and traverse relationships
    loaded = await db.execute(
        select(m.Program)
        .options(
            selectinload(m.Program.workspace),
            selectinload(m.Program.events).selectinload(m.Event.tasks),
        )
        .where(m.Program.id == program.id)
    )
    db_program = loaded.scalar_one()
    assert db_program.workspace.id == workspace.id
    assert len(db_program.events) == 1
    assert db_program.events[0].tasks[0].id == task.id


@pytest.mark.integration
@pytest.mark.asyncio
async def test_tags_and_comments_and_cascade(db):
    u = m.User(name="A", auth0_id="auth0|x", email="a@x.com")
    ws = m.Workspace(
        name="WS",
        default_meeting_weekday=m.Weekday.monday,
        default_start_time=dt.time(20, 0),
        default_end_time=dt.time(21, 0),
        default_interval=m.EventInterval.weekly,
        season_start=dt.date.today(),
        settings=None,
        group_id=None,
    )
    db.add_all([u, ws])
    await db.flush()

    p = m.Program(
        name="Prog",
        description=None,
        created_at=get_current_datetime(),
        author_id=u.id,
        workspace_id=ws.id,
        content_type=m.ContentType.program,
    )
    db.add(p)
    await db.flush()

    # Tag + association
    tag = m.Tag(name="outdoors")
    db.add(tag)
    await db.flush()

    ct = m.ContentTag(content_id=p.id, tag_id=tag.id)
    db.add(ct)

    # Comment
    comment = m.Comment(
        body="Nice idea!",
        created_at=get_current_datetime(),
        user_id=u.id,
        content_id=p.id,
    )
    db.add(comment)
    await db.commit()

    # Verify associations exist
    tags = await db.execute(select(m.Tag).join(m.ContentTag).where(m.ContentTag.content_id == p.id))
    assert tags.scalars().one().name == "outdoors"

    comments = await db.execute(select(m.Comment).where(m.Comment.content_id == p.id))
    assert comments.scalars().one().body == "Nice idea!"

    # Soft-delete the program directly (simulating what the repository does)
    p.deleted_at = get_current_datetime()
    await db.commit()

    # Program should not appear in a filtered query
    gone = await db.scalar(
        select(m.Program).where(m.Program.id == p.id, m.Program.deleted_at.is_(None))
    )
    assert gone is None

    # But the row still exists in the DB (soft delete, not hard delete)
    still_exists = await db.scalar(select(m.Program).where(m.Program.id == p.id))
    assert still_exists is not None
    assert still_exists.deleted_at is not None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_group_membership_and_troops(db):
    g = m.Group(name="Parents")
    u = m.User(name="B", auth0_id="auth0|2", email="b@example.com")
    ws = m.Workspace(
        name="WS2",
        default_meeting_weekday=m.Weekday.monday,
        default_start_time=dt.time(20, 0),
        default_end_time=dt.time(21, 0),
        default_interval=m.EventInterval.weekly,
        season_start=dt.date.today(),
        settings=None,
        group_id=None,
    )
    db.add_all([g, u, ws])
    await db.flush()

    # Membership
    gm = m.GroupMembership(user_id=u.id, group_id=g.id, role=m.GroupRole.viewer)
    db.add(gm)

    # Troop and participation on an event
    p = m.Program(
        name="Prog2",
        description=None,
        created_at=get_current_datetime(),
        author_id=u.id,
        workspace_id=ws.id,
        content_type=m.ContentType.program,
    )
    e = m.Event(
        name="Hike",
        description=None,
        created_at=get_current_datetime(),
        author_id=u.id,
        workspace_id=ws.id,
        program=p,
        content_type=m.ContentType.event,
        start_dt=get_current_datetime(),
        end_dt=None,
    )
    tr = m.Troop(name="Foxes", workspace_id=ws.id)
    db.add_all([p, e, tr])
    await db.flush()

    tp = m.TroopParticipation(troop_id=tr.id, event_id=e.id)
    db.add(tp)
    await db.commit()

    # Simple fetches
    res = await db.execute(select(m.Group).where(m.Group.id == g.id))
    assert res.scalar_one().name == "Parents"

    res = await db.execute(
        select(m.TroopParticipation).where(m.TroopParticipation.troop_id == tr.id)
    )
    assert res.scalar_one().event_id == e.id
