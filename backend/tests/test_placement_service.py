import datetime as dt
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app import models as m
from app import schemas as s
from app.domain.enums import ContentLevel
from app.schemas.content import ContentCreateAtLevel
from app.schemas.placement import PlacementBatchItem, PlacementCreate, PlacementUpdate
from app.schemas.unit import UnitCreate
from app.services.content import ContentService
from app.services.placements import PlacementService
from app.services.units import UnitService

TUESDAY = dt.datetime(2026, 10, 13, 18, 0, tzinfo=dt.UTC)
WEEK = dt.timedelta(weeks=1)


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


async def _content(db, workspace, user, level, name="Slit", duration_min=None):
    body = ContentCreateAtLevel(
        name=name, level=level, author_id=user.id, duration_min=duration_min
    )
    return await ContentService(db).create(workspace.id, body)


async def _place(db, workspace, content, starts_at=TUESDAY, parent=None, **kw):
    body = PlacementCreate(
        content_id=content.id,
        parent_id=parent.id if parent else None,
        starts_at=starts_at,
        **kw,
    )
    return await PlacementService(db).create(workspace.id, body)


async def _fundur_with_slit(db):
    workspace, user = await _workspace(db), await _user(db)
    fundur = await _place(db, workspace, await _content(db, workspace, user, ContentLevel.event))
    slit = await _place(
        db,
        workspace,
        await _content(db, workspace, user, ContentLevel.task, duration_min=10),
        starts_at=TUESDAY + dt.timedelta(minutes=80),
        parent=fundur,
    )
    return workspace, user, fundur, slit


@pytest.mark.integration
@pytest.mark.asyncio
async def test_length_comes_from_the_content_or_its_level(db):
    _, _, fundur, slit = await _fundur_with_slit(db)

    assert fundur.ends_at - fundur.starts_at == dt.timedelta(minutes=90)
    assert slit.ends_at - slit.starts_at == dt.timedelta(minutes=10)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_content_from_another_workspace_is_refused(db):
    user = await _user(db)
    ours, theirs = await _workspace(db, "Ernir"), await _workspace(db, "Fálkar")
    slit = await _content(db, theirs, user, ContentLevel.task)

    with pytest.raises(HTTPException) as e:
        await _place(db, ours, slit)

    assert e.value.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_fundur_cannot_go_inside_a_fundur(db):
    workspace, user, fundur, _ = await _fundur_with_slit(db)
    other = await _content(db, workspace, user, ContentLevel.event, "Annar fundur")

    with pytest.raises(HTTPException) as e:
        await _place(db, workspace, other, parent=fundur)

    assert e.value.status_code == 409


