from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

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

    async def get_user_membership(
        self, workspace_id: UUID, user_id: UUID
    ) -> WorkspaceMembershipOut:
        membership = await self.repo.get_user_membership(workspace_id, user_id)
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found"
            )
        return WorkspaceMembershipOut.model_validate(membership)
