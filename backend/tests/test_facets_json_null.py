"""An item saved with no equipment does not take the filter sidebar down.

`Content.equipment` is JSONB without `none_as_null`, so an explicit `None`
is stored as JSON `null`, not SQL NULL. The facets query unpacked every
non-NULL value with `jsonb_array_elements_text`, which raises on a scalar, so
one such row made `/content/facets` a 500 and every option list in the
sidebar — Flokkar, Búnaður, Höfundur, Staðsetning — came up empty.
"""

import pytest
from sqlalchemy import text

from app import models as m
from app import schemas as s
from app.repositories.programs import ProgramRepository
from app.utils import get_current_datetime


@pytest.mark.integration
@pytest.mark.asyncio
async def test_facets_survive_an_item_with_json_null_equipment(db):
    user = m.User(name="Jana", auth0_id="auth0|facets", email="facets@example.com")
    w_in = s.WorkspaceCreate(name="Bankinn")
    ws = m.Workspace(
        name=w_in.name,
        default_meeting_weekday=w_in.default_meeting_weekday,
        default_start_time=w_in.default_start_time,
        default_end_time=w_in.default_end_time,
        default_interval=w_in.default_interval,
        season_start=w_in.season_start,
    )
    tag = m.Tag(name="Útivera")
    db.add_all([user, ws, tag])
    await db.flush()

    def _task(name: str, equipment: list[str] | None) -> m.Task:
        return m.Task(
            name=name,
            created_at=get_current_datetime(),
            author_id=user.id,
            workspace_id=ws.id,
            content_type=m.ContentType.task,
            equipment=equipment,
        )

    bare, equipped = _task("Nafnaleikur", None), _task("Ratleikur", ["Áttaviti"])
    db.add_all([bare, equipped])
    await db.flush()
    db.add(m.ContentTag(content_id=equipped.id, tag_id=tag.id))
    await db.flush()

    stored = await db.scalar(
        text("SELECT jsonb_typeof(equipment) FROM content WHERE id = :id"), {"id": bare.id}
    )
    assert stored == "null"

    facets = await ProgramRepository(db).facets_for_workspace(ws.id)

    assert facets["tags"] == ["Útivera"]
    assert facets["equipment"] == ["Áttaviti"]
