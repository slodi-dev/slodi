"""Who may change a workspace member's role — see sc-535.

`PUT /workspaces/{id}/members/{user_id}/role` only required workspace admin, and
the service transferred ownership to whoever was named. So any admin could make
themselves owner, demoting the real owner, and then delete the workspace. Only
the owner (or a platform admin) may transfer ownership, and an admin may not
change the role of anyone at or above their own rank, themselves included.
"""

from datetime import date, time
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.auth import get_current_user
from app.core.db import get_session
from app.domain.enums import EventInterval, Permissions, Weekday, WorkspaceRole
from app.main import create_app
from app.models import User, Workspace, WorkspaceMembership
from app.schemas.user import UserOut
from app.services.workspaces import WorkspaceService

# ── Router wiring (unit) ──────────────────────────────────────────────────────


def test_route_authorizes_through_the_acting_user(mock_db_session, viewer_user):
    """The route must hand the caller to the service, not set the role blindly."""
    app = create_app()

    async def _user():
        return viewer_user

    async def _session():
        yield mock_db_session

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_session] = _session

    workspace_id, target_id = uuid4(), uuid4()
    with (
        patch("app.core.auth._get_workspace_role", new_callable=AsyncMock) as role,
        patch(
            "app.services.workspaces.WorkspaceService.change_member_role",
            new_callable=AsyncMock,
        ) as change,
        patch("app.services.workspaces.WorkspaceService.set_member_role") as blind,
    ):
        role.return_value = WorkspaceRole.admin
        change.side_effect = HTTPException(status_code=403, detail="nope")

        res = TestClient(app).put(
            f"/workspaces/{workspace_id}/members/{target_id}/role", json={"role": "owner"}
        )

    assert res.status_code == 403
    change.assert_awaited_once_with(workspace_id, target_id, WorkspaceRole.owner, viewer_user)
    blind.assert_not_called()


# ── Service rules (integration) ───────────────────────────────────────────────


def _as(user: User, permissions: Permissions = Permissions.viewer) -> UserOut:
    return UserOut(
        id=user.id,
        auth0_id=user.auth0_id,
        email=user.email,
        name=user.name,
        pronouns=None,
        permissions=permissions,
        preferences=None,
    )


async def _workspace(db):
    workspace = Workspace(
        name="Fálkar",
        default_meeting_weekday=Weekday.monday,
        default_start_time=time(20, 0),
        default_end_time=time(21, 30),
        default_interval=EventInterval.weekly,
        season_start=date(2026, 9, 1),
    )
    db.add(workspace)
    await db.flush()

    people = {}
    for role in (
        WorkspaceRole.owner,
        WorkspaceRole.admin,
        WorkspaceRole.editor,
        WorkspaceRole.viewer,
    ):
        user = User(name=role.value, auth0_id=f"auth0|{uuid4()}", email=f"{uuid4()}@test.is")
        db.add(user)
        await db.flush()
        db.add(WorkspaceMembership(workspace_id=workspace.id, user_id=user.id, role=role))
        people[role] = user
    second_admin = User(name="admin2", auth0_id=f"auth0|{uuid4()}", email=f"{uuid4()}@test.is")
    db.add(second_admin)
    await db.flush()
    db.add(
        WorkspaceMembership(
            workspace_id=workspace.id, user_id=second_admin.id, role=WorkspaceRole.admin
        )
    )
    await db.flush()
    return workspace, people, second_admin


async def _roles(db, workspace_id):
    rows = (
        (
            await db.execute(
                select(WorkspaceMembership).where(WorkspaceMembership.workspace_id == workspace_id)
            )
        )
        .scalars()
        .all()
    )
    return {m.user_id: m.role for m in rows}


async def _refused(svc, *args):
    with pytest.raises(HTTPException) as exc:
        await svc.change_member_role(*args)
    assert exc.value.status_code == 403


@pytest.mark.integration
@pytest.mark.asyncio
async def test_an_admin_cannot_make_themselves_owner(db):
    ws, people, _ = await _workspace(db)
    admin, owner = people[WorkspaceRole.admin], people[WorkspaceRole.owner]

    await _refused(WorkspaceService(db), ws.id, admin.id, WorkspaceRole.owner, _as(admin))

    roles = await _roles(db, ws.id)
    assert roles[owner.id] == WorkspaceRole.owner
    assert roles[admin.id] == WorkspaceRole.admin


