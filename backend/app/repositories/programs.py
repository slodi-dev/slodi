from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.program import Program
from app.repositories.base import Repository


class ProgramRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get(self, program_id: UUID) -> Program | None:
        stmt = (
            select(Program)
            .options(
                selectinload(Program.author),
                selectinload(Program.workspace),
                selectinload(Program.events),
            )
            .where(Program.id == program_id)
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def get_in_workspace(self, program_id: UUID, workspace_id: UUID) -> Program | None:
        stmt = select(Program).where(Program.id == program_id, Program.workspace_id == workspace_id)
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def count_programs_for_workspace(self, workspace_id: UUID) -> int:
        result = await self.session.scalar(
            select(func.count()).select_from(Program).where(Program.workspace_id == workspace_id)
        )
        return result or 0

    async def list_by_workspace(
        self, workspace_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> Sequence[Program]:
        stmt = (
            select(Program)
            .where(Program.workspace_id == workspace_id)
            .order_by(Program.name)
            .limit(limit)
            .offset(offset)
        )
        return await self.scalars(stmt)

    async def create(self, program: Program) -> Program:
        await self.add(program)
        return program

    async def delete(self, program_id: UUID) -> int:
        stmt = delete(Program).where(Program.id == program_id)
        res = await self.session.execute(stmt)
        return res.rowcount or 0
