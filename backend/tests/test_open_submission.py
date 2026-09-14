"""Opening the bank to submissions from anyone with an account.

The bank used to require workspace `editor` to create anything, while every new
account is auto-joined to the default workspace as `viewer` — so nobody outside
the dev team could submit. Lowering create to `viewer` is only safe alongside
tightening edit and delete, because `editor` used to be enough to change
*someone else's* content. These tests pin both halves.
"""

from datetime import date, datetime, time, timedelta, timezone
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException, status
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.auth import check_content_edit_access, get_current_user
from app.core.db import get_session
from app.domain.enums import EventInterval, Permissions, Weekday, WorkspaceRole
from app.main import create_app
from app.schemas.event import EventOut
from app.schemas.task import TaskOut
from app.schemas.user import UserOut
from app.schemas.workspace import WorkspaceNested

ROLE_LOOKUP = "app.core.auth._get_workspace_role"


@pytest.fixture
def member_client(mock_db_session, viewer_user):
    """Authenticated as a plain account: platform `viewer`, no admin bypass."""
    app = create_app()

    async def override_get_session():
        yield mock_db_session

    async def override_get_current_user():
        return viewer_user

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_current_user
    return TestClient(app)


def _make_task(workspace_id, author_id, created_at=None):
    return TaskOut(
        content_type="task",
        id=uuid4(),
        workspace_id=workspace_id,
        name="Kveikjuleikur",
        author_id=author_id,
        author_name="Viewer User",
        created_at=created_at or datetime.now(timezone.utc),
        author=UserOut(
            id=author_id, name="Viewer User", email="viewer@test.com", auth0_id="auth0|viewer_test"
        ),
        workspace=WorkspaceNested(id=workspace_id, name="Dagskrárbankinn"),
    )


def _make_event(workspace_id, author_id, start_dt=None):
    return EventOut(
        content_type="event",
        id=uuid4(),
        workspace_id=workspace_id,
        name="Vetrarútilega",
        author_id=author_id,
        author_name="Viewer User",
        created_at=datetime.now(timezone.utc),
        start_dt=start_dt,
        program_id=None,
        author=UserOut(
            id=author_id, name="Viewer User", email="viewer@test.com", auth0_id="auth0|viewer_test"
        ),
        workspace=WorkspaceNested(id=workspace_id, name="Dagskrárbankinn"),
    )


async def _edit_access(role, *, is_author, permissions=Permissions.viewer, hide=False):
    """Run check_content_edit_access with a fixed workspace role."""
    author_id = uuid4()
    user = UserOut(
        id=author_id if is_author else uuid4(),
        auth0_id="auth0|t",
        email="t@test.com",
        name="T",
        permissions=permissions,
    )
    with patch(ROLE_LOOKUP, new_callable=AsyncMock) as lookup:
        lookup.return_value = role
        await check_content_edit_access(
            uuid4(), author_id, user, AsyncMock(), hide_from_non_members=hide
        )


# ── Who may change content ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_author_may_edit_own_content_at_viewer_role():
    """The whole point: bank authors are viewers, and must be able to fix their own item."""
    await _edit_access(WorkspaceRole.viewer, is_author=True)


@pytest.mark.asyncio
async def test_workspace_admin_may_edit_someone_elses_content():
    await _edit_access(WorkspaceRole.admin, is_author=False)


@pytest.mark.asyncio
async def test_platform_admin_may_edit_without_membership():
    with patch(ROLE_LOOKUP, new_callable=AsyncMock) as lookup:
        lookup.return_value = None
        await _edit_access(None, is_author=False, permissions=Permissions.admin)


@pytest.mark.asyncio
async def test_editor_may_not_edit_someone_elses_content():
    """The regression this ticket exists to prevent.

    `editor` used to be enough to PATCH any event or task in the workspace. With
    submission open to every account, that would have let any member rewrite any
    item in the bank.
    """
    with pytest.raises(HTTPException) as exc:
        await _edit_access(WorkspaceRole.editor, is_author=False)
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_viewer_may_not_edit_someone_elses_content():
    with pytest.raises(HTTPException) as exc:
        await _edit_access(WorkspaceRole.viewer, is_author=False)
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_non_member_is_hidden_rather_than_refused_when_asked():
    with pytest.raises(HTTPException) as exc:
        await _edit_access(None, is_author=False, hide=True)
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND


# ── Creating ─────────────────────────────────────────────────────────────────

BANK_ID = uuid4()


@pytest.fixture
def bank(monkeypatch):
    """Make BANK_ID the default workspace — the one open to submissions."""
    monkeypatch.setattr("app.core.auth._DEFAULT_WORKSPACE_ID", BANK_ID)
    return BANK_ID


def _post_task(client, workspace_id, role, **body):
    with (
        patch(ROLE_LOOKUP, new_callable=AsyncMock) as lookup,
        patch(
            "app.services.tasks.TaskService.create_under_workspace", new_callable=AsyncMock
        ) as create,
    ):
        lookup.return_value = role
        create.return_value = _make_task(workspace_id, uuid4())
        response = client.post(
            f"/workspaces/{workspace_id}/tasks", json={"name": "Kveikjuleikur", **body}
        )
    return response, create


