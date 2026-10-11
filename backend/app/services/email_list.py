from __future__ import annotations

from collections.abc import Iterable
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_list import EmailList
from app.repositories.email_list import EmailListRepository
from app.schemas.email_list import EmailListCreate, EmailListOut, SubscriptionStatusOut
from app.utils import get_current_datetime

_INVALID_TOKEN = "Invalid unsubscribe token."


class EmailListService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = EmailListRepository(session)

    async def list(self) -> list[EmailListOut]:
        rows = await self.repo.list()
        return [EmailListOut.model_validate(r) for r in rows]

    async def create(self, data: EmailListCreate) -> None:
        # Whatever happens, the caller gets the same answer, so the signup form
        # cannot be used to find out who is subscribed.
        existing = await self.repo.get_by_email(data.email)
        if existing is not None:
            if existing.unsubscribed_at is not None:
                # Signing up again after unsubscribing: same row, same token.
                existing.unsubscribed_at = None
                await self.session.commit()
            return
        try:
            await self.repo.create(EmailList(**data.model_dump()))
            await self.session.commit()
        except IntegrityError:
            # Lost a race with a concurrent signup for the same address.
            await self.session.rollback()

    async def delete(self, email: str) -> None:
        deleted_count = await self.repo.delete(email)
        if deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email not found in subscription list",
            )
        await self.session.commit()

    async def active_tokens_for(self, emails: Iterable[str]) -> dict[str, UUID]:
        return await self.repo.active_tokens_for(emails)

    async def _by_token(self, token: UUID) -> EmailList:
        entry = await self.repo.get_by_token(token)
        if entry is None:
            # Only a token that never existed (or whose row an admin deleted).
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_INVALID_TOKEN)
        return entry

    async def subscription_status(self, token: UUID) -> SubscriptionStatusOut:
        """Read-only: what the unsubscribe page shows on load."""
        entry = await self._by_token(token)
        return SubscriptionStatusOut(subscribed=entry.unsubscribed_at is None, changed=False)

    async def unsubscribe_by_token(self, token: UUID) -> SubscriptionStatusOut:
        """Idempotent: a token that was already used still succeeds."""
        entry = await self._by_token(token)
        if entry.unsubscribed_at is not None:
            return SubscriptionStatusOut(subscribed=False, changed=False)
        entry.unsubscribed_at = get_current_datetime()
        await self.session.commit()
        return SubscriptionStatusOut(subscribed=False, changed=True)

    async def resubscribe_by_token(self, token: UUID) -> SubscriptionStatusOut:
        """Undo an unsubscribe from the same link. Idempotent."""
        entry = await self._by_token(token)
        if entry.unsubscribed_at is None:
            return SubscriptionStatusOut(subscribed=True, changed=False)
        entry.unsubscribed_at = None
        await self.session.commit()
        return SubscriptionStatusOut(subscribed=True, changed=True)
