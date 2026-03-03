from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import delete, select
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_list import EmailList
from app.repositories.base import Repository


class EmailListRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def list(self) -> Sequence[EmailList]:
        stmt = select(EmailList).order_by(EmailList.email.asc())
        return await self.scalars(stmt)

    async def create(self, email_entry: EmailList) -> EmailList:
        await self.add(email_entry)
        return email_entry

    async def delete(self, email: str) -> int:
        res = await self.session.execute(delete(EmailList).where(EmailList.email == email))
        assert isinstance(res, CursorResult)
        return res.rowcount or 0