def test_viewer_can_submit_to_the_bank(member_client, bank):
    response, _ = _post_task(member_client, bank, WorkspaceRole.viewer)
    assert response.status_code == status.HTTP_201_CREATED


def test_viewer_cannot_create_in_an_ordinary_workspace(member_client, bank):
    """Opening the bank must not delete the read-only role everywhere else.

    A sveit that adds a co-leader, a parent or an outside helper as `viewer` so
    they can read the plan has not agreed to let them write to it. If `viewer`
    could create anywhere, `editor` would grant nothing that `viewer` did not.
    """
    response, _ = _post_task(member_client, uuid4(), WorkspaceRole.viewer)
    # 403, not 404: they *are* a member, so there is nothing to hide from them.
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_editor_can_still_create_in_an_ordinary_workspace(member_client, bank):
    response, _ = _post_task(member_client, uuid4(), WorkspaceRole.editor)
    assert response.status_code == status.HTTP_201_CREATED


def test_create_ignores_a_backdated_created_at(member_client, bank):
    """The review queue is ordered oldest-first, so a backdated item would jump it."""
    backdated = datetime(2020, 1, 1, tzinfo=timezone.utc)
    _, create = _post_task(
        member_client, bank, WorkspaceRole.viewer, created_at=backdated.isoformat()
    )

    stored = create.await_args.args[1]
    assert stored.created_at != backdated
    assert datetime.now(timezone.utc) - stored.created_at < timedelta(minutes=1)


def test_create_ignores_an_author_id_in_the_body(member_client, bank, viewer_user):
    _, create = _post_task(member_client, bank, WorkspaceRole.viewer, author_id=str(uuid4()))
    assert create.await_args.args[1].author_id == viewer_user.id


def test_non_member_cannot_create(member_client, bank):
    with patch(ROLE_LOOKUP, new_callable=AsyncMock) as lookup:
        lookup.return_value = None
        response = member_client.post(f"/workspaces/{bank}/tasks", json={"name": "Nei"})
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_attaching_a_task_to_someone_elses_event_still_needs_editor(member_client, bank):
    """Submitting to the bank is not the same as editing another leader's plan.

    Every account is a `viewer` in the bank, so if the parent-scoped create
    routes were open at `viewer` too, anyone could graft liðir onto anyone
    else's fundur — and `check_content_edit_access` would then let only the
    child's own author remove them again.
    """
    event = _make_task(bank, author_id=uuid4())
    with (
        patch(ROLE_LOOKUP, new_callable=AsyncMock) as lookup,
        patch("app.services.events.EventService.get", new_callable=AsyncMock) as get,
    ):
        lookup.return_value = WorkspaceRole.viewer
        get.return_value = event
        response = member_client.post(f"/events/{event.id}/tasks", json={"name": "Nei"})
    assert response.status_code == status.HTTP_403_FORBIDDEN


# ── Editing and deleting through the router ──────────────────────────────────


@pytest.mark.parametrize("method", ["patch", "delete"])
def test_viewer_cannot_change_another_users_task(method, member_client):
    task = _make_task(uuid4(), author_id=uuid4())  # someone else's
    with (
        patch(ROLE_LOOKUP, new_callable=AsyncMock) as lookup,
        patch("app.services.tasks.TaskService.get", new_callable=AsyncMock) as get,
    ):
        lookup.return_value = WorkspaceRole.viewer
        get.return_value = task
        call = getattr(member_client, method)
        response = call(
            f"/tasks/{task.id}", **({"json": {"name": "x"}} if method == "patch" else {})
        )
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.parametrize("method", ["patch", "delete"])
def test_author_can_change_their_own_task_at_viewer_role(method, member_client, viewer_user):
    """An author must be able to fix or withdraw their own submission.

    Deleting used to require workspace `admin`, which meant a leader could file
    an idea into the open bank and then not be able to take it back.
    """
    task = _make_task(uuid4(), author_id=viewer_user.id)
    with (
        patch(ROLE_LOOKUP, new_callable=AsyncMock) as lookup,
        patch("app.services.tasks.TaskService.get", new_callable=AsyncMock) as get,
        patch("app.services.tasks.TaskService.update", new_callable=AsyncMock) as update,
        patch("app.services.tasks.TaskService.delete", new_callable=AsyncMock),
    ):
        lookup.return_value = WorkspaceRole.viewer
        get.return_value = task
        update.return_value = task
        call = getattr(member_client, method)
        response = call(
            f"/tasks/{task.id}", **({"json": {"name": "x"}} if method == "patch" else {})
        )
    assert response.status_code in (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT)


# ── Authorship cannot be handed to someone else ──────────────────────────────


