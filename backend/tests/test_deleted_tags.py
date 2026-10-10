"""A deleted tag is gone from everywhere, and its name can be used again — sc-540.

Deleting a tag only set `deleted_at`. Its `content_tags` rows stayed, and
`Content.tags`, the filter sidebar's facets and the tag filter all read through
them without looking at `deleted_at`, so the tag kept showing on items and
kept matching. And `uq_tag_name` covered deleted rows too, so the name could
never be created again.
"""

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app import models as m
from app import schemas as s
from app.repositories.programs import ProgramRepository
from app.repositories.tags import TagRepository
from app.schemas.program import ProgramFilters
from app.schemas.tag import TagCreate
from app.services.tags import TagService
from app.utils import get_current_datetime


async def _tagged_task(db, tag_name="Útivera"):
    user = m.User(name="Jana", auth0_id="auth0|sc-540", email="sc540@example.com")
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
    tag = m.Tag(name=tag_name)
    db.add_all([ws, tag])
    await db.flush()
    task = m.Task(
        name="Ratleikur",
        created_at=get_current_datetime(),
        author_id=user.id,
        workspace_id=ws.id,
        content_type=m.ContentType.task,
    )
    db.add(task)
    await db.flush()
    db.add(m.ContentTag(content_id=task.id, tag_id=tag.id))
    await db.flush()
    return ws, task, tag


async def _assert_tag_gone(db, ws, task, tag_name):
    db.expunge_all()
    programs = ProgramRepository(db)

    facets = await programs.facets_for_workspace(ws.id)
    assert tag_name not in facets["tags"]
    assert await programs.count_content_for_workspace(ws.id, ProgramFilters(tags=[tag_name])) == 0
    assert await TagRepository(db).count_content_tags(task.id) == 0

    loaded = (
        await db.execute(
            select(m.Content)
            .options(selectinload(m.Content.content_tags).selectinload(m.ContentTag.tag))
            .where(m.Content.id == task.id)
        )
    ).scalar_one()
    assert loaded.tags == []


@pytest.mark.integration
@pytest.mark.asyncio
async def test_deleting_a_tag_removes_it_from_items_facets_and_filters(db):
    ws, task, tag = await _tagged_task(db)
    # Sanity: before deleting, it is everywhere.
    assert "Útivera" in (await ProgramRepository(db).facets_for_workspace(ws.id))["tags"]

    await TagService(db).delete(tag.id)

    links = (
        (await db.execute(select(m.ContentTag).where(m.ContentTag.tag_id == tag.id)))
        .scalars()
        .all()
    )
    assert links == []
    await _assert_tag_gone(db, ws, task, "Útivera")


@pytest.mark.integration
@pytest.mark.asyncio
async def test_links_left_by_an_earlier_delete_are_ignored(db):
    """Tags deleted before the fix still have their content_tags rows."""
    ws, task, tag = await _tagged_task(db, "Gamalt")
    tag.deleted_at = get_current_datetime()
    await db.flush()

    await _assert_tag_gone(db, ws, task, "Gamalt")


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_deleted_tags_name_can_be_used_again(db):
    svc = TagService(db)
    first = await svc.create(TagCreate(name="Sund"))
    await svc.delete(first.id)

    again = await svc.create(TagCreate(name="Sund"))

    assert again.id != first.id
    assert again.name == "Sund"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_two_live_tags_still_cannot_share_a_name(db):
    svc = TagService(db)
    await svc.create(TagCreate(name="Hnútar"))

    with pytest.raises(HTTPException) as exc:
        await svc.create(TagCreate(name="Hnútar"))

    assert exc.value.status_code == 409


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_deleted_tag_cannot_be_attached(db):
    _, task, tag = await _tagged_task(db, "Horfið")
    other = m.Tag(name="Annað", deleted_at=get_current_datetime())
    db.add(other)
    await db.flush()

    with pytest.raises(HTTPException) as exc:
        await TagService(db).add_content_tag(task.id, other.id)

    assert exc.value.status_code == 404
