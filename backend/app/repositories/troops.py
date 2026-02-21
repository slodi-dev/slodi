from __future__ import annotations

import datetime as dt
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, and_, delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event
from app.models.troop import Troop, TroopParticipation
from app.repositories.base import Repository


class TroopRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    # ----- troops -----

    async def get(self, troop_id: UUID) -> Troop | None:
        stmt: Select[tuple[Troop]] = (
            select(Troop)
            .options(
                selectinload(Troop.workspace),
                selectinload(Troop.troop_participations),
            )
            .where(Troop.id == troop_id, Troop.deleted_at.is_(None))
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def get_in_workspace(self, troop_id: UUID, workspace_id: UUID) -> Troop | None:
        stmt = select(Troop).where(
            Troop.id == troop_id,
            Troop.workspace_id == workspace_id,
            Troop.deleted_at.is_(None),
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def count_troops_for_workspace(self, workspace_id: UUID) -> int:
        result = await self.session.scalar(
            select(func.count())
            .select_from(Troop)
            .where(Troop.workspace_id == workspace_id, Troop.deleted_at.is_(None))
        )
        return result or 0

    async def list_for_workspace(
        self, workspace_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> Sequence[Troop]:
        stmt = (
            select(Troop)
            .where(Troop.workspace_id == workspace_id, Troop.deleted_at.is_(None))
            .order_by(Troop.name)
            .limit(limit)
            .offset(offset)
        )
        return await self.scalars(stmt)

    async def create(self, troop: Troop) -> Troop:
        await self.add(troop)
        return troop

    async def delete(self, troop_id: UUID) -> int:
        now = dt.datetime.now(dt.timezone.utc)
        res = await self.session.execute(
            update(Troop)
            .where(Troop.id == troop_id, Troop.deleted_at.is_(None))
            .values(deleted_at=now)
        )
        return res.rowcount or 0

    # ----- participations -----

    async def count_event_troops(self, event_id: UUID) -> int:
        result = await self.session.scalar(
            select(func.count())
            .select_from(TroopParticipation)
            .join(Troop, Troop.id == TroopParticipation.troop_id)
            .where(TroopParticipation.event_id == event_id, Troop.deleted_at.is_(None))
        )
        return result or 0

    async def list_event_troops(
        self, event_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> Sequence[Troop]:
        stmt = (
            select(Troop)
            .join(TroopParticipation, TroopParticipation.troop_id == Troop.id)
            .where(TroopParticipation.event_id == event_id, Troop.deleted_at.is_(None))
            .order_by(Troop.name)
            .limit(limit)
            .offset(offset)
        )
        return await self.scalars(stmt)

    async def count_troop_events(self, troop_id: UUID) -> int:
        result = await self.session.scalar(
            select(func.count())
            .select_from(TroopParticipation)
            .where(TroopParticipation.troop_id == troop_id)
        )
        return result or 0

    async def list_troop_events(
        self, troop_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> Sequence[Event]:
        stmt = (
            select(Event)
            .join(TroopParticipation, TroopParticipation.event_id == Event.id)
            .where(TroopParticipation.troop_id == troop_id, Event.deleted_at.is_(None))
            .order_by(Event.start_dt)
            .limit(limit)
            .offset(offset)
        )
        return await self.scalars(stmt)

    async def get_participation(self, event_id: UUID, troop_id: UUID) -> TroopParticipation | None:
        return await self.session.scalar(
            select(TroopParticipation).where(
                and_(
                    TroopParticipation.troop_id == troop_id,
                    TroopParticipation.event_id == event_id,
                )
            )
        )

    async def add_participation(
        self, event_id: UUID, troop_id: UUID
    ) -> tuple[bool, TroopParticipation]:
        existing = await self.get_participation(event_id, troop_id)
        if existing:
            return False, existing
        tp = TroopParticipation(troop_id=troop_id, event_id=event_id)
        await self.add(tp)
        return True, tp

    async def remove_participation(self, event_id: UUID, troop_id: UUID) -> int:
        res = await self.session.execute(
            delete(TroopParticipation).where(
                and_(
                    TroopParticipation.troop_id == troop_id,
                    TroopParticipation.event_id == event_id,
                )
            )
        )
        return res.rowcount or 0
