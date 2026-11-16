import pytest
from fastapi import HTTPException

from app import models as m
from app import schemas as s
from app.domain.unit_constraints import PALETTE
from app.schemas.unit import UnitCreate, UnitUpdate
from app.services.units import UnitService


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


@pytest.mark.integration
@pytest.mark.asyncio
async def test_new_units_take_unused_palette_colours(db):
    workspace = await _workspace(db)
    svc = UnitService(db)

    first = await svc.create(workspace.id, UnitCreate(name="Sveitin"))
    second = await svc.create(workspace.id, UnitCreate(name="Fálkar", parent_id=first.id))

    assert [first.color, second.color] == list(PALETTE[:2])


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_chosen_colour_is_kept_in_lowercase(db):
    workspace = await _workspace(db)

    unit = await UnitService(db).create(workspace.id, UnitCreate(name="Ernir", color="#2F8F4E"))

    assert unit.color == "#2f8f4e"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_parent_from_another_workspace_is_refused(db):
    ours, theirs = await _workspace(db, "Ernir"), await _workspace(db, "Fálkar")
    svc = UnitService(db)
    sveit = await svc.create(theirs.id, UnitCreate(name="Sveitin"))

    with pytest.raises(HTTPException) as e:
        await svc.create(ours.id, UnitCreate(name="Flokkur", parent_id=sveit.id))

    assert e.value.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_unit_cannot_move_inside_itself(db):
    workspace = await _workspace(db)
    svc = UnitService(db)
    sveit = await svc.create(workspace.id, UnitCreate(name="Sveitin"))
    flokkur = await svc.create(workspace.id, UnitCreate(name="Fálkar", parent_id=sveit.id))

    with pytest.raises(HTTPException) as e:
        await svc.update(sveit.id, UnitUpdate(parent_id=flokkur.id))

    assert e.value.status_code == 409


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_unit_can_move_to_the_top(db):
    workspace = await _workspace(db)
    svc = UnitService(db)
    sveit = await svc.create(workspace.id, UnitCreate(name="Sveitin"))
    flokkur = await svc.create(workspace.id, UnitCreate(name="Fálkar", parent_id=sveit.id))

    moved = await svc.update(flokkur.id, UnitUpdate(parent_id=None))

    assert moved.parent_id is None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_deleting_a_unit_deletes_the_units_under_it(db):
    workspace = await _workspace(db)
    svc = UnitService(db)
    sveit = await svc.create(workspace.id, UnitCreate(name="Sveitin"))
    await svc.create(workspace.id, UnitCreate(name="Fálkar", parent_id=sveit.id))
    other = await svc.create(workspace.id, UnitCreate(name="Drekar"))

    await svc.delete(sveit.id)
    db.expunge_all()

    assert [u.id for u in await svc.list_for_workspace(workspace.id)] == [other.id]
    kept = await svc.list_for_workspace(workspace.id, include_deleted=True)
    assert [u.name for u in kept if u.deleted_at is not None] == ["Sveitin", "Fálkar"]
