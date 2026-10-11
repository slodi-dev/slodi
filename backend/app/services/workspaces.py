from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import Permissions, WorkspaceRole
from app.models.workspace import Workspace
from app.repositories.workspaces import WorkspaceRepository
from app.schemas.user import UserOut
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceMembershipOut,
    WorkspaceOut,
    WorkspaceUpdate,
)

# Mirrors `_WORKSPACE_ROLE_RANK` in app/core/auth.py, which imports this module.
_ROLE_RANK: dict[WorkspaceRole, int] = {
    WorkspaceRole.viewer: 0,
    WorkspaceRole.editor: 1,
    WorkspaceRole.admin: 2,
    WorkspaceRole.owner: 3,
}


class WorkspaceService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = WorkspaceRepository(session)

    async def get(self, workspace_id: UUID) -> WorkspaceOut:
        ws = await self.repo.get(workspace_id)
        if not ws:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
        return WorkspaceOut.model_validate(ws)

    async def count_user_workspaces(self, user_id: UUID) -> int:
        return await self.repo.count_user_workspaces(user_id)

    async def list_user_workspaces(
        self, user_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[WorkspaceOut]:
        rows = await self.repo.list_user_workspaces(user_id, limit=limit, offset=offset)
        return [WorkspaceOut.model_validate(r) for r in rows]

    async def create_user_workspace(self, user_id: UUID, data: WorkspaceCreate) -> WorkspaceOut:
        ws = Workspace(**data.model_dump())
        await self.repo.create_user_workspace(user_id, ws)
        await self.session.commit()
        await self.session.refresh(ws)
        return WorkspaceOut.model_validate(ws)

    async def update(self, workspace_id: UUID, data: WorkspaceUpdate) -> WorkspaceOut:
        ws = await self.repo.get(workspace_id)
        if not ws:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

        patch = data.model_dump(exclude_unset=True)
        for k, v in patch.items():
            setattr(ws, k, v)
        await self.session.commit()
        await self.session.refresh(ws)
        return WorkspaceOut.model_validate(ws)

    async def delete(self, workspace_id: UUID) -> None:
        ws = await self.repo.get(workspace_id)
        if not ws:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
        await self.repo.delete(workspace_id)
        await self.session.commit()

    async def list_members(self, workspace_id: UUID) -> list[WorkspaceMembershipOut]:
        rows = await self.repo.list_members(workspace_id)
        return [WorkspaceMembershipOut.model_validate(r) for r in rows]

    async def change_member_role(
        self, workspace_id: UUID, user_id: UUID, role: WorkspaceRole, actor: UserOut
    ) -> tuple[WorkspaceMembershipOut, UUID | None]:
        """Change a member's role on behalf of `actor`, enforcing who may do what.

        - Platform admins may make any change, including transferring ownership.
        - Only the current owner may transfer ownership (assign `owner`).
        - Otherwise the actor may only change the role of members ranked strictly
          below them, which rules out changing their own role, and may only grant
          roles strictly below their own — so an admin cannot make another admin.

        The router has already checked that the actor is at least a workspace
        admin; this guards against an admin promoting themselves to owner (and
        then deleting the workspace) or demoting a peer.
        """
        if actor.permissions != Permissions.admin:
            actor_membership = await self.repo.get_user_membership(workspace_id, actor.id)
            if actor_membership is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member"
                )
            actor_rank = _ROLE_RANK[actor_membership.role]

            if role == WorkspaceRole.owner:
                if actor_membership.role != WorkspaceRole.owner:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Only the workspace owner can transfer ownership",
                    )
            else:
                target = await self.repo.get_user_membership(workspace_id, user_id)
                if user_id == actor.id or (
                    target is not None and _ROLE_RANK[target.role] >= actor_rank
                ):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Cannot change the role of a member at or above your own role",
                    )
                if _ROLE_RANK[role] >= actor_rank:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Cannot grant a role at or above your own",
                    )

        return await self.set_member_role(workspace_id, user_id, role)

    async def set_member_role(
        self, workspace_id: UUID, user_id: UUID, role: WorkspaceRole
    ) -> tuple[WorkspaceMembershipOut, UUID | None]:
        """Set a role with no check on who is asking; callers must authorize.

        Returns (updated membership, displaced_owner_id).

        displaced_owner_id is set when ownership is transferred so the caller
        can invalidate the former owner's cached role.
        """
        current_owner = await self.repo.get_workspace_owner(workspace_id)
        displaced_owner_id: UUID | None = None

        if role == WorkspaceRole.owner:
            # Transfer ownership: demote the current owner to admin first.
            if current_owner and current_owner.user_id != user_id:
                current_owner.role = WorkspaceRole.admin
                displaced_owner_id = current_owner.user_id
        elif current_owner and current_owner.user_id == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the workspace owner. Transfer ownership to another member first.",
            )

        membership = await self.repo.set_member_role(workspace_id, user_id, role)
        await self.session.commit()
        await self.session.refresh(membership)
        return WorkspaceMembershipOut.model_validate(membership), displaced_owner_id

    async def enroll_all_users_as_viewers(self, workspace_id: UUID) -> int:
        """Bulk-add every account to this workspace as a viewer. Never downgrades."""
        added = await self.repo.enroll_all_users_as_viewers(workspace_id)
        await self.session.commit()
        return added

    async def find_user_role(self, workspace_id: UUID, user_id: UUID) -> WorkspaceRole | None:
        """Return the user's workspace role, or None if not a member. Does not raise on miss."""
        membership = await self.repo.get_user_membership(workspace_id, user_id)
        return membership.role if membership else None

    async def get_user_membership(
        self, workspace_id: UUID, user_id: UUID
    ) -> WorkspaceMembershipOut:
        membership = await self.repo.get_user_membership(workspace_id, user_id)
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found"
            )
        return WorkspaceMembershipOut.model_validate(membership)