@pytest.mark.integration
@pytest.mark.asyncio
async def test_an_admin_cannot_transfer_ownership_to_someone_else(db):
    ws, people, _ = await _workspace(db)
    admin, editor = people[WorkspaceRole.admin], people[WorkspaceRole.editor]

    await _refused(WorkspaceService(db), ws.id, editor.id, WorkspaceRole.owner, _as(admin))
    assert (await _roles(db, ws.id))[editor.id] == WorkspaceRole.editor


@pytest.mark.integration
@pytest.mark.asyncio
async def test_an_admin_cannot_demote_the_owner(db):
    ws, people, _ = await _workspace(db)
    admin, owner = people[WorkspaceRole.admin], people[WorkspaceRole.owner]

    await _refused(WorkspaceService(db), ws.id, owner.id, WorkspaceRole.viewer, _as(admin))


@pytest.mark.integration
@pytest.mark.asyncio
async def test_an_admin_cannot_change_another_admin(db):
    ws, people, second_admin = await _workspace(db)
    admin = people[WorkspaceRole.admin]

    await _refused(WorkspaceService(db), ws.id, second_admin.id, WorkspaceRole.viewer, _as(admin))
    assert (await _roles(db, ws.id))[second_admin.id] == WorkspaceRole.admin


@pytest.mark.integration
@pytest.mark.asyncio
async def test_an_admin_cannot_change_their_own_role(db):
    ws, people, _ = await _workspace(db)
    admin = people[WorkspaceRole.admin]

    await _refused(WorkspaceService(db), ws.id, admin.id, WorkspaceRole.editor, _as(admin))


@pytest.mark.integration
@pytest.mark.asyncio
async def test_an_admin_can_change_members_below_them(db):
    ws, people, _ = await _workspace(db)
    admin = people[WorkspaceRole.admin]
    editor, viewer = people[WorkspaceRole.editor], people[WorkspaceRole.viewer]
    svc = WorkspaceService(db)

    await svc.change_member_role(ws.id, editor.id, WorkspaceRole.viewer, _as(admin))
    await svc.change_member_role(ws.id, viewer.id, WorkspaceRole.admin, _as(admin))

    roles = await _roles(db, ws.id)
    assert roles[editor.id] == WorkspaceRole.viewer
    assert roles[viewer.id] == WorkspaceRole.admin


@pytest.mark.integration
@pytest.mark.asyncio
async def test_the_owner_can_transfer_ownership(db):
    ws, people, _ = await _workspace(db)
    owner, admin = people[WorkspaceRole.owner], people[WorkspaceRole.admin]

    _, displaced = await WorkspaceService(db).change_member_role(
        ws.id, admin.id, WorkspaceRole.owner, _as(owner)
    )

    assert displaced == owner.id
    roles = await _roles(db, ws.id)
    assert roles[admin.id] == WorkspaceRole.owner
    assert roles[owner.id] == WorkspaceRole.admin


@pytest.mark.integration
@pytest.mark.asyncio
async def test_the_owner_can_change_admins(db):
    ws, people, _ = await _workspace(db)
    owner, admin = people[WorkspaceRole.owner], people[WorkspaceRole.admin]

    await WorkspaceService(db).change_member_role(ws.id, admin.id, WorkspaceRole.editor, _as(owner))
    assert (await _roles(db, ws.id))[admin.id] == WorkspaceRole.editor


@pytest.mark.integration
@pytest.mark.asyncio
async def test_a_platform_admin_can_transfer_ownership(db):
    ws, people, _ = await _workspace(db)
    owner, editor = people[WorkspaceRole.owner], people[WorkspaceRole.editor]
    outsider = User(name="Stjórn", auth0_id=f"auth0|{uuid4()}", email=f"{uuid4()}@test.is")
    db.add(outsider)
    await db.flush()

    await WorkspaceService(db).change_member_role(
        ws.id, editor.id, WorkspaceRole.owner, _as(outsider, Permissions.admin)
    )

    roles = await _roles(db, ws.id)
    assert roles[editor.id] == WorkspaceRole.owner
    assert roles[owner.id] == WorkspaceRole.admin
