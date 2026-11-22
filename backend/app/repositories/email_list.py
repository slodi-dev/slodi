from __future__ import annotations

from collections.abc import Iterable, Sequence
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.engine import CursorResult

from app.models.email_list import EmailList
from app.repositories.base import Repository


class EmailListRepository(Repository):
    async def list(self) -> Sequence[EmailList]:
        """Current subscribers only — everything that sends reads this."""
        stmt = (
            select(EmailList)
            .where(EmailList.unsubscribed_at.is_(None))
            .order_by(EmailList.email.asc())
        )
        return await self.scalars(stmt)

    async def create(self, email_entry: EmailList) -> EmailList:
        await self.add(email_entry)
        return email_entry

    async def get_by_email(self, email: str) -> EmailList | None:
        stmt = select(EmailList).where(func.lower(EmailList.email) == email.lower())
        return (await self.session.execute(stmt)).scalars().first()

    async def get_by_token(self, token: UUID) -> EmailList | None:
        stmt = select(EmailList).where(EmailList.unsubscribe_token == token)
        return (await self.session.execute(stmt)).scalars().first()

    async def active_tokens_for(self, emails: Iterable[str]) -> dict[str, UUID]:
        """Tokens of the given addresses that are current subscribers, keyed by the address as
        given; matching ignores case and surrounding spaces."""
        given = {e: e.strip().lower() for e in emails if e and e.strip()}
        if not given:
            return {}
        stmt = select(EmailList.email, EmailList.unsubscribe_token).where(
            func.lower(EmailList.email).in_(set(given.values())),
            EmailList.unsubscribed_at.is_(None),
        )
        found = {email.lower(): token for email, token in (await self.session.execute(stmt)).all()}
        return {e: found[norm] for e, norm in given.items() if norm in found}

    async def delete(self, email: str) -> int:
        res = await self.session.execute(
            delete(EmailList).where(func.lower(EmailList.email) == email.strip().lower())
        )
        assert isinstance(res, CursorResult)
        return res.rowcount or 0
