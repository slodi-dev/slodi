from __future__ import annotations

import datetime as dt
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.content import Content
from app.models.event import Event
from app.models.program import Program
from app.models.task import Task
from app.models.troop import Troop
from app.models.workspace import Workspace, WorkspaceMembership, WorkspaceRole

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
        # Program/Event/Task use joined-table inheritance: each has its own
        # table (programs/events/tasks) with a FK to `content`.  deleted_at is
        # only on `content`, so update(Task/Event/Program) would be a
        # cross-table SET which PostgreSQL rejects.  Strategy:
        #   1. Use subclass mappers for SELECT only (JTI joins are fine there).
        #   2. Cascade via update(Content) keyed by pre-fetched IDs.

        # Pre-fetch event IDs for this workspace
        event_ids = list(
            (
                await self.session.execute(
                    select(Event.id).where(Event.workspace_id == workspace_id)
                )
            ).scalars()
        )

        # Pre-fetch task IDs for those events
        task_ids: list = []
        if event_ids:
            task_ids = list(
                (
                    await self.session.execute(select(Task.id).where(Task.event_id.in_(event_ids)))
                ).scalars()
            )

        # Pre-fetch program IDs for this workspace
        program_ids = list(
            (
                await self.session.execute(
                    select(Program.id).where(Program.workspace_id == workspace_id)
                )
            ).scalars()
        )

        # Cascade: soft-delete tasks
        if task_ids:
            await self.session.execute(
                update(Content)
                .where(Content.id.in_(task_ids), Content.deleted_at.is_(None))
                .values(deleted_at=now)
            )

        # Cascade: soft-delete events
        if event_ids:
            await self.session.execute(
                update(Content)
                .where(Content.id.in_(event_ids), Content.deleted_at.is_(None))
                .values(deleted_at=now)
            )

        # Cascade: soft-delete programs
        if program_ids:
            await self.session.execute(
                update(Content)
                .where(Content.id.in_(program_ids), Content.deleted_at.is_(None))
                .values(deleted_at=now)
            )

        # Cascade: soft-delete troops
        # (Troop has its own table with deleted_at — no cross-table issue)
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
        return res.rowcount or 0

    async def get_user_membership(
        self, workspace_id: UUID, user_id: UUID
    ) -> WorkspaceMembership | None:
        stmt = select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id, WorkspaceMembership.user_id == user_id
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()
