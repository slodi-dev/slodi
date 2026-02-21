from __future__ import annotations

import datetime as dt
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.repositories.base import Repository


class UserRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get(self, user_id: UUID) -> User | None:
        stmt: Select[tuple[User]] = (
            select(User)
            .options(
                selectinload(User.ws_memberships),
                selectinload(User.group_memberships),
            )
            .where(User.id == user_id, User.deleted_at.is_(None))
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(
            func.lower(User.email) == email.lower(), User.deleted_at.is_(None)
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def get_by_auth0_id(self, auth0_id: str) -> User | None:
        stmt = select(User).where(User.auth0_id == auth0_id, User.deleted_at.is_(None))
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def count(self, *, q: str | None = None) -> int:
        stmt = select(func.count()).select_from(User).where(User.deleted_at.is_(None))
        if q:
            ilike = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    User.name.ilike(ilike),
                    User.email.ilike(ilike),
                    User.auth0_id.ilike(ilike),
                )
            )
        res = await self.session.execute(stmt)
        return res.scalar_one()

    async def list(
        self,
        *,
        q: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[User]:
        stmt = select(User).where(User.deleted_at.is_(None)).order_by(User.name.asc())
        if q:
            ilike = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    User.name.ilike(ilike),
                    User.email.ilike(ilike),
                    User.auth0_id.ilike(ilike),
                )
            )
        stmt = stmt.limit(limit).offset(offset)
        return await self.scalars(stmt)

    async def create(self, user: User) -> User:
        await self.add(user)
        return user

    async def delete(self, user_id: UUID) -> int:
        now = dt.datetime.now(dt.timezone.utc)
        res = await self.session.execute(
            update(User).where(User.id == user_id, User.deleted_at.is_(None)).values(deleted_at=now)
        )
        return res.rowcount or 0