@pytest.mark.integration
@pytest.mark.asyncio
async def test_moving_a_fundur_moves_what_it_holds(db):
    _, _, fundur, slit = await _fundur_with_slit(db)

    moved = await PlacementService(db).update(fundur.id, PlacementUpdate(starts_at=TUESDAY + WEEK))

    times = {p.id: (p.starts_at, p.ends_at) for p in moved}
    assert times[fundur.id] == (fundur.starts_at + WEEK, fundur.ends_at + WEEK)
    assert times[slit.id] == (slit.starts_at + WEEK, slit.ends_at + WEEK)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_new_end_alone_moves_nothing_inside(db):
    _, _, fundur, slit = await _fundur_with_slit(db)

    changed = await PlacementService(db).update(
        fundur.id, PlacementUpdate(ends_at=fundur.ends_at + dt.timedelta(minutes=30))
    )

    assert {p.id: p.starts_at for p in changed}[slit.id] == slit.starts_at


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_batch_applies_every_change(db):
    workspace, user, fundur, slit = await _fundur_with_slit(db)
    setning = await _place(
        db, workspace, await _content(db, workspace, user, ContentLevel.task), parent=fundur
    )

    changed = await PlacementService(db).update_many(
        [
            PlacementBatchItem(id=setning.id, starts_at=slit.starts_at),
            PlacementBatchItem(id=slit.id, starts_at=setning.starts_at, time_set=True),
        ]
    )

    by_id = {p.id: p for p in changed}
    assert by_id[setning.id].starts_at == slit.starts_at
    assert (by_id[slit.id].starts_at, by_id[slit.id].time_set) == (setning.starts_at, True)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_batch_with_a_bad_change_is_refused(db):
    _, _, fundur, slit = await _fundur_with_slit(db)

    with pytest.raises(HTTPException) as e:
        await PlacementService(db).update_many(
            [
                PlacementBatchItem(id=slit.id, time_set=True),
                PlacementBatchItem(id=fundur.id, ends_at=TUESDAY - dt.timedelta(hours=1)),
            ]
        )

    assert e.value.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_opening_a_season_by_date_keeps_the_matching_fundur_and_its_tasks(db):
    workspace, user = await _workspace(db), await _user(db)
    season = await _place(
        db, workspace, await _content(db, workspace, user, ContentLevel.season, "Starfsárið")
    )
    fundir = []
    for week in range(2):
        fundur = await _place(
            db,
            workspace,
            await _content(db, workspace, user, ContentLevel.event, f"Fundur {week}"),
            starts_at=TUESDAY + week * WEEK,
            parent=season,
        )
        await _place(
            db,
            workspace,
            await _content(db, workspace, user, ContentLevel.task, f"Slit {week}"),
            starts_at=TUESDAY + week * WEEK + dt.timedelta(minutes=80),
            parent=fundur,
        )
        fundir.append(fundur)

    opened = await PlacementService(db).open(
        season.id, start=TUESDAY + WEEK, end=TUESDAY + WEEK + dt.timedelta(hours=2)
    )

    assert [p.content.name for p in opened] == ["Starfsárið", "Fundur 1", "Slit 1"]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_the_workspace_list_finds_fundir_and_top_placements(db):
    workspace, _, fundur, _ = await _fundur_with_slit(db)
    svc = PlacementService(db)

    assert [p.id for p in await svc.list_for_workspace(workspace.id, top=True)] == [fundur.id]
    assert [p.id for p in await svc.list_for_workspace(workspace.id, level=[1])] == [fundur.id]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_units_are_set_and_replaced(db):
    workspace, _, _, slit = await _fundur_with_slit(db)
    units = UnitService(db)
    ernir = await units.create(workspace.id, UnitCreate(name="Ernir"))
    falkar = await units.create(workspace.id, UnitCreate(name="Fálkar"))
    svc = PlacementService(db)

    await svc.update(slit.id, PlacementUpdate(unit_ids=[ernir.id]))
    changed = await svc.update(slit.id, PlacementUpdate(unit_ids=[falkar.id]))

    assert changed[0].unit_ids == [falkar.id]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_deleted_unit_stays_on_old_placements_but_not_on_new_ones(db):
    workspace, user, fundur, slit = await _fundur_with_slit(db)
    units = UnitService(db)
    falkar = await units.create(workspace.id, UnitCreate(name="Fálkar"))
    svc = PlacementService(db)
    await svc.update(slit.id, PlacementUpdate(unit_ids=[falkar.id]))
    await units.delete(falkar.id)

    kept = await svc.update(slit.id, PlacementUpdate(unit_ids=[falkar.id], time_set=True))
    leikur = await _content(db, workspace, user, ContentLevel.task, "Leikur")
    with pytest.raises(HTTPException) as e:
        await _place(db, workspace, leikur, parent=fundur, unit_ids=[falkar.id])

    assert kept[0].unit_ids == [falkar.id]
    assert e.value.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_deleting_a_fundur_deletes_what_it_holds(db):
    workspace, _, fundur, _ = await _fundur_with_slit(db)
    svc = PlacementService(db)

    await svc.delete(fundur.id)
    db.expunge_all()

    assert await svc.list_for_workspace(workspace.id) == []
