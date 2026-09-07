from __future__ import annotations

import datetime as dt
import logging
from uuid import UUID

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email import send_email_background
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
        """Put someone in skammarkrókur.

        Any length, including open-ended (`days=None`). Dagskrárstjórnarteymið
        owns this decision: every one is recorded, attributed and reversible,
        which is what makes it safe to leave with them rather than escalating.
        """
        if user_id == issuer.id:
            # Not a real risk, but the error is clearer than the confusion.
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Þú getur ekki sett sjálfan þig í skammarkrók.",
            )

        target = await UserRepository(self.session).get(user_id)
        if target is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

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
        return self._out(suspension, now)

    async def lift(
        self, suspension_id: UUID, lifter: UserOut, data: SuspensionLift
    ) -> SuspensionOut:
        """End one early. A reconsidered suspension is not the same as one that
        ran its course, so both facts are kept."""
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
                f"<p><strong>Ástæða:</strong> {suspension.reason}</p>"
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
