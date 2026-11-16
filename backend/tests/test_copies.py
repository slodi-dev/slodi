import datetime as dt
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app import models as m
from app import schemas as s
from app.domain.enums import ContentLevel
from app.schemas.content import ContentCreateAtLevel
from app.schemas.copy import CopyCreate
from app.schemas.placement import PlacementCreate, PlacementUpdate
from app.schemas.unit import UnitCreate
from app.services.content import ContentService
from app.services.copies import CopyService
from app.services.placements import PlacementService
from app.services.units import UnitService
from app.utils import get_current_datetime

BANK_MONDAY = dt.datetime(2000, 1, 3, 18, 0, tzinfo=dt.UTC)
WEEK = dt.timedelta(weeks=1)


async def _workspace(db, name):
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


async def _content(db, workspace, user, level, name):
    body = ContentCreateAtLevel(name=name, level=level, author_id=user.id)
    return await ContentService(db).create(workspace.id, body)


async def _place(db, workspace, content, starts_at, parent=None, unit_ids=()):
    body = PlacementCreate(
        content_id=content.id,
        parent_id=parent.id if parent else None,
        starts_at=starts_at,
        unit_ids=list(unit_ids),
    )
    return await PlacementService(db).create(workspace.id, body)


async def _bank_idea(db):
    """A dagskrárhringur in the bank: two fundir a week apart, each with Slit."""
    bank, user = await _workspace(db, "Bankinn"), await _user(db)
    falkar = await UnitService(db).create(bank.id, UnitCreate(name="Fálkar"))
    hringur = await _content(db, bank, user, ContentLevel.program, "Rötun")
    slit = await _content(db, bank, user, ContentLevel.task, "Slit")
    top = await _place(db, bank, hringur, BANK_MONDAY)
    for week in range(2):
        fundur = await _place(
            db,
            bank,
            await _content(db, bank, user, ContentLevel.event, f"Fundur {week + 1}"),
            BANK_MONDAY + week * WEEK + dt.timedelta(days=1),
            parent=top,
        )
        await _place(
            db,
            bank,
            slit,
            fundur.starts_at + dt.timedelta(minutes=80),
            parent=fundur,
            unit_ids=[falkar.id],
        )
    return bank, user, hringur, slit


@pytest.mark.integration
@pytest.mark.asyncio
async def test_copying_an_idea_copies_its_content_and_structure(db):
    _, user, hringur, slit = await _bank_idea(db)
    ernir = await _workspace(db, "Ernir")
    tuesday = dt.datetime(2026, 10, 13, 18, 0, tzinfo=dt.UTC)

    copy = await CopyService(db).copy(
        ernir.id, CopyCreate(source_id=hringur.id, starts_at=tuesday), user.id
    )

    names = [p.content.name for p in copy.placements]
    assert copy.content.copied_from_id == hringur.id
    assert names == ["Rötun", "Fundur 1", "Slit", "Fundur 2", "Slit"]
    assert all(p.workspace_id == ernir.id for p in copy.placements)
    slits = [p for p in copy.placements if p.content.name == "Slit"]
    assert slits[0].content.id == slits[1].content.id != slit.id
    fundur_1 = copy.placements[1]
    assert (fundur_1.starts_at.weekday(), fundur_1.starts_at.time()) == (1, dt.time(18, 0))
    assert fundur_1.starts_at.date() == dt.date(2026, 10, 13)
    assert all(p.unit_ids == [] for p in copy.placements)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_piece_you_already_have_can_be_reused(db):
    _, user, hringur, slit = await _bank_idea(db)
    ernir = await _workspace(db, "Ernir")
    svc = CopyService(db)
    mine = (await svc.copy(ernir.id, CopyCreate(source_id=slit.id), user.id)).content

    preview = await svc.preview(ernir.id, hringur.id)
    copy = await svc.copy(
        ernir.id, CopyCreate(source_id=hringur.id, reuse={slit.id: mine.id}), user.id
    )

    assert [(a.source_id, a.existing_id) for a in preview.already_have] == [(slit.id, mine.id)]
    assert {p.content.id for p in copy.placements if p.content.name == "Slit"} == {mine.id}