def test_patch_cannot_reassign_authorship(member_client, viewer_user):
    """Authorship is not editable, and must not become editable.

    The update services apply a patch with `setattr` over
    `model_dump(exclude_unset=True)`, so any field on `ContentUpdate` reaches the
    row. While the bank was closed this was an editor-only concern. Now that
    anyone can create and edit their own submissions, an `author_id` on the body
    would let someone hand a submission — and, once the review board lands, its
    strikes — to another leader.
    """
    task = _make_task(uuid4(), author_id=viewer_user.id)
    victim_id = uuid4()

    with (
        patch(ROLE_LOOKUP, new_callable=AsyncMock) as lookup,
        patch("app.services.tasks.TaskService.get", new_callable=AsyncMock) as get,
        patch("app.services.tasks.TaskService.update", new_callable=AsyncMock) as update,
    ):
        lookup.return_value = WorkspaceRole.viewer
        get.return_value = task
        update.return_value = task

        response = member_client.patch(
            f"/tasks/{task.id}",
            json={"name": "Kveikjuleikur", "author_id": str(victim_id)},
        )

    assert response.status_code == status.HTTP_200_OK
    body = update.await_args.args[1]
    assert "author_id" not in body.model_fields_set
    assert not hasattr(body, "author_id")


# ── A bank Viðburður has no date ─────────────────────────────────────────────


def _post_event(client, workspace_id, role, **body):
    with (
        patch(ROLE_LOOKUP, new_callable=AsyncMock) as lookup,
        patch(
            "app.services.events.EventService.create_under_workspace", new_callable=AsyncMock
        ) as create,
    ):
        lookup.return_value = role
        create.return_value = _make_event(workspace_id, uuid4())
        response = client.post(
            f"/workspaces/{workspace_id}/events", json={"name": "Vetrarútilega", **body}
        )
    return response, create


def test_a_bank_event_may_be_submitted_without_a_date(member_client, bank):
    """The bank holds templates, not occurrences.

    `start_dt` used to be NOT NULL with `default_factory=get_current_datetime`,
    so an omitted date silently became the moment of submission. A leader
    writing up "vetrarútilega" in September got an event dated September, which
    then sorted and filtered as though it had happened that day. The create form
    deliberately asks for no date, so the API must accept its absence.
    """
    response, create = _post_event(member_client, bank, WorkspaceRole.viewer)
    assert response.status_code == status.HTTP_201_CREATED

    stored = create.await_args.args[1]
    assert stored.start_dt is None, "an omitted date must stay absent, not become now()"


def test_a_planner_event_still_carries_its_date(member_client, bank):
    """Nullable is not the same as ignored — a supplied date is kept."""
    when = datetime(2026, 3, 14, 18, 0, tzinfo=timezone.utc)
    _, create = _post_event(member_client, bank, WorkspaceRole.viewer, start_dt=when.isoformat())

    stored = create.await_args.args[1]
    assert stored.start_dt == when


# ── Everyone can reach the bank ──────────────────────────────────────────────


@pytest.mark.integration
@pytest.mark.asyncio
async def test_enrolling_everyone_adds_only_the_missing(db):
    """The bulk enrol that opens the bank to accounts that predate it.

    Membership of the default workspace is what makes the bank readable and
    submittable, and it used to be arranged only when an account was *created* —
    so everyone who signed up before the workspace was configured was locked
    out. This is the sweep that closes that, and it has to be safe to run on a
    live database: it may only ever add.
    """
    from app.models import User, Workspace, WorkspaceMembership
    from app.repositories.workspaces import WorkspaceRepository

    workspace = Workspace(
        name="Dagskrárbankinn",
        default_meeting_weekday=Weekday.monday,
        default_start_time=time(20, 0),
        default_end_time=time(21, 30),
        default_interval=EventInterval.weekly,
        season_start=date(2026, 9, 1),
    )
    db.add(workspace)
    await db.flush()

    already = User(name="Owner", auth0_id="auth0|owner", email="owner@test.is")
    missing_one = User(name="Gamall", auth0_id="auth0|old1", email="old1@test.is")
    missing_two = User(name="Eldri", auth0_id="auth0|old2", email="old2@test.is")
    db.add_all([already, missing_one, missing_two])
    await db.flush()

    db.add(
        WorkspaceMembership(workspace_id=workspace.id, user_id=already.id, role=WorkspaceRole.owner)
    )
    await db.flush()

    repo = WorkspaceRepository(db)
    assert await repo.count_users_missing_from(workspace.id) == 2

    added = await repo.enroll_all_users_as_viewers(workspace.id)
    await db.flush()
    assert added == 2, "only the two without a membership"

    roles = {
        m.user_id: m.role
        for m in (
            await db.execute(
                select(WorkspaceMembership).where(WorkspaceMembership.workspace_id == workspace.id)
            )
        )
        .scalars()
        .all()
    }
    # The whole point: never a downgrade. set_member_role even refuses to demote
    # an owner outright, so getting this wrong would break their login.
    assert roles[already.id] == WorkspaceRole.owner
    assert roles[missing_one.id] == WorkspaceRole.viewer
    assert roles[missing_two.id] == WorkspaceRole.viewer

    # Running it twice must be a no-op, because a deploy runs the seed every time.
    assert await repo.enroll_all_users_as_viewers(workspace.id) == 0
