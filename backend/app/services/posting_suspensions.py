from __future__ import annotations

import datetime as dt
import html
import logging
from uuid import UUID

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email import send_email_background
from app.domain.enums import Permissions
from app.domain.icelandic_dates import format_date
from app.models.posting_suspension import PostingSuspension
from app.repositories.posting_suspensions import PostingSuspensionRepository
from app.repositories.users import UserRepository
from app.schemas.posting_suspension import SuspensionCreate, SuspensionLift, SuspensionOut
from app.schemas.user import UserOut
from app.utils import get_current_datetime

logger = logging.getLogger(__name__)

SUSPENSION_DAY = 60 * 60 * 24


class PostingSuspensionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = PostingSuspensionRepository(session)

    async def history(self, user_id: UUID) -> list[SuspensionOut]:
        now = get_current_datetime()
        return [self._out(s, now) for s in await self.repo.history_for(user_id)]

    async def active(self, user_id: UUID) -> SuspensionOut | None:
        now = get_current_datetime()
        found = await self.repo.active_for(user_id, now)
        return self._out(found, now) if found else None

    async def suspend(
        self,
        user_id: UUID,
        issuer: UserOut,
        data: SuspensionCreate,
        background_tasks: BackgroundTasks,
    ) -> SuspensionOut:
        """Put someone in skammarkrókur, for `days` or open-ended (`days=None`).

        Moderators may suspend members only; an admin may also suspend a moderator.
        Nobody suspends an admin or themselves."""
        if user_id == issuer.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Þú getur ekki sett sjálfan þig í skammarkrók.",
            )

        target = await UserRepository(self.session).get(user_id)
        if target is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if target.permissions == Permissions.admin or (
            target.permissions == Permissions.moderator and issuer.permissions != Permissions.admin
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Þú getur ekki sett þennan notanda í skammarkrók.",
            )

        now = get_current_datetime()
        if await self.repo.active_for(user_id, now):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Þessi notandi er nú þegar í skammarkrók.",
            )

        suspension = PostingSuspension(
            user_id=user_id,
            starts_at=now,
            expires_at=(now + dt.timedelta(days=data.days)) if data.days else None,
            reason=data.reason,
            issued_by_id=issuer.id,
            created_at=now,
        )
        self.session.add(suspension)
        await self.session.commit()

        self._notify(background_tasks, target.email, suspension)
        return await self._reread(suspension.id, now)

    async def lift(
        self, suspension_id: UUID, lifter: UserOut, data: SuspensionLift
    ) -> SuspensionOut:
        """End one early; the record keeps that it was lifted, by whom and why."""
        suspension = await self.repo.get(suspension_id)
        if suspension is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        if suspension.lifted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Þessi skammarkrókur er þegar liðinn."
            )

        now = get_current_datetime()
        suspension.lifted_at = now
        suspension.lifted_by_id = lifter.id
        suspension.lift_reason = data.reason
        await self.session.commit()
        return await self._reread(suspension_id, now)

    async def _reread(self, suspension_id: UUID, now: dt.datetime) -> SuspensionOut:
        # Loads issued_by/lifted_by; reading them off the new row would lazy-load under async.
        suspension = await self.repo.get(suspension_id)
        assert suspension is not None
        return self._out(suspension, now)

    def _notify(
        self, background_tasks: BackgroundTasks, email: str | None, suspension: PostingSuspension
    ) -> None:
        if not email:
            logger.error("Suspension %s could not be notified — no address", suspension.id)
            return
        when = (
            f"fram til <strong>{format_date(suspension.expires_at)}</strong>"
            if suspension.expires_at
            else "að sinni"
        )
        send_email_background(
            background_tasks,
            [email],
            "Slóði — þú getur ekki sent inn efni um sinn",
            (
                f"<p>Þú getur ekki sent inn efni í dagskrárbankann {when}.</p>"
                f"<p><strong>Ástæða:</strong> {html.escape(suspension.reason)}</p>"
                f"<p>Þú getur áfram lesið bankann og notað dagskrár. "
                f"Hafðu samband við Dagskrárstjórnarteymið ef þú vilt ræða þetta.</p>"
            ),
        )

    @staticmethod
    def _out(suspension: PostingSuspension, now: dt.datetime) -> SuspensionOut:
        return SuspensionOut.model_validate(suspension).model_copy(
            update={
                "is_active": suspension.active_at(now),
                "issued_by_name": suspension.issued_by.name if suspension.issued_by else None,
                "lifted_by_name": suspension.lifted_by.name if suspension.lifted_by else None,
            }
        )
