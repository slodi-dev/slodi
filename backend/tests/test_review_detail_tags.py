"""The reading pane must open an item that has tags.

`ReviewDetail.model_validate(content)` reads every field off the ORM model, and
`Content.tags` is a property returning `Tag` objects, not strings. The service
corrected them on the next line with `model_copy(update=...)` — but validation
runs first and raised before reaching it, so in production **every tagged item
returned 500 and only untagged ones opened**: 48 of 50 in the Yfirferð queue.

Nothing caught it because every fixture here was untagged.
"""

import pytest
from sqlalchemy import select

from app import models as m
from app import schemas as s
from app.domain.enums import ReviewState
from app.services.moderation import ModerationService
from app.utils import get_current_datetime


async def _tagged_program(db, *, tag_names: list[str]):
    user = m.User(name="Signý", auth0_id=f"auth0|{id(db)}", email=f"{id(db)}@t.is")
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

    program = m.Program(
        name="Marmelaðiskeið",
        description="Allir borða marmelaði",
        created_at=get_current_datetime(),
        author_id=user.id,
        workspace_id=ws.id,
        content_type=m.ContentType.program,
        review_state=ReviewState.unreviewed,
    )
    db.add(program)
    await db.flush()

    for name in tag_names:
        tag = (await db.execute(select(m.Tag).where(m.Tag.name == name))).scalar_one_or_none()
        if tag is None:
            tag = m.Tag(name=name)
            db.add(tag)
            await db.flush()
        db.add(m.ContentTag(content_id=program.id, tag_id=tag.id))
    await db.flush()
    return program


@pytest.mark.integration
@pytest.mark.asyncio
async def test_the_pane_opens_an_item_that_has_tags(db):
    program = await _tagged_program(db, tag_names=["Leikir", "Útivist"])

    detail = await ModerationService(db).detail(program.id)

    assert sorted(detail.tags) == ["Leikir", "Útivist"]
    assert detail.name == "Marmelaðiskeið"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_the_pane_still_opens_an_item_with_no_tags(db):
    """The only two items that worked in production. Keep them working."""
    program = await _tagged_program(db, tag_names=[])

    detail = await ModerationService(db).detail(program.id)

    assert detail.tags == []
