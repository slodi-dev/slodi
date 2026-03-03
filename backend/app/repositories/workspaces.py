from __future__ import annotations

import datetime as dt
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.enums import WorkspaceRole
from app.models.content import Content
from app.models.troop import Troop
from app.models.workspace import Workspace, WorkspaceMembership

from .base import Repository


class WorkspaceRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get(self, workspace_id: UUID) -> Workspace | None:
        stmt = (
            select(Workspace)
            .options(
                selectinload(Workspace.programs),
                selectinload(Workspace.events),
                selectinload(Workspace.troops),
            )
            .where(Workspace.id == workspace_id, Workspace.deleted_at.is_(None))
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def count_user_workspaces(self, user_id: UUID) -> int:
        result = await self.session.scalar(
            select(func.count())
            .select_from(Workspace)
            .join(WorkspaceMembership, WorkspaceMembership.workspace_id == Workspace.id)
            .where(WorkspaceMembership.user_id == user_id, Workspace.deleted_at.is_(None))
        )
        return result or 0

    async def list_user_workspaces(
        self, user_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> Sequence[Workspace]:
        stmt = (
            select(Workspace)
            .join(WorkspaceMembership, WorkspaceMembership.workspace_id == Workspace.id)
            .where(WorkspaceMembership.user_id == user_id, Workspace.deleted_at.is_(None))
            .order_by(Workspace.name)
            .limit(limit)
            .offset(offset)
        )
        return await self.scalars(stmt)

    async def create_user_workspace(
        self, user_id: UUID, ws: Workspace
    ) -> tuple[Workspace, WorkspaceMembership]:
        await self.add(ws)
        membership = WorkspaceMembership(user_id=user_id, workspace=ws, role=WorkspaceRole.owner)
        await self.add(membership)
        return ws, membership

    async def delete(self, workspace_id: UUID) -> int:
        now = dt.datetime.now(dt.timezone.utc)

        # Cascade: soft-delete all content items (programs, events, tasks) in the workspace.
        # workspace_id is on the content table so one query covers all content types.
        await self.session.execute(
            update(Content)
            .where(Content.workspace_id == workspace_id, Content.deleted_at.is_(None))
            .values(deleted_at=now)
        )

        # Cascade: soft-delete troops (separate table with its own deleted_at)
        await self.session.execute(
            update(Troop)
            .where(Troop.workspace_id == workspace_id, Troop.deleted_at.is_(None))
            .values(deleted_at=now)
        )

        # Soft-delete the workspace itself
        res = await self.session.execute(
            update(Workspace)
            .where(Workspace.id == workspace_id, Workspace.deleted_at.is_(None))
            .values(deleted_at=now)
        )
        assert isinstance(res, CursorResult)
        return res.rowcount or 0

    async def get_user_membership(
        self, workspace_id: UUID, user_id: UUID
    ) -> WorkspaceMembership | None:
        stmt = select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id, WorkspaceMembership.user_id == user_id
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()
