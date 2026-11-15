from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, func, insert, literal, select
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.enums import WorkspaceRole
from app.models.user import User
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

    async def get_workspace_owner(self, workspace_id: UUID) -> WorkspaceMembership | None:
        stmt = select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.role == WorkspaceRole.owner,
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def get_user_membership(
        self, workspace_id: UUID, user_id: UUID
    ) -> WorkspaceMembership | None:
        stmt = select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id, WorkspaceMembership.user_id == user_id
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def list_members(self, workspace_id: UUID) -> Sequence[WorkspaceMembership]:
        stmt = select(WorkspaceMembership).where(WorkspaceMembership.workspace_id == workspace_id)
        return await self.scalars(stmt)

    async def set_member_role(
        self, workspace_id: UUID, user_id: UUID, role: WorkspaceRole
    ) -> WorkspaceMembership:
        membership = await self.get_user_membership(workspace_id, user_id)
        if membership:
            membership.role = role
        else:
            membership = WorkspaceMembership(workspace_id=workspace_id, user_id=user_id, role=role)
            await self.add(membership)
        return membership

    def _users_missing_from(self, workspace_id: UUID) -> Select[tuple[UUID]]:
        """Accounts with no membership of this workspace at all."""
        return select(User.id).where(
            User.deleted_at.is_(None),
            ~select(WorkspaceMembership.user_id)
            .where(
                WorkspaceMembership.workspace_id == workspace_id,
                WorkspaceMembership.user_id == User.id,
            )
            .exists(),
        )

    async def count_users_missing_from(self, workspace_id: UUID) -> int:
        return int(
            await self.session.scalar(
                select(func.count()).select_from(self._users_missing_from(workspace_id).subquery())
            )
            or 0
        )

    async def enroll_all_users_as_viewers(self, workspace_id: UUID) -> int:
        """Add every account missing from this workspace as a viewer; returns how many.

        Counted first because `rowcount` is -1 for INSERT ... FROM SELECT here."""
        missing = await self.count_users_missing_from(workspace_id)
        if not missing:
            return 0

        await self.session.execute(
            insert(WorkspaceMembership).from_select(
                ["workspace_id", "user_id", "role"],
                select(
                    literal(workspace_id, type_=PGUUID(as_uuid=True)),
                    User.id,
                    literal(WorkspaceRole.viewer, type_=WorkspaceMembership.role.type),
                ).where(
                    User.deleted_at.is_(None),
                    ~select(WorkspaceMembership.user_id)
                    .where(
                        WorkspaceMembership.workspace_id == workspace_id,
                        WorkspaceMembership.user_id == User.id,
                    )
                    .exists(),
                ),
            )
        )
        return missing
