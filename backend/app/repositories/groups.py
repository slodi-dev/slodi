from __future__ import annotations

import datetime as dt
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, and_, delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.group import Group, GroupMemberRow, GroupMembership, GroupRole
from app.models.user import User
from app.repositories.base import Repository


class GroupRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    # ----- groups -----

    async def get(self, group_id: UUID) -> Group | None:
        stmt: Select[tuple[Group]] = (
            select(Group)
            .options(
                selectinload(Group.group_memberships),
                selectinload(Group.workspaces),
            )
            .where(Group.id == group_id, Group.deleted_at.is_(None))
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def count(self, *, q: str | None = None) -> int:
        stmt = select(func.count()).select_from(Group).where(Group.deleted_at.is_(None))
        if q:
            ilike = f"%{q.strip()}%"
            stmt = stmt.where(Group.name.ilike(ilike))
        result = await self.session.scalar(stmt)
        return result or 0

    async def list(
        self, *, q: str | None = None, limit: int = 50, offset: int = 0
    ) -> Sequence[Group]:
        stmt = select(Group).where(Group.deleted_at.is_(None)).order_by(Group.name)
        if q:
            ilike = f"%{q.strip()}%"
            stmt = stmt.where(Group.name.ilike(ilike))
        stmt = stmt.limit(limit).offset(offset)
        return await self.scalars(stmt)

    async def create(self, group: Group) -> Group:
        await self.add(group)
        return group

    async def delete(self, group_id: UUID) -> int:
        now = dt.datetime.now(dt.timezone.utc)
        res = await self.session.execute(
            update(Group)
            .where(Group.id == group_id, Group.deleted_at.is_(None))
            .values(deleted_at=now)
        )
        return res.rowcount or 0

    # ----- memberships -----
    async def count_groups_for_user(self, user_id: UUID) -> int:
        result = await self.session.scalar(
            select(func.count())
            .select_from(GroupMembership)
            .join(Group, Group.id == GroupMembership.group_id)
            .where(GroupMembership.user_id == user_id, Group.deleted_at.is_(None))
        )
        return result or 0

    async def list_groups_for_user(
        self, user_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> Sequence[Group]:
        stmt = (
            select(Group)
            .join(GroupMembership, Group.id == GroupMembership.group_id)
            .where(GroupMembership.user_id == user_id, Group.deleted_at.is_(None))
            .order_by(Group.name)
            .limit(limit)
            .offset(offset)
        )
        return await self.scalars(stmt)

    async def count_group_members(self, group_id: UUID) -> int:
        result = await self.session.scalar(
            select(func.count())
            .select_from(GroupMembership)
            .where(GroupMembership.group_id == group_id)
        )
        return result or 0

    async def list_group_members(
        self, group_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[GroupMemberRow]:  # type: ignore[valid-type]
        stmt = (
            select(
                User.id.label("user_id"),
                User.name,
                GroupMembership.role,
            )
            .select_from(GroupMembership)
            .join(User, User.id == GroupMembership.user_id)
            .where(GroupMembership.group_id == group_id)
            .order_by(func.lower(User.name).asc(), User.id.asc())
            .limit(limit)
            .offset(offset)
        )
        res = await self.session.execute(stmt)
        # Row -> dataclass
        return [GroupMemberRow(**row._mapping) for row in res.all()]

    async def get_membership(self, group_id: UUID, user_id: UUID) -> GroupMembership | None:
        return await self.session.scalar(
            select(GroupMembership).where(
                and_(
                    GroupMembership.group_id == group_id,
                    GroupMembership.user_id == user_id,
                )
            )
        )

    async def add_membership(
        self, group_id: UUID, user_id: UUID, role: GroupRole
    ) -> tuple[bool, GroupMembership]:
        existing = await self.get_membership(group_id, user_id)
        if existing:
            return False, existing
        gs = GroupMembership(group_id=group_id, user_id=user_id, role=role)
        await self.add(gs)
        return True, gs

    async def remove_member(self, group_id: UUID, user_id: UUID) -> int:
        res = await self.session.execute(
            delete(GroupMembership).where(
                and_(
                    GroupMembership.group_id == group_id,
                    GroupMembership.user_id == user_id,
                )
            )
        )
        return res.rowcount or 0
