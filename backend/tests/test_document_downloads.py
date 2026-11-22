"""A document downloads for its uploader, or from an item the person can read."""

from __future__ import annotations

import datetime as dt
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.core.db import get_session
from app.domain.enums import ContentType, EventInterval, Permissions, Weekday, WorkspaceRole
from app.main import create_app
from app.models.task import Task
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMembership
from app.schemas.user import UserOut
from app.services.uploads import UploadService
from app.settings import settings
from app.utils import get_current_datetime


def _user(name: str) -> UserOut:
    return UserOut(
        id=uuid4(),
        auth0_id=f"auth0|doc_{name}_{uuid4()}",
        email=f"{name}_{uuid4()}@test.is",
        name=name,
        permissions=Permissions.viewer,
    )


@pytest.fixture
def people() -> dict[str, UserOut]:
    return {"uploader": _user("uploader"), "member": _user("member"), "outsider": _user("outsider")}


@pytest.fixture
def as_user(db):
    def client(user: UserOut) -> TestClient:
        app = create_app()

        async def override_get_session():
            yield db

        async def override_get_current_user():
            return user

        app.dependency_overrides[get_session] = override_get_session
        app.dependency_overrides[get_current_user] = override_get_current_user
        return TestClient(app)

    return client


def _blob(owner: UUID) -> str:
    return f"uploads/documents/{owner}/{uuid4()}"


def _url(blob_name: str) -> str:
    return UploadService._blob_url(settings.azure_storage_container_documents, blob_name)


async def _seed(db, people, *, hidden: bool = False, deleted: bool = False) -> tuple[UUID, str]:
    """An item in a workspace the uploader and member are in, with one document on it."""
    ws = Workspace(
        name="Fálkar",
        default_meeting_weekday=Weekday.monday,
        default_start_time=dt.time(20, 0),
        default_end_time=dt.time(21, 0),
        default_interval=EventInterval.weekly,
        season_start=dt.date.today(),
        settings=None,
        group_id=None,
    )
    db.add(ws)
    for person in people.values():
        db.add(User(id=person.id, name=person.name, auth0_id=person.auth0_id, email=person.email))
    await db.flush()
    for key in ("uploader", "member"):
        db.add(
            WorkspaceMembership(
                workspace_id=ws.id, user_id=people[key].id, role=WorkspaceRole.viewer
            )
        )
    blob_name = _blob(people["uploader"].id)
    item = Task(
        name="Ratleikur",
        created_at=get_current_datetime(),
        author_id=people["uploader"].id,
        workspace_id=ws.id,
        content_type=ContentType.task,
        media={"documents": [{"url": _url(blob_name), "name": "kort.pdf"}]},
        hidden_at=get_current_datetime() if hidden else None,
        deleted_at=get_current_datetime() if deleted else None,
    )
    db.add(item)
    await db.commit()
    return item.id, blob_name


def _download(client: TestClient, blob_name: str, content_id: UUID | None = None) -> int:
    body = {"blob_name": blob_name, "content_id": str(content_id) if content_id else None}
    return client.post("/uploads/sas/download", json=body).status_code


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_member_downloads_a_document_from_the_item(db, people, as_user):
    item_id, blob_name = await _seed(db, people)
    assert _download(as_user(people["member"]), blob_name, item_id) == 200


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_member_needs_to_name_the_item(db, people, as_user):
    _, blob_name = await _seed(db, people)
    assert _download(as_user(people["member"]), blob_name) == 404


@pytest.mark.integration
@pytest.mark.asyncio
async def test_someone_outside_the_workspace_cannot_download(db, people, as_user):
    item_id, blob_name = await _seed(db, people)
    assert _download(as_user(people["outsider"]), blob_name, item_id) == 404


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_document_not_on_the_item_is_refused(db, people, as_user):
    item_id, _ = await _seed(db, people)
    other = _blob(people["uploader"].id)
    assert _download(as_user(people["member"]), other, item_id) == 404


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_hidden_item_hides_its_documents_from_members(db, people, as_user):
    item_id, blob_name = await _seed(db, people, hidden=True)
    assert _download(as_user(people["member"]), blob_name, item_id) == 404


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_deleted_item_hides_its_documents(db, people, as_user):
    item_id, blob_name = await _seed(db, people, deleted=True)
    assert _download(as_user(people["member"]), blob_name, item_id) == 404


@pytest.mark.integration
@pytest.mark.asyncio
async def test_the_uploader_can_always_download_their_own(db, people, as_user):
    _, blob_name = await _seed(db, people, deleted=True)
    assert _download(as_user(people["uploader"]), blob_name) == 200
    assert _download(as_user(people["uploader"]), _blob(people["uploader"].id)) == 200
