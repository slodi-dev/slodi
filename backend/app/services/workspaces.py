from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import WorkspaceRole
from app.models.workspace import Workspace
from app.repositories.workspaces import WorkspaceRepository
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceMembershipOut,
    WorkspaceOut,
    WorkspaceUpdate,
)


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

    async def set_member_role(
        self, workspace_id: UUID, user_id: UUID, role: WorkspaceRole
    ) -> tuple[WorkspaceMembershipOut, UUID | None]:
        """Returns (updated membership, displaced_owner_id).

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
