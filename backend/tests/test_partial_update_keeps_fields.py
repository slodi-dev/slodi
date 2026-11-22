"""A PATCH that names one field leaves every other field alone — see sc-530.

Editing an item from its bank card wiped its leiðbeiningar and attachments.
The frontend sent `instructions: null` and a rebuilt `media` it had never
loaded; the backend did exactly what it was told. These tests pin the backend's
half of the contract against a real Postgres:

* an absent key means "leave this alone" (`model_dump(exclude_unset=True)`);
* an explicit `null` still means "clear it", because clearing a field from the
  edit form has to keep working.

Run with:
    PYTHONPATH=. uv run pytest tests/test_partial_update_keeps_fields.py -q -m integration
"""

from __future__ import annotations

import datetime as dt
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.core.db import get_session
from app.domain.enums import ContentType, EventInterval, Permissions, Weekday
from app.main import create_app
from app.models.content import Content
from app.models.event import Event
from app.models.program import Program
from app.models.task import Task
from app.models.user import User
from app.models.workspace import Workspace
from app.schemas.user import UserOut
from app.utils import get_current_datetime

_ADMIN_ID = uuid4()
_ADMIN_USER = UserOut(
    id=_ADMIN_ID,
    auth0_id="auth0|sc530_admin",
    email="sc530_admin@test.com",
    name="Sigurður",
    pronouns=None,
    permissions=Permissions.admin,
    preferences=None,
)

INSTRUCTIONS = "1. Slökkvið ljósin.\n2. Felið fánann.\n3. Finnið hann."
MEDIA = {
    "images": [
        {"name": "Forsíða", "url": "https://example.test/hero.jpg", "content_type": "image/jpeg"},
        {"name": "Aukamynd", "url": "https://example.test/extra.jpg", "content_type": "image/jpeg"},
    ],
    "documents": [
        {
            "name": "Leikreglur.pdf",
            "url": "https://example.test/leikreglur.pdf",
            "content_type": "application/pdf",
        }
    ],
}

# (model, PATCH route prefix, content type)
KINDS = [
    pytest.param(Program, "programs", ContentType.program, id="program"),
    pytest.param(Event, "events", ContentType.event, id="event"),
    pytest.param(Task, "tasks", ContentType.task, id="task"),
]


@pytest.fixture
def http(db):
    app = create_app()

    async def override_get_session():
        yield db

    async def override_get_current_user():
        return _ADMIN_USER

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_current_user
    return TestClient(app)


async def _seed(db, model: type[Content], content_type: ContentType) -> Content:
    db.add(User(id=_ADMIN_ID, name="Sigurður", auth0_id=_ADMIN_USER.auth0_id, email="s@test.is"))
    ws = Workspace(
        name="Dagskrárbankinn",
        default_meeting_weekday=Weekday.monday,
        default_start_time=dt.time(20, 0),
        default_end_time=dt.time(21, 0),
        default_interval=EventInterval.weekly,
        season_start=dt.date.today(),
        settings=None,
        group_id=None,
    )
    db.add(ws)
    await db.flush()
    item = model(
        name="Fánaleikur í myrkri",
        description="Leikur í myrkri",
        instructions=INSTRUCTIONS,
        image=MEDIA["images"][0]["url"],
        media=MEDIA,
        created_at=get_current_datetime(),
        author_id=_ADMIN_ID,
        workspace_id=ws.id,
        content_type=content_type,
    )
    db.add(item)
    await db.commit()
    return item


async def _reload(db, item_id) -> Content:
    db.expire_all()
    row = await db.get(Content, item_id)
    assert row is not None
    return row


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.parametrize("model,route,content_type", KINDS)
async def test_renaming_keeps_instructions_and_media(http, db, model, route, content_type):
    item = await _seed(db, model, content_type)

    resp = http.patch(f"/{route}/{item.id}", json={"name": "Fánaleikur í myrkri (uppfært)"})
    assert resp.status_code == 200, resp.text

    body = resp.json()
    assert body["name"] == "Fánaleikur í myrkri (uppfært)"
    assert body["instructions"] == INSTRUCTIONS
    assert body["media"] == MEDIA

    stored = await _reload(db, item.id)
    assert stored.instructions == INSTRUCTIONS
    assert stored.media == MEDIA
    assert stored.image == MEDIA["images"][0]["url"]
    assert stored.description == "Leikur í myrkri"


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.parametrize("model,route,content_type", KINDS)
async def test_explicit_null_still_clears_instructions(http, db, model, route, content_type):
    """Clearing a field from the form must keep working: null is not ignored."""
    item = await _seed(db, model, content_type)

    resp = http.patch(f"/{route}/{item.id}", json={"instructions": None})
    assert resp.status_code == 200, resp.text
    assert resp.json()["instructions"] is None

    stored = await _reload(db, item.id)
    assert stored.instructions is None
    # …and only that field.
    assert stored.media == MEDIA
    assert stored.name == "Fánaleikur í myrkri"