@pytest.mark.integration
@pytest.mark.asyncio
async def test_reusing_content_of_another_level_is_refused(db):
    _, user, hringur, slit = await _bank_idea(db)
    ernir = await _workspace(db, "Ernir")
    fundur = await _content(db, ernir, user, ContentLevel.event, "Minn fundur")

    with pytest.raises(HTTPException) as e:
        await CopyService(db).copy(
            ernir.id, CopyCreate(source_id=hringur.id, reuse={slit.id: fundur.id}), user.id
        )

    assert e.value.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_single_item_is_copied_and_placed_where_it_was_dropped(db):
    bank, user = await _workspace(db, "Bankinn"), await _user(db)
    leikur = await _content(db, bank, user, ContentLevel.task, "Leikur")
    ernir = await _workspace(db, "Ernir")
    tuesday = dt.datetime(2026, 10, 13, 18, 0, tzinfo=dt.UTC)
    fundur = await _place(
        db, ernir, await _content(db, ernir, user, ContentLevel.event, "Fundur"), tuesday
    )
    at = tuesday + dt.timedelta(minutes=10)

    copy = await CopyService(db).copy(
        ernir.id, CopyCreate(source_id=leikur.id, parent_id=fundur.id, starts_at=at), user.id
    )

    assert [(p.parent_id, p.starts_at) for p in copy.placements] == [(fundur.id, at)]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_hidden_piece_is_left_out(db):
    _, user, hringur, slit = await _bank_idea(db)
    hidden = await db.get(m.Content, slit.id)
    hidden.hidden_at = get_current_datetime()
    await db.flush()
    ernir = await _workspace(db, "Ernir")

    copy = await CopyService(db).copy(ernir.id, CopyCreate(source_id=hringur.id), user.id)

    assert [p.content.name for p in copy.placements] == ["Rötun", "Fundur 1", "Fundur 2"]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_copy_weekly_shares_content_but_not_placements(db):
    ernir, user = await _workspace(db, "Ernir"), await _user(db)
    tuesday = dt.datetime(2026, 10, 13, 18, 0, tzinfo=dt.UTC)
    fundur = await _place(
        db, ernir, await _content(db, ernir, user, ContentLevel.event, "Fundur"), tuesday
    )
    slit = await _place(
        db,
        ernir,
        await _content(db, ernir, user, ContentLevel.task, "Slit"),
        tuesday + dt.timedelta(minutes=80),
        parent=fundur,
    )
    svc = PlacementService(db)

    copies = await svc.copy(fundur.id, [tuesday + WEEK, tuesday + 2 * WEEK], None, same_parent=True)
    week_2 = await svc.open(copies[0].id)

    assert [c.content.id for c in copies] == [fundur.content.id, fundur.content.id]
    assert [p.starts_at for p in week_2] == [tuesday + WEEK, slit.starts_at + WEEK]
    assert week_2[1].id != slit.id and week_2[1].content.id == slit.content.id


@pytest.mark.integration
@pytest.mark.asyncio
async def test_own_version_splits_one_placement_off(db):
    ernir, user = await _workspace(db, "Ernir"), await _user(db)
    tuesday = dt.datetime(2026, 10, 13, 18, 0, tzinfo=dt.UTC)
    slit = await _content(db, ernir, user, ContentLevel.task, "Slit")
    first = await _place(db, ernir, slit, tuesday)
    second = await _place(db, ernir, slit, tuesday + WEEK)
    svc = PlacementService(db)

    mine = await svc.own_version(second.id, user.id)
    await svc.update(first.id, PlacementUpdate(time_set=True))

    copied = await ContentService(db).get(mine.content.id)
    assert mine.content.id != slit.id and copied.copied_from_id == slit.id
    assert (await svc.open(first.id))[0].content.id == slit.id
